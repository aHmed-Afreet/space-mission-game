import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { offline } from "../vite.config";

test("production worker precaches privacy and lazy chunks and serves the correct offline document",async()=>{
  const plugin=offline();let source="";
  assert.equal(typeof plugin.generateBundle,"function");
  await (plugin.generateBundle as Function).call({emitFile:(file:{fileName:string;source:string})=>{if(file.fileName==="sw.js")source=file.source;}}, {}, {"assets/history.js":{},"assets/commander.js":{}},false);
  const handlers:Record<string,(event:any)=>void>={};
  let files:string[]=[];
  const scope="https://example.test/game/";
  const documents=new Map([[scope+"privacy.html","PRIVACY"],[scope+"index.html","GAME"],[scope+"assets/history.js","HISTORY_CHUNK"]]);
  runInNewContext(source,{
    self:{registration:{scope},location:{origin:"https://example.test"},clients:{claim:async()=>{}},addEventListener:(type:string,fn:(event:any)=>void)=>{handlers[type]=fn;}},
    URL,Date,Promise,
    caches:{open:async()=>({addAll:async(list:string[])=>{files=list;}}),keys:async()=>[],match:async(req:{url?:string;mode?:string}|URL,options?:{ignoreVary?:boolean})=>{
      // Precache fetches and module requests differ in Origin, while Vite's
      // preview sends Vary: Origin. Hashed public assets must still be found.
      if(!(req instanceof URL)&&req.mode==="cors"&&!options?.ignoreVary)return undefined;
      return documents.get(req instanceof URL?req.href:req.url!);
    }},
    fetch:async()=>{throw Error("offline");},
  });
  let installing=Promise.resolve();handlers.install({waitUntil:(p:Promise<void>)=>{installing=p;}});await installing;
  assert.ok(files.includes("./privacy.html"));assert.ok(files.includes("./assets/history.js"));assert.ok(files.includes("./assets/commander.js"));
  for(const [path,expected] of [["privacy.html","PRIVACY"],["unknown-app-route","GAME"]]){
    let response:Promise<unknown>=Promise.resolve();
    handlers.fetch({request:{method:"GET",url:scope+path,mode:"navigate"},respondWith:(p:Promise<unknown>)=>{response=p;}});
    assert.equal(await response,expected);
  }
  let chunk:Promise<unknown>=Promise.resolve();
  handlers.fetch({request:{method:"GET",url:scope+"assets/history.js",mode:"cors"},respondWith:(p:Promise<unknown>)=>{chunk=p;}});
  assert.equal(await chunk,"HISTORY_CHUNK","cached modules remain usable when offline despite Vary: Origin");
});

test("realism models cache only after use; failed or quota-limited downloads never poison playback", async () => {
  let source = "";
  await (offline().generateBundle as Function).call({emitFile: (file: {fileName: string; source: string}) => { if (file.fileName === "sw.js") source = file.source; }}, {}, {}, false);
  const handlers: Record<string, (event: any) => void> = {};
  const saved = new Map<string, unknown>();
  const scope = "https://example.test/game/";
  let requests = 0, quota = false, ok = true;
  const cache = {
    match: async (request: {url: string}) => saved.get(request.url),
    put: async (request: {url: string}, response: unknown) => { if (quota) throw Error("quota"); saved.set(request.url, response); },
  };
  runInNewContext(source, {
    self: {registration: {scope}, location: {origin: "https://example.test"}, addEventListener: (type: string, fn: (event: any) => void) => {handlers[type] = fn;}},
    URL, Date, Promise,
    caches: {open: async () => cache, match: async () => undefined},
    fetch: async () => {requests++; return {ok, clone() {return this;}};},
  });
  async function load(name: string, directory = "realism") {
    let response: Promise<unknown> = Promise.resolve();
    handlers.fetch({request: {method: "GET", url: scope + "assets/" + directory + "/" + name}, respondWith: (p: Promise<unknown>) => {response = p;}});
    return response;
  }
  assert.equal(requests, 0, "new models do not fetch during service-worker installation");
  await load("lander.glb"); await load("lander.glb");
  assert.equal(requests, 1, "second use works from the local model cache");
  await load("mission-shell.glb", "interior"); await load("mission-shell.glb", "interior");
  assert.equal(requests, 2, "interior models also cache after first use");
  ok = false; await load("missing.glb"); await load("missing.glb");
  assert.equal(saved.size, 2, "HTTP failures are never cached");
  quota = true; ok = true;
  assert.ok(await load("terrain-base.jpg"), "storage quota failures still serve the network response");
});

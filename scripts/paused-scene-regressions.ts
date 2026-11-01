/** Native paused-scene regression, run against an already served production build.
 *
 * OTHER_BROWSER_STOPPED=1 PAUSED_EVA_STORAGE_STATE=/absolute/genuine-storage.json
 * BASE_URL=http://127.0.0.1:4173 OUTPUT_DIR=/absolute/evidence \
 * node --import tsx scripts/paused-scene-regressions.ts
 *
 * Restore a whole, genuinely earned paused EVA profile in an isolated context.
 * Do not fabricate session fields. This script never starts a preview or writes
 * application storage, position, objectives, clocks, physics or renderer state.
 * The only instrumented native calls are WebGL draws, forwarded unchanged.
 * EXPECT_STALE_SCENE=1 is an explicit negative-control run, never a fixed PASS.
 * Optional TEST_TEXTURE_FILE=/absolute/valid.png adds a labelled network-stub
 * image-arrival gate. Its bytes replace only the optional Earth imagery URL;
 * that gate is not photographic quality or external-media availability evidence.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { campaignForMission } from "../src/commander/campaign/campaignTypes";
import { assetManifest } from "../src/presentation/assetManifest";

assert.equal(process.env.OTHER_BROWSER_STOPPED,"1","Stop other gameplay browsers before running this serial gate.");
const savePath=process.env.PAUSED_EVA_STORAGE_STATE;
assert.ok(savePath,"PAUSED_EVA_STORAGE_STATE must name a whole genuinely earned paused EVA storageState.");
const base=process.env.BASE_URL||"http://127.0.0.1:4173",origin=new URL(base).origin;
const inputBytes=await readFile(resolve(savePath));
const input=JSON.parse(inputBytes.toString());
const inputOrigin=input.origins?.find((entry:any)=>entry.origin===origin);
assert.ok(inputOrigin,"Use the genuine profile's original origin; do not rewrite its localStorage entries.");
const campaignEntry=inputOrigin.localStorage?.find((entry:any)=>entry.name==="orbital-campaign-v3");
assert.ok(campaignEntry,"The genuine profile must contain Commander campaign storage.");
const original=JSON.parse(campaignEntry.value),session=original.session;
assert.ok(session?.state?.paused===true&&!session.report&&!session.state.ended,"Input must already be a paused, unfinished flight.");
assert.ok(session.suit?.equipped===true&&session.position?.z>10.25,"Input must be a genuinely earned exterior EVA checkpoint.");
const campaign=campaignForMission(session.missionId);assert.ok(campaign);
const negative=process.env.EXPECT_STALE_SCENE==="1";
const out=resolve(process.env.OUTPUT_DIR||join(tmpdir(),`space-mission-paused-scene-${Date.now()}`));
await mkdir(out,{recursive:true});
const scriptBytes=await readFile(new URL(import.meta.url));
await writeFile(join(out,"driver-source.ts"),scriptBytes,{flag:"wx"});
const textureFile=process.env.TEST_TEXTURE_FILE;
const textureBytes=textureFile?await readFile(resolve(textureFile)):null;
if(textureBytes)assert.equal(textureBytes.subarray(0,8).toString("hex"),"89504e470d0a1a0a","The optional stub must be a valid PNG file.");
const sha=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
const result:any={startedUtc:new Date().toISOString(),status:"RUNNING",candidateLabel:process.env.CANDIDATE_LABEL||null,
  scope:"Actual Chromium WebGL draws and paused-state conservation; no mission PASS or physical-device certification.",
  input:{path:resolve(savePath),sha256:sha(inputBytes),missionId:session.missionId,objective:session.objective,completed:session.completed},
  driverSha256:sha(scriptBytes),base,negativeControl:negative,viewport:{width:640,height:480},deviceScaleFactor:.7,
  optionalTextureStub:textureBytes?{path:resolve(textureFile!),sha256:sha(textureBytes),url:assetManifest.earth.runtimeUrl,declaredNetworkReplacement:true}:null,
  requests:[],phases:[],pageErrors:[]};
async function persist(){await writeFile(join(out,"results.json"),JSON.stringify(result,null,2));}
await persist();
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(done=>resolve=done);return {promise,resolve};}
const fieldGate=deferred(),fieldRequested=deferred(),textureGate=deferred(),textureRequested=deferred();
let fieldResponses=0,textureResponses=0;
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||"/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||"/usr/bin/chromium",headless:true,
  args:["--no-sandbox","--enable-unsafe-swiftshader","--disable-dev-shm-usage"]});
let context:any,page:any;
// Use a literal script to avoid TSX-generated helper references in the browser.
// No RAF/DOM instrumentation or game writable handles are installed.
const probeScript=`(() => {
  const probe = { drawCalls: 0, lastDrawAt: null, methods: {}, contexts: 0 };
  const contexts = new WeakSet();
  Object.defineProperty(window, '__pausedSceneDrawProbe', { value: probe });
  for (const Context of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!Context) continue;
    for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
      const descriptor = Object.getOwnPropertyDescriptor(Context.prototype, name);
      if (!descriptor || typeof descriptor.value !== 'function') continue;
      const native = descriptor.value;
      Object.defineProperty(Context.prototype, name, { ...descriptor, value: function(...args) {
        const returned = Reflect.apply(native, this, args);
        if (!contexts.has(this)) { contexts.add(this); probe.contexts++; }
        probe.drawCalls++; probe.lastDrawAt = performance.now();
        probe.methods[name] = (probe.methods[name] || 0) + 1;
        return returned;
      }});
    }
  }
})();`;
const readCode=`(() => ({store:JSON.parse(localStorage.getItem('orbital-campaign-v3')||'null'),probe:window.__pausedSceneDrawProbe}))()`;
async function read(){return await page.evaluate(readCode);}
async function snapshot(label:string){
  const data=await read();
  assert.equal(data.store?.session?.state.paused,true,"This gate never resumes the flight.");
  const screenshot=join(out,label+".png");await page.screenshot({path:screenshot,timeout:60000});
  await writeFile(join(out,label+"-state.json"),JSON.stringify(data.store,null,2));
  await context.storageState({path:join(out,label+"-storage.json")});
  result.phases.push({label,observedUtc:new Date().toISOString(),probe:data.probe,screenshot});await persist();return data;
}
async function idle(label:string,quietMs=1400,timeoutMs=20000){
  let last=-1,stableSince=Date.now();const started=Date.now();
  while(Date.now()-started<timeoutMs){
    const current=await read();
    if(current.probe.drawCalls!==last){last=current.probe.drawCalls;stableSince=Date.now();}
    else if(Date.now()-stableSince>=quietMs)return current;
    await page.waitForTimeout(200);
  }
  throw new Error(`${label}: paused native draw calls did not become idle`);
}
async function bounded(promise:Promise<void>,label:string){
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{await Promise.race([promise,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error(label)),30000);})]);}
  finally{if(timer)clearTimeout(timer);}
}
function conserved(before:any,after:any){
  assert.deepEqual(after.store.session,before.store.session,"Exact paused session, including resources/pose/goals/pressure/wear, is conserved.");
  assert.deepEqual(after.store.progress,before.store.progress,"Earned scores, finance, inventory and campaigns are conserved.");
}
try{
  context=await browser.newContext({viewport:result.viewport,deviceScaleFactor:result.deviceScaleFactor,storageState:resolve(savePath),serviceWorkers:"block"});
  await context.addInitScript(probeScript);
  await context.route("**/*",async(route:any)=>{
    const url=route.request().url(),path=new URL(url).pathname;
    if(new URL(url).origin===origin&&/\/assets\/world-[^/]+\.js$/.test(path)){
      result.requests.push({kind:"field-module",url,heldUtc:new Date().toISOString()});fieldRequested.resolve();
      await fieldGate.promise;await route.continue();return;
    }
    if(textureBytes&&url===assetManifest.earth.runtimeUrl){
      result.requests.push({kind:"optional-Earth-image-network-stub",url,heldUtc:new Date().toISOString()});textureRequested.resolve();
      await textureGate.promise;await route.fulfill({status:200,contentType:"image/png",headers:{"Access-Control-Allow-Origin":"*"},body:textureBytes});textureResponses++;return;
    }
    // Keep unrelated optional downloads from causing an uncontrolled late frame.
    // Their offline fallbacks remain the product's ordinary code path.
    if(new URL(url).origin!==origin){await route.abort("blockedbyclient");return;}
    await route.continue();
  });
  page=await context.newPage();page.setDefaultTimeout(30000);
  page.on("pageerror",(error:Error)=>result.pageErrors.push(error.message));
  page.on("response",(response:any)=>{if(new URL(response.url()).origin===origin&&/\/assets\/world-[^/]+\.js$/.test(new URL(response.url()).pathname)){
    void response.finished().then(()=>{fieldResponses++;});
  }});
  await page.goto(base,{waitUntil:"domcontentloaded"});
  await page.getByRole("button",{name:"ENTER COMMANDER",exact:true}).click();
  await page.getByRole("button",{name:/^Laptop /}).click();
  await page.getByRole("button",{name:"Continue →",exact:true}).click();
  await page.getByRole("button",{name:`Open ${campaign.name} campaign levels`,exact:true}).click();
  await page.getByRole("button",{name:"Resume mission →",exact:true}).click();
  await page.locator(".cmd-canvas canvas").waitFor();
  await bounded(fieldRequested.promise,"Production field chunk was not requested; this gate needs a cold lazy-module load.");
  await page.waitForFunction("window.__pausedSceneDrawProbe.drawCalls > 0");
  const before=await idle("initial locked frame");
  assert.equal(fieldResponses,0,"Field chunk is genuinely held until the first paused frame is idle.");
  assert.equal(before.store.session.id,session.id);assert.equal(before.store.session.objective,session.objective);
  assert.deepEqual(before.store.session.completed,session.completed);assert.deepEqual(before.store.session.position,session.position);
  await snapshot("01-before-field-module");
  fieldGate.resolve();
  const deliveryStarted=Date.now();while(fieldResponses===0&&Date.now()-deliveryStarted<30000)await page.waitForTimeout(100);
  assert.ok(fieldResponses>0,"The real field-module response completed.");
  if(!negative)await page.waitForFunction(`window.__pausedSceneDrawProbe.drawCalls > ${before.probe.drawCalls}`,{},{timeout:30000});
  else await page.waitForTimeout(3000);
  const after=await idle("field arrival");conserved(before,after);
  if(negative)assert.equal(after.probe.drawCalls,before.probe.drawCalls,"Negative control reproduces the missing paused redraw.");
  else assert.ok(after.probe.drawCalls>before.probe.drawCalls,"Accepted field construction causes a real native GL redraw without Resume/resize.");
  await snapshot("02-after-field-module");
  result.fieldModule={responseCompleted:true,drawCallsBefore:before.probe.drawCalls,drawCallsAfter:after.probe.drawCalls,
    exactPausedStateConserved:true,returnsToIdle:true};
  if(negative&&process.env.CAPTURE_NEGATIVE_RESIZE_RECOVERY==="1"){
    // Preserve the stale-frame proof above, then record its ordinary resize
    // recovery for a matched visual comparison. This is a diagnostic only;
    // fixed acceptance still requires redraw without Resume or resize.
    await page.setViewportSize({width:800,height:600});
    await page.waitForFunction(`window.__pausedSceneDrawProbe.drawCalls > ${after.probe.drawCalls}`);
    const enlarged=await idle("negative enlarged viewport");conserved(before,enlarged);
    await page.setViewportSize(result.viewport);
    await page.waitForFunction(`window.__pausedSceneDrawProbe.drawCalls > ${enlarged.probe.drawCalls}`);
    const recovered=await idle("negative resize diagnostic");conserved(before,recovered);
    await snapshot("04-negative-resize-recovery");
    result.negativeResizeRecovery={diagnosticOnly:true,restoredViewport:result.viewport,
      drawCalls:recovered.probe.drawCalls,exactPausedStateConserved:true};
  }
  if(textureBytes){
    await bounded(textureRequested.promise,"The chosen genuine EVA context did not request its optional Earth image.");
    const beforeTexture=await idle("before optional texture");textureGate.resolve();
    if(!negative)await page.waitForFunction(`window.__pausedSceneDrawProbe.drawCalls > ${beforeTexture.probe.drawCalls}`,{},{timeout:30000});
    else await page.waitForTimeout(3000);
    const afterTexture=await idle("texture arrival");conserved(before,afterTexture);
    if(negative)assert.equal(afterTexture.probe.drawCalls,beforeTexture.probe.drawCalls);
    else assert.ok(afterTexture.probe.drawCalls>beforeTexture.probe.drawCalls,"Accepted valid texture also redraws the paused scene.");
    assert.ok(textureResponses>0);await snapshot("03-after-optional-texture");
    result.optionalTexture={declaredNetworkStub:true,responses:textureResponses,drawCallsBefore:beforeTexture.probe.drawCalls,
      drawCallsAfter:afterTexture.probe.drawCalls,exactPausedStateConserved:true,returnsToIdle:true};
  }
  const final=await idle("final idle");conserved(before,final);
  assert.deepEqual(result.pageErrors,[]);result.status=negative?"REPRODUCED_STALE_FRAME":"PASS";
  result.finishedUtc=new Date().toISOString();await persist();console.log(`${result.status} paused scene gate: ${out}`);
}catch(error){
  result.status="FAIL";result.error=String(error instanceof Error?error.stack:error);
  if(page)await snapshot("FAILURE").catch(()=>{});await persist();throw error;
}finally{
  fieldGate.resolve();textureGate.resolve();await context?.close().catch(()=>{});await browser.close();
}

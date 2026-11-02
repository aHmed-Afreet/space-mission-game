import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as T from "three";
import { assetManifest, selectPlanetMap, planetaryAssetFiles, backgroundAssetFiles, type PlanetMapQuality } from "./presentation/assetManifest";
import { makePlanet, disposePlanet } from "./commander/celestial";
import { createInterior } from "./commander/interior";
import { createFieldWorld } from "./commander/campaign/world";
import { createStoryScene } from "./history/storyWorld";
import { createStoryScenario } from "./history/storyScenarios";
import { historyMissions } from "./history/missionHistory";
import { disposeObjectResources } from "./presentation/resources";
import { offline } from "../vite.config";

// Independent download-review facts, not hashes computed from the implementation.
const originals = [
  { file:"earth-bluemarble-svs2915-1024-d1d3cb36ae6a.png", bytes:444710, width:1024, height:512, sha:"d1d3cb36ae6ae452c43cdf7ae0ffc13a959e8a5a2358f58b05e5f623c15119f9" },
  { file:"earth-bluemarble-svs2915-2048-ae6214b078ed.png", bytes:1511379, width:2048, height:1024, sha:"ae6214b078ed0864c96f74bcb10ae3021f6eb116f8059797efe0fa9ea8b89d35" },
  { file:"moon-lroc-svs4720-2019-1024-b246064f217f.jpg", bytes:139068, width:1024, height:512, sha:"b246064f217f8d479df78c49c7c8595a8f5fbda008a72fd539978d2e121e0109" },
  { file:"moon-lroc-svs4720-2025-2048-f7130a182268.jpg", bytes:457942, width:2048, height:1024, sha:"f7130a1822681fa7512d7dcfd40db8c10b9ba4f06777910348698260ed7a2170" },
] as const;

function dimensions(bytes:Buffer):[number,number] {
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
    assert.equal(bytes.subarray(12,16).toString(),"IHDR");
    return [bytes.readUInt32BE(16),bytes.readUInt32BE(20)];
  }
  assert.equal(bytes.readUInt16BE(0),0xffd8,"JPEG SOI");
  let cursor=2;
  while(cursor<bytes.length) {
    assert.equal(bytes[cursor++],0xff,"JPEG segment boundary");
    while(bytes[cursor]===0xff)cursor++;
    const marker=bytes[cursor++];
    if(marker===0xd9||marker===0xda)throw Error("Missing JPEG SOF before scan");
    if(marker===0x01||marker===0xd8||(marker>=0xd0&&marker<=0xd7))continue;
    const length=bytes.readUInt16BE(cursor);assert.ok(length>=2&&cursor+length<=bytes.length);
    if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))
      return [bytes.readUInt16BE(cursor+5),bytes.readUInt16BE(cursor+3)];
    cursor+=length;
  }
  throw Error("JPEG SOF unavailable");
}

test("shared ISS backdrop preserves the reviewed NASA derivative, dimensions and offline credit",()=>{
  const asset=assetManifest.background,bytes=readFileSync(resolve("public",asset.runtimeUrl));
  assert.equal(bytes.length,259633);
  assert.equal(createHash("sha256").update(bytes).digest("hex"),"357943e89d200bca5ff9f95983e1e94f58a49fa58fa7493c698f48ee02a60e4a");
  assert.deepEqual(dimensions(bytes),[1920,1277]);
  assert.equal(asset.bytes,bytes.length);assert.deepEqual(asset.dimensions,[1920,1277]);
  assert.equal(asset.sha256,createHash("sha256").update(bytes).digest("hex"));
  const credit=readFileSync("public/assets/backgrounds/ATTRIBUTION.txt","utf8");
  for(const value of ["NASA/JSC / Kate Rubins","iss049e004248",asset.sourceUrl,asset.policy,asset.sha256])
    assert.ok(credit.includes(value),`Offline attribution retains ${value}`);
  assert.equal(new URL(asset.runtimeUrl,"https://example.test/game/").pathname,"/game/assets/backgrounds/iss049e004248-1920-357943e89d20.jpg");
});

for(const expected of originals) test(`${expected.file} preserves the reviewed original bytes and real raster dimensions`,()=>{
  const bytes=readFileSync(resolve("public/assets/planetary",expected.file));
  assert.equal(bytes.length,expected.bytes);
  assert.equal(createHash("sha256").update(bytes).digest("hex"),expected.sha);
  assert.deepEqual(dimensions(bytes),[expected.width,expected.height],"Use PNG IHDR/JPEG SOF, not inherited source EXIF dimensions");
  const entries=[...Object.values(assetManifest.earth.variants),...Object.values(assetManifest.moon.variants)];
  const entry=entries.find(item=>item.runtimeUrl.endsWith(expected.file));assert.ok(entry);
  assert.equal(entry.sha256,expected.sha);assert.equal(entry.bytes,expected.bytes);
  assert.deepEqual(entry.dimensions,[expected.width,expected.height]);
  assert.equal(new URL(entry.runtimeUrl,"https://example.test/game/").pathname,`/game/assets/planetary/${expected.file}`,"Subpath deployment stays inside its base");
});

test("map tiers retain distinct Moon versions and a bounded default/Story texture budget",()=>{
  for(const body of ["earth","moon"] as const) {
    assert.equal(selectPlanetMap(body),assetManifest[body].variants.standard);
    for(const quality of ["battery","balanced"] as const)assert.equal(selectPlanetMap(body,quality),assetManifest[body].variants.standard);
    assert.equal(selectPlanetMap(body,"quality"),assetManifest[body].variants.quality);
    assert.deepEqual(selectPlanetMap(body).dimensions,[1024,512]);
    assert.deepEqual(selectPlanetMap(body,"quality").dimensions,[2048,1024]);
    assert.equal(selectPlanetMap(body).dimensions[0]*selectPlanetMap(body).dimensions[1]*4,2*1024*1024,"Conservative RGBA8 default storage, before mipmaps");
  }
  assert.match(selectPlanetMap("moon").version,/2019/);
  assert.match(selectPlanetMap("moon","quality").version,/2025/);
  assert.notEqual(selectPlanetMap("moon").sha256,selectPlanetMap("moon","quality").sha256);
  assert.match(assetManifest.earth.use,/not pure quantitative albedo/);
  assert.match(assetManifest.moon.use,/not identical pixels at different resolutions/);
});

function withCanvas(run:()=>void) {
  const previous=globalThis.document;
  const context=new Proxy({
    createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)}),
    createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),
    measureText:()=>({width:100}),
  } as Record<string,unknown>,{get:(target,key)=>target[String(key)]??(()=>{})});
  globalThis.document={
    createElement:()=>({width:0,height:0,getContext:()=>context}),
    createElementNS:()=>({addEventListener(){},removeEventListener(){},set src(_value:string){}}),
  } as unknown as Document;
  try{run();}finally{
    if(previous===undefined)delete (globalThis as {document?:Document}).document;
    else globalThis.document=previous;
  }
}

for(const quality of ["battery","balanced","quality"] as PlanetMapQuality[]) {
  test(`${quality} actual planet, cabin and field loaders request only their selected local map`,()=>withCanvas(()=>{
    const load=T.TextureLoader.prototype.load,requests:string[]=[];
    T.TextureLoader.prototype.load=function(url,onLoad) {
      requests.push(url);const texture=new T.Texture<HTMLImageElement>();onLoad?.(texture);return texture;
    };
    try {
      const direct=makePlanet("earth",2,false,undefined,quality);
      const cabin=createInterior({destination:"moon",graphics:quality});
      const orbital=createFieldWorld(new T.Scene(),"earth","mission-2",quality);
      const lunar=createFieldWorld(new T.Scene(),"moon","mission-3",quality);
      assert.deepEqual(requests,[
        selectPlanetMap("earth",quality).runtimeUrl,selectPlanetMap("moon",quality).runtimeUrl,
        selectPlanetMap("earth",quality).runtimeUrl,selectPlanetMap("earth",quality).runtimeUrl,
      ],"Actual TextureLoader calls include the cabin, orbital Earth and lunar horizon Earth");
      assert.ok(requests.every(url=>url.startsWith("./assets/planetary/")&&!url.includes("github")));
      disposePlanet(direct);cabin.dispose();orbital.dispose();lunar.dispose();
    } finally { T.TextureLoader.prototype.load=load; }
  }));
}

test("default Story-compatible planet calls use local 1k maps and failed loads retain the generated fallback",()=>withCanvas(()=>{
  const load=T.TextureLoader.prototype.load,requests:string[]=[];
  T.TextureLoader.prototype.load=function(url,_onLoad,_onProgress,onError) {
    requests.push(url);onError?.(Error("Declared missing-local-image fixture"));return new T.Texture<HTMLImageElement>();
  };
  try {
    for(const body of ["earth","moon"] as const) {
      const planet=makePlanet(body,2,false);
      const material=(planet.children[0] as T.Mesh).material as T.MeshStandardMaterial;
      assert.ok(material.map instanceof T.CanvasTexture,"Error path keeps the actual generated map");
      let disposed=0;material.map.addEventListener("dispose",()=>disposed++);
      disposePlanet(planet);disposePlanet(planet);assert.equal(disposed,1);
    }
    assert.deepEqual(requests,[assetManifest.earth.runtimeUrl,assetManifest.moon.runtimeUrl]);
  } finally { T.TextureLoader.prototype.load=load; }
}));

test("actual orbital and lunar Story scenes keep their default local 1k Earth maps",()=>withCanvas(()=>{
  const load=T.TextureLoader.prototype.load,requests:string[]=[];
  T.TextureLoader.prototype.load=function(url,onLoad) {
    requests.push(url);const texture=new T.Texture<HTMLImageElement>();onLoad?.(texture);return texture;
  };
  try {
    for(const title of ["Gemini 4","Apollo 11"]) {
      const mission=historyMissions.find(item=>item.title===title);assert.ok(mission);
      const scene=createStoryScene(createStoryScenario(mission));
      disposeObjectResources(scene.scene);disposeObjectResources(scene.suitView);
    }
    assert.ok(requests.length>=3,"Both orbital views and the lunar Earth horizon really load imagery");
    assert.ok(requests.every(url=>url===assetManifest.earth.runtimeUrl),"Story has no accidental Quality/2048 or old remote requests");
  } finally { T.TextureLoader.prototype.load=load; }
}));

test("generated offline worker precaches all map tiers and credits alongside existing app and lazy entries",async()=>{
  const emitted:{fileName?:string;source?:string|Uint8Array}[]=[];
  const hook=offline().generateBundle;
  if(typeof hook!=="function")throw Error("Expected the actual callable offline generation hook");
  await hook.call({emitFile(asset:typeof emitted[number]){emitted.push(asset);return asset.fileName;}} as any,
    {} as any,{"index.html":{},"assets/Commander.js":{},"assets/HistoryHub.js":{}} as any,false);
  assert.equal(emitted.length,1);assert.equal(emitted[0].fileName,"sw.js");
  const source=String(emitted[0].source),prefix="const FILES=",start=source.indexOf(prefix)+prefix.length;
  assert.ok(start>=prefix.length);const end=source.indexOf(";const STATIC",start);assert.ok(end>start);
  const files=JSON.parse(source.slice(start,end)) as string[];
  for(const path of [...backgroundAssetFiles,...planetaryAssetFiles,"./","./index.html","./privacy.html","./manifest.webmanifest",
    "./icons/icon-192.png","./icons/icon-512.png","./icons/apple-touch-icon.png","./assets/Commander.js","./assets/HistoryHub.js"])
    assert.ok(files.includes(path),`Actual generated worker retains ${path}`);
  for(const path of [...backgroundAssetFiles,...planetaryAssetFiles])assert.ok(readFileSync(resolve("public",path)).length>0,`${path} really exists`);
  const credits=readFileSync("public/assets/planetary/ATTRIBUTION.txt","utf8");
  for(const word of ["Reto Stockli","Ernie Wright","Arizona State University","2019","2025","public domain","endorsement"])
    assert.ok(credits.includes(word),`Offline-readable credit retains ${word}`);
});

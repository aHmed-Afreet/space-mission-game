import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {visibleMissionHeight} from "./missionViewport";
const guard=readFileSync("src/missionViewport.ts","utf8");
const story=readFileSync("src/history/StoryFlight.tsx","utf8");
const flight=readFileSync("src/commander/campaign/Flight.tsx","utf8");
const storyCss=readFileSync("src/history/storyFlight.css","utf8");
const flightCss=readFileSync("src/commander/campaign/campaign.css","utf8");
test("iPad visual viewport, not scrolling document, determines mission height",()=>{
 assert.equal(visibleMissionHeight(697,825),697);
 assert.equal(visibleMissionHeight(501,810),501);
 assert.equal(visibleMissionHeight(undefined,810),810);
 assert.equal(visibleMissionHeight(120,810),810);
 assert.match(guard,/visualViewport\?\.height/);
 assert.match(guard,/--mission-visible-height/);
});
test("3D Commander and Apollo historical scenes lock the document and clean up",()=>{
 assert.match(story,/useLayoutEffect\(\(\)=>lockMissionViewport\(\),\[\]\)/);
 assert.match(flight,/useLayoutEffect\(\(\)=>lockMissionViewport\(\),\[\]\)/);
 assert.match(guard,/body\.style\.position="fixed"/);
 assert.match(guard,/root\.style\.minHeight="0"/);
 assert.match(guard,/html\.classList\.remove\("mission-viewport-locked"\)/);
 assert.match(guard,/window\.scrollTo\(scrollX,scrollY\)/);
 for(const css of [storyCss,flightCss]){
   assert.match(css,/html\.mission-viewport-locked/);
   assert.match(css,/height:var\(--mission-visible-height,100dvh\)!important/);
 }
});
test("3D gestures cannot scroll the page but panels remain scrollable",()=>{
 assert.match(guard,/document\.addEventListener\("touchmove",stopDocumentPan,\{capture:true,passive:false\}\)/);
 assert.match(guard,/document\.addEventListener\("wheel",stopDocumentPan,\{capture:true,passive:false\}\)/);
 assert.match(guard,/el\.scrollHeight>el\.clientHeight\+1/);
 assert.match(guard,/if\(scrollable\(event\.target\)\)return/);
 assert.match(guard,/document\.removeEventListener\("touchmove",stopDocumentPan,true\)/);
 assert.match(storyCss,/\.story-fps-dialog/);
});
test("realism enhancement preserves performant instancing and six playable buildings",()=>{
 const scene=readFileSync("src/outpost/World3D.tsx","utf8");
 const buildings=readFileSync("src/outpost/architectures.ts","utf8");
 assert.match(scene,/PlaneGeometry\(230,230,88,88\)/);
 assert.match(scene,/planeGeo\.computeVertexNormals\(\)/);
 assert.match(scene,/createRegolithMaterial\(session.destination,55\)/);
 const assets=readFileSync("src/presentation/realismAssets.ts","utf8");
 assert.match(assets,/normalMap: load\("normal"\)/);
 assert.match(assets,/roughnessMap: load\("roughness"\)/);
 assert.match(scene,/batchOutpostStructure/);
 assert.match(assets,/map: load\("base", true\)/);
 assert.match(scene,/new T\.InstancedMesh\(/);
 assert.match(scene,/MeshPhysicalMaterial/);
 assert.match(scene,/Back-mounted|Pressure pack/);
 assert.match(buildings,/exteriorDetails\(kit,group,id,facility\.radius\)/);
 for(const key of ["habitat","solar","shield","recycle","greenhouse","battery"]){
   assert.match(buildings,new RegExp('case "'+key+'"'));
 }
});

import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import * as T from "three";
import {terrainRelief, installSurfaceScenery} from "./surfaceScenery";

// Simple canvas stand-in for Three.js geometry tests. Rendering fidelity still
// requires a real device/browser; these tests verify procedural construction.
function fakeCanvas(){
  return {
    width:0,height:0,
    getContext(){
      return {
        fillStyle:"",strokeStyle:"",lineWidth:1,
        createImageData(w:number,h:number){return {data:new Uint8ClampedArray(w*h*4),width:w,height:h};},
        putImageData(){},fillRect(){},beginPath(){},arc(){},fill(){},
        createLinearGradient(){return {addColorStop(){}};},
      };
    },
  };
}
test("terrain relief stays smooth and finite across all playable field sites",()=>{
  for(let x=-25;x<=25;x+=2.5)for(let z=-8;z<=48;z+=3.5){
    assert.ok(Number.isFinite(terrainRelief(x,z)));
    assert.ok(Math.abs(terrainRelief(x,z))<.55);
  }
  // The central player corridor is flat enough that there are no fake walls.
  for(let x=-2;x<=2;x+=1)for(let z=-3;z<14;z+=2)
    assert.ok(Math.abs(terrainRelief(x,z)+.115)<.09);
});
test("surface scenery builds offline with geometry detail tiers and disposes",()=>{
  const previous=(globalThis as {document?:unknown}).document;
  (globalThis as {document?:unknown}).document={createElement:()=>fakeCanvas()};
  try{
    const counts:number[]=[];
    for(const graphics of ["battery","balanced","quality"] as const){
      const group=new T.Group();
      const effect=installSurfaceScenery(group,"mars",[{x:0,z:20},{x:4,z:25}],graphics);
      const rocks=group.children.find(c=>c instanceof T.InstancedMesh && c.count>=40) as T.InstancedMesh;
      assert.ok(rocks);
      counts.push(rocks.count);
      assert.ok(group.children.some(c=>c instanceof T.Mesh && c.geometry instanceof T.PlaneGeometry));
      assert.ok(group.children.some(c=>c instanceof T.DirectionalLight));
      assert.ok(group.children.some(c=>c instanceof T.Mesh && c.geometry instanceof T.SphereGeometry));
      assert.doesNotThrow(()=>effect.dispose());
    }
    assert.deepEqual(counts,[40,135,225]);
  }finally{
    if(previous===undefined)delete (globalThis as {document?:unknown}).document;
    else (globalThis as {document?:unknown}).document=previous;
  }
});
test("new visuals never change mission object IDs, collision rules, or iPad controls",()=>{
  const cabin=readFileSync("src/commander/Cabin.tsx","utf8");
  const world=readFileSync("src/commander/campaign/world.ts","utf8");
  const interior=readFileSync("src/commander/interior.ts","utf8");
  const surface=readFileSync("src/commander/campaign/surfaceScenery.ts","utf8");
  const cockpit=readFileSync("src/commander/cockpitFinishing.ts","utf8");
  assert.match(world,/surfaceScenery=installSurfaceScenery/);
  assert.match(world,/surfaceScenery\?\.dispose\(\)/);
  assert.match(cabin,/props\.world!\.session\.missionId,\s*graphicsMode/);
  assert.match(cabin,/renderer\.setPixelRatio\(renderRatio\)/);
  assert.match(cabin,/campaignWalkable\(/);
  assert.match(interior,/disposeCockpitFinishing\(\)/);
  assert.match(cockpit,/InstancedMesh/);
  assert.match(surface,/texture\.repeat\.set\(10,10\)/);
  assert.doesNotMatch(surface,/https?:\/\//);
  assert.doesNotMatch(cockpit,/https?:\/\//);
});

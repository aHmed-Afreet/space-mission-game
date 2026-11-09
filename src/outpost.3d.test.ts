import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {BASE_FACILITIES,clampWalk,doorPosition,doorwayCrossed,nearestDoor,nearConsole,nearExit,walkStep,distance} from "./outpost/worldLogic";
import {initialOutpost,missionScore,perform,advanceSol,missionCriteria} from "./outpost/engine";

test("six distinct 3D facilities have approachable physical airlocks",()=>{
 assert.equal(BASE_FACILITIES.length,6);
 assert.equal(new Set(BASE_FACILITIES.map(f=>f.id)).size,6);
 for(const f of BASE_FACILITIES){
   const entrance=doorPosition(f);
   assert.equal(nearestDoor(entrance)?.id,f.id);
   assert.ok(distance(entrance,{x:f.x,z:f.z})>f.radius-.1);
 }
});

test("walls stop walking through a closed facility, but an opened airlock allows crossing",()=>{
 const f=BASE_FACILITIES[0],door=doorPosition(f);
 const wall=clampWalk({x:f.x,z:f.z},false,null);
 assert.ok(distance(wall,{x:f.x,z:f.z})>=f.radius-.33);
 const open=clampWalk({x:f.x,z:f.z},false,f.id);
 assert.deepEqual(open,{x:f.x,z:f.z});
 assert.equal(doorwayCrossed(open,f.id),true);
 assert.equal(doorwayCrossed(door,f.id),false);
});

test("walking and turning produces consistent bounded avatar locomotion",()=>{
 const origin={x:0,z:0};
 const toward=walkStep(origin,0,0,1,.06,false,null);
 assert.ok(toward.z<0);
 const strafe=walkStep(origin,0,1,0,.06,false,null);
 assert.ok(strafe.x>0);
 const rotated=walkStep(origin,Math.PI/2,0,1,.06,false,null);
 assert.ok(rotated.x<0);
 const bound=clampWalk({x:900,z:-900},false,null);
 assert.ok(Math.abs(bound.x)<=29 && Math.abs(bound.z)<=29);
});

test("interior console and exit require proximity instead of any arbitrary tap",()=>{
 assert.equal(nearConsole({x:0,z:-2.6}),true);
 assert.equal(nearExit({x:0,z:-2.6}),false);
 assert.equal(nearExit({x:0,z:3.85}),true);
 assert.equal(nearConsole({x:0,z:3.85}),false);
});

test("old failed mission's misleading 80/100 is now capped at 39",()=>{
 const sample={...initialOutpost("moon"),phase:"lost" as const,sol:11,
   safety:74,oxygen:47,water:13,food:13,battery:0,shielding:3,foodProduced:0,radiation:22};
 const score=missionScore(sample);
 assert.ok(score>=0 && score<=39,"failure must never appear as near-success: "+score);
 assert.equal(missionScore(initialOutpost("moon")),0,"no score for just launching game");
});

test("a successful ten-sol outpost receives a meaningful, resource-dependent score",()=>{
 const good={...initialOutpost("moon"),phase:"won" as const,sol:11,
  safety:93,oxygen:79,water:65,food:70,battery:40,shielding:2,foodProduced:44,radiation:23};
 const weaker={...good,battery:16,water:14,food:20,safety:63,radiation:42};
 assert.ok(missionCriteria(good).every(x=>x.met));
 assert.ok(missionScore(good)>=70 && missionScore(good)<=100);
 assert.ok(missionScore(weaker)<missionScore(good),"stronger resource management should rank higher");
});

test("3D world is true WebGL, not a 2D facade or another clickable image",()=>{
 const world=readFileSync("src/outpost/World3D.tsx","utf8");
 const ui=readFileSync("src/outpost/Junior3D.tsx","utf8");
 const entry=readFileSync("src/outpost/JuniorOutpost.tsx","utf8");
 assert.match(world,/new T\.WebGLRenderer/);
 assert.match(world,/PerspectiveCamera/);
 assert.match(world,/T\.DirectionalLight/);
 assert.match(world,/InstancedMesh/);
 assert.match(world,/createScene/);
 assert.match(world,/doorwayCrossed/);
 assert.match(world,/nearConsole/);
 assert.match(world,/walkStep/);
 assert.match(world,/renderer\.render/);
 assert.match(world,/touch-action:none|touchAction|pointerdown/i);
 assert.match(ui,/World3D/);
 assert.match(ui,/Stick/);
 assert.match(ui,/onConsole/);
 assert.match(ui,/onEnter/);
 assert.match(ui,/missionScore/);
 assert.match(ui,/CHOOSE ANOTHER PLANET/);
 assert.match(entry,/Junior3D/);
 assert.doesNotMatch(ui,/FacilityScene\>/,"2D schematic must not be the active world");
});

test("unchanged v2 save keys preserve older Moon, Mars and other game modes",()=>{
 const engine=readFileSync("src/outpost/engine.ts","utf8");
 const ui=readFileSync("src/outpost/Junior3D.tsx","utf8");
 assert.match(engine,/export const GAME_KEY = "orbital-junior-outpost-v2"/);
 assert.match(ui,/migrateOutpost/);
 assert.match(ui,/LEGACY_GAME_KEY/);
 assert.match(ui,/localStorage\.setItem\(GAME_KEY/);
 assert.match(ui,/window\.confirm/);
});

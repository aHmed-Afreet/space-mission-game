import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {advanceSol,crewMealStatus,crewSleepStatus,eatCrewMeal,initialOutpost,perform,migrateOutpost} from "./outpost/engine";
import {BASE_FACILITIES,exteriorDoorYaw,exteriorDoorSpawn,HABITAT_WAKE,nearHabitatRoutine,clampWalk,distance} from "./outpost/worldLogic";

test("daily breakfast, engineering, dinner and sleep create a complete repeatable crew day",()=>{
 const start=initialOutpost("moon");
 assert.equal(crewSleepStatus(start).ok,false);
 assert.equal(crewMealStatus(start,"dinner").ok,false);
 const breakfast=eatCrewMeal(start,"breakfast");
 assert.equal(breakfast.breakfastSol,1);
 assert.equal(breakfast.food,start.food,"meal click must not double-charge food");
 assert.equal(eatCrewMeal(breakfast,"breakfast"),breakfast,"breakfast is once per day");
 assert.equal(crewMealStatus(breakfast,"dinner").ok,false,"mission must be completed before dinner");
 const worked=perform(breakfast,"monitor");
 assert.equal(crewSleepStatus(worked).ok,false);
 const dinner=eatCrewMeal(worked,"dinner");
 assert.equal(dinner.dinnerSol,1);
 assert.equal(dinner.food,start.food);
 assert.equal(eatCrewMeal(dinner,"dinner"),dinner,"dinner is once per day");
 assert.equal(crewSleepStatus(dinner).ok,true);
 const next=advanceSol(dinner);
 const baseline=advanceSol(perform(start,"monitor"));
 assert.equal(next.sol,2);
 assert.equal(next.food,baseline.food,"daily food consumed only in existing advanceSol accounting");
 assert.equal(crewMealStatus(next,"breakfast").ok,true,"each new sol offers new breakfast");
 assert.equal(crewSleepStatus(next).ok,false,"new sol requires new routine");
});

test("crew cannot sleep through an unresolved emergency",()=>{
 const start={...initialOutpost("moon"),sol:3};
 const breakfast=eatCrewMeal(start,"breakfast");
 const work=perform(breakfast,"monitor");
 const dinner=eatCrewMeal(work,"dinner");
 assert.equal(crewSleepStatus(dinner).ok,false);
 assert.match(crewSleepStatus(dinner).message,/emergency/i);
});

test("old v2 save loads without new optional meal flags",()=>{
 const saved=initialOutpost("mars");
 const migrated=migrateOutpost(JSON.parse(JSON.stringify(saved)));
 assert.ok(migrated);
 assert.equal(migrated.breakfastSol,undefined);
 assert.equal(migrated.dinnerSol,undefined);
 assert.equal(crewMealStatus(migrated,"breakfast").ok,true);
});

test("all six airlocks spawn facing AWAY from the building",()=>{
 for(const f of BASE_FACILITIES){
  const pos=exteriorDoorSpawn(f.id),yaw=exteriorDoorYaw(f.id);
  const vx=-Math.sin(yaw),vz=-Math.cos(yaw);
  const dx=pos.x-f.x,dz=pos.z-f.z;
  assert.ok((vx*dx+vz*dz)/Math.hypot(dx,dz)>.999,f.id+" faced back at entrance");
  assert.ok(distance(pos,{x:0,z:0})>4);
 }
});
test("the habitat wake-up location and its two stations are reachable",()=>{
 assert.deepEqual(clampWalk(HABITAT_WAKE,true,null),HABITAT_WAKE);
 assert.equal(nearHabitatRoutine({x:-2.75,z:.75}),"sleep");
 assert.equal(nearHabitatRoutine({x:2.55,z:1.35}),"meal");
 assert.equal(nearHabitatRoutine({x:0,z:0}),null);
});

test("real 3D bed/dining control interactions and forced day respawn are wired",()=>{
 const three=readFileSync("src/outpost/World3D.tsx","utf8");
 const app=readFileSync("src/outpost/Junior3D.tsx","utf8");
 const interiors=readFileSync("src/outpost/architectures.ts","utf8");
 assert.match(three,/latest\.current\.onRoutine\(routine\)/);
 assert.match(three,/scene\.astro\.rotation\.y=Math\.atan2/);
 assert.match(three,/nearHabitatRoutine\(state\.position\)/);
 assert.match(app,/onRoutine=\{routineInteraction\}/);
 assert.match(app,/key=\{session\.sol\+"-"\+\(room\?\?"surface"\)\}/);
 assert.match(app,/exteriorDoorYaw\(previous\)/);
 assert.match(app,/crewSleepStatus\(session\)/);
 assert.match(app,/eatCrewMeal\(session,meal\)/);
 assert.match(app,/spawn\.current=\{position:\{\.\.\.HABITAT_WAKE\}/);
 assert.match(interiors,/dining|Dining|kitchenette/i);
 assert.match(interiors,/Bunks|bunks|sleeping/i);
});

test("iPad action controls are anchored to a reliable ON-SCREEN TOP, never a clipped bottom",()=>{
 const css=readFileSync("src/outpost/world3d.css","utf8");
 assert.match(css,/html\.outpost-viewport-locked \.j3-root \.j3-controls \.j3-buttons\{[\s\S]*?top:clamp\(160px,28vh,290px\)!important/);
 assert.match(css,/bottom:auto!important/);
 assert.match(css,/html\.outpost-viewport-locked \.j3-root \.j3-controls \.j3-move-zone/);
 const app=readFileSync("src/outpost/Junior3D.tsx","utf8");
 assert.match(app,/>RUN<\/button>/);
 assert.match(app,/>INTERACT<\/button>/);
 assert.doesNotMatch(app,/FINISH DAY \{session\.sol\}/,"day must end at the bed, not a hidden extra button");
});

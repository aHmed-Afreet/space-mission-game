import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {BASE_FACILITIES,doorPosition} from "./outpost/worldLogic";
import {FACILITY_GUIDE,missionDestination,compassDirection,destinationGuide} from "./outpost/navigation";
import {chooseIncident,initialOutpost,type Destination} from "./outpost/engine";
import {dayBrief} from "./outpost/missionFlow";

test("every walkable building has grounded purpose, operation and entrance guidance",()=>{
 assert.equal(BASE_FACILITIES.length,6);
 for(const f of BASE_FACILITIES){
   assert.ok(FACILITY_GUIDE[f.id].purpose.length>=30,f.id);
   assert.ok(FACILITY_GUIDE[f.id].task.length>=30,f.id);
   const pos=doorPosition(f);
   const info=destinationGuide(pos,null,f.id);
   assert.match(info.title,/OPEN .* AIRLOCK/);
   assert.equal(info.direction,"HERE");
   assert.equal(info.distance,Math.round(0));
 }
});

test("outpost map gives consistent bearings and clear route descriptions",()=>{
 const p={x:0,z:0};
 assert.equal(compassDirection(p,{x:0,z:-16}),"N");
 assert.equal(compassDirection(p,{x:16,z:0}),"E");
 assert.equal(compassDirection(p,{x:0,z:16}),"S");
 assert.equal(compassDirection(p,{x:-16,z:0}),"W");
 assert.equal(compassDirection(p,{x:0,z:1}),"HERE");
 for(const f of BASE_FACILITIES){
   const route=destinationGuide(p,null,f.id);
   assert.match(route.title,/GO TO|OPEN/);
   assert.ok(route.description.length>30);
 }
 assert.match(destinationGuide(p,"habitat","solar").title,/EXIT TO THE SURFACE/);
 assert.match(destinationGuide(p,"solar","solar").title,/CONTROL CONSOLE/);
});

test("all ten days give a clear location and map destination on Moon and Mars",()=>{
 for(const destination of ["moon","mars"] as Destination[]){
   for(let sol=1;sol<=10;sol++){
     const s={...initialOutpost(destination),sol};
     const id=missionDestination(s);
     assert.ok(BASE_FACILITIES.some(f=>f.id===id));
     if(!((destination==="moon"&&[3,5,6,7,9].includes(sol))||(destination==="mars"&&[3,4,5,6,8,9].includes(sol)))){
       assert.equal(id,dayBrief(s).focus);
     }
   }
 }
});

test("emergency directions take priority over normal missions until resolved",()=>{
 for(const [destination,sol,expected] of [
  ["moon",3,"shield"],["moon",5,"battery"],["moon",7,"recycle"],
  ["mars",4,"solar"],["mars",6,"recycle"]
 ] as const){
   const state={...initialOutpost(destination),sol};
   assert.equal(missionDestination(state),expected);
   const emergency=chooseIncident(state,(sol===3?"shelter":sol===5?"conserve":sol===7?"patch":sol===4?"seal":"patch"));
   assert.notEqual(emergency,state);
   assert.equal(missionDestination(emergency),dayBrief(emergency).focus);
 }
});

test("Outpost joystick is dynamic, bottom-right and other controls permit independent look",()=>{
 const app=readFileSync("src/outpost/Junior3D.tsx","utf8");
 const world=readFileSync("src/outpost/World3D.tsx","utf8");
 const css=readFileSync("src/outpost/world3d.css","utf8");
 assert.match(app,/j3-move-zone/);
 assert.match(app,/e\.clientX-rect\.left/);
 assert.match(app,/setPointerCapture\(e\.pointerId\)/);
 assert.match(app,/actionMove\("run",e\)/);
 assert.match(app,/actionMove\("interact",e\)/);
 assert.match(app,/cameraDelta\.current\.yaw/);
 assert.match(world,/state\.yaw\+=pendingLook\.yaw/);
 assert.match(world,/latest\.current\.onPosition/);
 assert.match(css,/\.j3-move-zone\s*\{[^}]*right:0;bottom:0;/);
 assert.match(css,/\.j3-buttons\s*\{left:/);
 assert.match(app,/OutpostMap/);
 assert.match(app,/nav\.title/);
});

test("Commander lets touch drag from INTERACT turn camera without accidentally operating doors",()=>{
 const app=readFileSync("src/commander/Cabin.tsx","utf8");
 const css=readFileSync("src/commander/commander.css","utf8");
 assert.match(app,/onPointerDownCapture=\{workDown\}/);
 assert.match(app,/onPointerMoveCapture=\{workMove\}/);
 assert.match(app,/onPointerUpCapture=\{workEnd\}/);
 assert.match(app,/suppressWorkAction\.current=p\.dragged/);
 assert.match(app,/if\(!drag\)commitInteraction\.current\(\)/);
 assert.match(app,/const dragSprint/);
 assert.match(css,/position:absolute;inset:0;z-index:5;/);
});

test("map includes actual facility positions, live player indicator and descriptions",()=>{
 const map=readFileSync("src/outpost/OutpostMap.tsx","utf8");
 assert.match(map,/BASE_FACILITIES\.map/);
 assert.match(map,/j3-map-player/);
 assert.match(map,/FACILITY_GUIDE\[place\.id\]\.purpose/);
 assert.match(map,/missionDestination\(session\)/);
 assert.match(map,/onClose/);
});

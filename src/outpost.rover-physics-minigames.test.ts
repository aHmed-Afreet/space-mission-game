import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {initialOutpost} from "./outpost/engine";
import {DAY_TIME_LIMIT_MS,failDayDeadline,dayTimerRuns,formatDayTime} from "./outpost/dayChallenge";
import {stepRover,ROVER_START,ROVER_MAX_SPEED} from "./outpost/roverPhysics";
import {inertialMovement,jumpStep,localGravity} from "./outpost/motionPhysics";
import {chooseMiniGame,signalSequence,targetRelays} from "./outpost/EngineeringMiniGame";
import {clampWalk,walkStep} from "./outpost/worldLogic";

test("Moon and Mars daily objectives have 4 active-play minutes, including puzzles and driving",()=>{
 assert.equal(DAY_TIME_LIMIT_MS,240000);
 assert.equal(formatDayTime(DAY_TIME_LIMIT_MS),"04:00");
 assert.equal(dayTimerRuns("active","minigame" as null,true),true);
 assert.equal(dayTimerRuns("active","rover" as null,true),true);
 assert.equal(dayTimerRuns("active","map",true),false);
 assert.match(failDayDeadline(initialOutpost("mars")).lastReport.join(" "),/04:00/);
});

test("rover accelerates, slows with friction, steers and cannot drive through buildings",()=>{
 let p={...ROVER_START};
 for(let i=0;i<20;i++)p=stepRover(p,{throttle:1,steer:0},.05);
 assert.ok(p.speed>0&&p.speed<=ROVER_MAX_SPEED);
 assert.ok(Math.hypot(p.x-ROVER_START.x,p.z-ROVER_START.z)>2);
 const atSpeed=p.speed;
 for(let i=0;i<55;i++)p=stepRover(p,{throttle:0,steer:0},.05);
 assert.ok(p.speed<atSpeed*.18,"friction slows a released throttle");
 const turned=stepRover({...ROVER_START,speed:2},{throttle:1,steer:1},.1);
 assert.ok(turned.heading!==ROVER_START.heading,"steering changes heading");
 const bunker=stepRover({x:17,z:-10,heading:0,speed:3},{throttle:0,steer:0},.1);
 assert.ok(Math.hypot(bunker.x-17,bunker.z+10)>=3.25+1.45-.01);
 assert.ok(bunker.speed===0,"rover stops on collision");
});

test("astronaut starts moving smoothly and follows Moon/Mars gravity when jumping",()=>{
 const accelerating=inertialMovement({x:0,y:0},{x:0,y:1},.016);
 assert.ok(accelerating.y>0&&accelerating.y<1);
 const slowing=inertialMovement({x:0,y:1},{x:0,y:0},.016);
 assert.ok(slowing.y>0&&slowing.y<1);
 assert.equal(localGravity("moon"),1.62);
 assert.equal(localGravity("mars"),3.71);
 let m=jumpStep({height:0,velocity:0},.016,"moon",true);
 assert.ok(m.height>0);
 for(let i=0;i<270;i++)m=jumpStep(m,.016,"moon",false);
 assert.equal(m.height,0);
 assert.equal(m.velocity,0);
});

test("closed interior hatch blocks door crossing, open hatch allows it, and bunks collide",()=>{
 const shut=clampWalk({x:0,z:5},true,null,"habitat");
 const open=clampWalk({x:0,z:5},true,"habitat","habitat");
 assert.ok(shut.z<4.05);
 assert.ok(open.z>4.05);
 const bunk=clampWalk({x:-3.12,z:.65},true,null,"habitat");
 assert.ok(bunk.x<=-4||bunk.x>=-2.36||bunk.z<=-3.28||bunk.z>=1.84);
 const step=walkStep({x:-1.7,z:1.1},0,-1,0,.05,true,null,"habitat");
 assert.ok(step.x< -1.7,"aisle remains navigable alongside the bunk");
});

test("two different engineering puzzles are deterministic and complete before real operation",()=>{
 assert.equal(chooseMiniGame("shield"),"signal");
 assert.equal(chooseMiniGame("greenhouse"),"signal");
 assert.equal(chooseMiniGame("battery"),"circuit");
 assert.equal(targetRelays(2,"solar").length,4);
 assert.deepEqual(targetRelays(2,"solar"),targetRelays(2,"solar"));
 assert.equal(signalSequence(3,"repair").length,4);
 assert.deepEqual(signalSequence(3,"repair"),signalSequence(3,"repair"));
 const source=readFileSync("src/outpost/Junior3D.tsx","utf8");
 assert.match(source,/beginEngineering\(id\)/);
 assert.match(source,/beginEngineering\("monitor"\)/);
 assert.match(source,/onComplete=\{\(\)=>\{operate\(pendingAction\)/);
 assert.match(source,/panel==="minigame"/);
 assert.match(source,/panel==="rover"/);
 assert.match(source,/OPEN ROVER DRIVE SCREEN/);
});
test("3D scene renders moving rover, greenhouse inside glass and manually closable doors",()=>{
 const world=readFileSync("src/outpost/World3D.tsx","utf8");
 const structure=readFileSync("src/outpost/architectures.ts","utf8");
 const ui=readFileSync("src/outpost/Junior3D.tsx","utf8");
 assert.match(world,/scene\.roverGroup\.position\.set\(rp\.x,\.02,rp\.z\)/);
 assert.match(world,/state\.open===target\.id\?null:target\.id/);
 assert.match(world,/state\.open===room\?null:room/);
 assert.match(world,/greenhousePane\.transparent=true/);
 assert.match(world,/greenhousePane\.side=T\.DoubleSide/);
 assert.match(structure,/No overhead pole, crossbeam or raised side guard/);
 assert.match(ui,/desktopControls&&<div className="j3-keyboard-hint"/);
 assert.match(ui,/!desktopControls&&<Stick move=\{movement\}\/>/);
 assert.match(world,/jumpStep\(jump,dt,data\.destination/);
});

import test from "node:test";
import assert from "node:assert/strict";
import {applyCrewAction,crewTick,validWorldAction,withObjectiveTurn} from "./actions";
import {createSession,emptyProgress,command,moveSession,tickSession,sitePosition} from "../campaign/engine";
import {missions,missionById,type Site} from "../campaign/definitions";
import {defaultDesign,defaultLife} from "../simulation";
import type {CrewAction,CrewMember} from "./protocol";
const members=[{id:"host",role:"Commander"},{id:"guest",role:"Engineer"}] as CrewMember[];
function fresh(id=missions[0].id){const m=missionById(id);return createSession(m,defaultDesign,defaultLife,[...m.requiredEquipment],emptyProgress());}
function position(site:Site){const p=sitePosition(site,"earth");return {x:p.x+(p.x<0?1.1:p.x>0?-1.1:0),z:p.z+(site==="cockpit"?1.05:0),heading:0};}
function request(s:ReturnType<typeof fresh>,type:CrewAction["type"],value:unknown,site:Site):CrewAction{return {type,value,sessionId:s.id,position:position(site)};}

test("co-op cannot bank a future player's readiness task or skip their turn",()=>{
 let s=fresh();const second=missions[0].objectives[1].id;
 s=applyCrewAction(s,"host",members,request(s,"command","verifyLife","galley"));
 assert.equal(s.objective,0);assert.ok(!s.observations.achieved.includes(second));
 s=applyCrewAction(s,"guest",members,request(s,"command","verifyLife","galley"));
 assert.ok(!s.observations.achieved.includes(second));
 s=applyCrewAction(s,"host",members,request(s,"command","verifyPower","power"));
 assert.equal(s.objective,1);assert.ok(!s.completed.includes(second));
 s=applyCrewAction(s,"host",members,request(s,"command","verifyLife","galley"));assert.equal(s.objective,1);
 s=applyCrewAction(s,"guest",members,request(s,"command","verifyLife","galley"));assert.equal(s.objective,2);
 assert.ok(!Object.hasOwn(s,"objectiveTurn"));
});

test("solo early preparation keeps its established behavior",()=>{
 let s=fresh();s=command({...s,position:position("galley")},"verifyLife");
 s=command({...s,position:position("power")},"verifyPower");assert.equal(s.objective,2);
});

test("guest-owned arrival advances at the guest's position and preserves host camera",()=>{
 const s={...fresh("mission-2"),objective:17};
 const next=applyCrewAction(s,"guest",members,request(s,"move",null,"equipment"));
 assert.equal(next.objective,18);assert.deepEqual(next.position,s.position);
 assert.ok(!Object.hasOwn(next,"objectiveTurn"));
});

test("host movement and background ticks cannot complete a guest's arrival",()=>{
 const s={...fresh("mission-2"),objective:17};
 const moved=withObjectiveTurn(s,false,s=>moveSession(s,position("equipment")));
 assert.equal(moved.objective,17);
 const ticked=crewTick(moved,s=>tickSession(s,.01));assert.equal(ticked.objective,17);
 const away=applyCrewAction(ticked,"guest",members,{...request(ticked,"move",null,"equipment"),position:s.position});
 assert.equal(away.objective,17,"host's visit does not certify guest arrival");
});

test("guest RETURN uses their position, not the host camera",()=>{
 const s={...fresh("mission-2"),objective:37};
 const next=applyCrewAction(s,"guest",members,request(s,"move",null,"cockpit"));
 assert.equal(next.objective,38);assert.deepEqual(next.position,s.position);
});

test("a completed wait does not consume the following player's stored operation",()=>{
 let s=fresh();const m=missions[0];const index=m.objectives.findIndex(o=>o.condition==="countdown");
 s={...s,objective:index,flight:{...s.flight,countdown:0},observations:{...s.observations,achieved:[m.objectives[index+1].id]}};
 const next=crewTick(s,s=>tickSession(s,.01));assert.equal(next.objective,index+1);
 assert.ok(!next.completed.includes(m.objectives[index+1].id));
 assert.ok(!next.observations.achieved.includes(m.objectives[index+1].id));
});

test("guest spacecraft switches and target selection reach real engine controls",()=>{
 let s=fresh();const hostPosition=s.position;
 s=applyCrewAction(s,"guest",members,request(s,"world",{kind:"switch",id:"maneuver"},"cockpit"));
 assert.equal(s.world.switches.maneuver,true);
 s=applyCrewAction(s,"guest",members,request(s,"world",{kind:"target",value:"moon"},"cockpit"));
 assert.equal(s.world.target,"moon");assert.deepEqual(s.position,hostPosition);
 const denied=applyCrewAction(s,"guest",members,request(s,"world",{kind:"target",value:"earth"},"galley"));
 assert.equal(denied.world.target,"moon","console proximity remains enforced");
});

test("guest equipment collection is forwarded",()=>{
 let s=fresh("mission-2");s={...s,world:{...s.world,lockers:{...s.world.lockers,equipment:true}}};
 const id="repair" as const;assert.ok(s.world.stored.includes(id));
 s={...s,world:{...s.world,lockers:{...s.world.lockers,repair:true}}};
 const next=applyCrewAction(s,"guest",members,request(s,"world",{kind:"take",id},"equipment"));
 assert.ok(next.pack.includes(id));assert.ok(!next.world.stored.includes(id));
});

test("guest fault diagnosis, repair and verification obey the real prerequisites",()=>{
 let s=fresh();
 s={...s,state:{...s.state,parts:3,tools:true},world:{...s.world,
  lockers:{...s.world.lockers,maintenance:true},
  switches:{...s.world.switches,busB:false},
  faults:[{id:"test-bus",kind:"bus",at:0,diagnosed:false,repaired:false,verified:false}]}};
 const act=(kind:"diagnose"|"repairFault"|"verifyFault")=>{
  s=applyCrewAction(s,"guest",members,request(s,"world",{kind,id:"test-bus"},"power"));
 };
 act("repairFault");assert.equal(s.world.faults[0].repaired,false);
 act("diagnose");assert.equal(s.world.faults[0].diagnosed,true);
 act("repairFault");assert.equal(s.world.faults[0].repaired,true);assert.equal(s.state.parts,2);
 act("verifyFault");assert.equal(s.world.faults[0].verified,false);
 s=applyCrewAction(s,"guest",members,request(s,"world",{kind:"switch",id:"busB"},"power"));
 act("verifyFault");assert.equal(s.world.faults[0].verified,true);
});

test("invalid world payloads, stale missions, paused actions and bounds are rejected",()=>{
 const s=fresh();
 for(const value of [{kind:"target",value:"mars"},{kind:"antenna",value:NaN},{kind:"temperature",value:Infinity},{kind:"take",id:"__proto__"},{kind:"door",id:"missing"},{kind:"unknown"}]){
  assert.equal(validWorldAction(value),false);
  assert.equal(applyCrewAction(s,"guest",members,request(s,"world",value,"cockpit")),s);
 }
 const req=request(s,"world",{kind:"target",value:"moon"},"cockpit");
 assert.equal(applyCrewAction(s,"guest",members,{...req,sessionId:"old"}),s);
 const paused={...s,state:{...s.state,paused:true}};assert.equal(applyCrewAction(paused,"guest",members,req),paused);
 assert.equal(applyCrewAction(s,"guest",members,{...req,position:{x:999,z:0,heading:0}}),s);
});

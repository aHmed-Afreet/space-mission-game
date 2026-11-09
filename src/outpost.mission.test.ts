import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {advanceSol,chooseIncident,currentIncident,initialOutpost,isValidOutpost,perform,setCropPlan,setPriority,type Destination,type Outpost} from "./outpost/engine";
import {dayBrief,dayLesson,dailyChanges} from "./outpost/missionFlow";
const facilityIds=["habitat","solar","shield","recycle","greenhouse","battery"];

test("each of ten Moon and Mars mission days gives a clear, actionable building goal",()=>{
  for(const destination of ["moon","mars"] as Destination[]){
    const titles=new Set<string>();
    for(let sol=1;sol<=10;sol++){
      const s={...initialOutpost(destination),sol};
      const info=dayBrief(s);
      assert.ok(info.title.length>=12);
      assert.ok(info.description.length>=32);
      assert.ok(info.tip.length>=20);
      assert.ok(facilityIds.includes(info.focus));
      titles.add(info.title);
    }
    assert.equal(titles.size,10,"No repetitive placeholder missions");
  }
});

test("critically low water, food or power creates an explicit recovery objective",()=>{
  const s=initialOutpost("moon");
  assert.equal(dayBrief({...s,water:15}).focus,"recycle");
  assert.equal(dayBrief({...s,oxygen:12}).focus,"recycle");
  assert.equal(dayBrief({...s,food:14}).focus,"greenhouse");
  assert.equal(dayBrief({...s,battery:8,sol:4}).focus,"battery");
});

test("daily result computes real before-and-after values, including negative radiation",()=>{
  const old=initialOutpost("moon");
  const next=advanceSol(perform(old,"monitor"));
  const changes=dailyChanges(old,next);
  assert.ok(changes.some(x=>x.key==="food" && x.delta<0));
  assert.ok(changes.some(x=>x.key==="radiation" && x.delta>0));
  assert.ok(dayLesson(old,next).length>=35);
});

test("mission day feedback explains night, dust and radiation incidents",()=>{
  for(const destination of ["moon","mars"] as Destination[]){
    const sol=destination==="moon"?5:4;
    let s={...initialOutpost(destination),sol};
    const incident=currentIncident(s);
    assert.ok(incident);
    s=perform(s,"monitor");
    s=chooseIncident(s,incident!.options[0].id);
    const next=advanceSol(s);
    assert.equal(next.sol,sol+1);
    assert.ok(dayLesson(s,next).length>50);
  }
});

test("new mission UI supports touch entry, one-action rule, power choice and emergency gate",()=>{
  const ux=readFileSync("src/outpost/JuniorMission.tsx","utf8");
  const entry=readFileSync("src/outpost/JuniorOutpost.tsx","utf8");
  const scene=readFileSync("src/outpost/FacilityScene.tsx","utf8");
  assert.match(entry,/export \{ default \} from "\.\/JuniorMission"/);
  assert.match(ux,/sceneOnly/);
  assert.match(scene,/sceneOnly/);
  assert.match(ux,/onSelect=\{\(id\)=>\{setRoom\(id\)/);
  assert.match(ux,/facility\.operations\.map/);
  assert.match(ux,/disabled=\{!canAdvance&&!completed\}/);
  assert.match(ux,/RESPOND TO EMERGENCY FIRST/);
  assert.match(ux,/setPriority/);
  assert.doesNotMatch(ux,/outpost-ops/,"The old duplicated list of eleven actions must be gone.");
  assert.match(ux,/dayLesson/);
  assert.match(ux,/dailyChanges/);
  assert.match(ux,/60-SECOND GUIDE/);
});

test("mission redesign does not modify source format, saves or require reset",()=>{
  const s=initialOutpost("mars");
  assert.ok(isValidOutpost(s));
  assert.equal(s.version,2);
  const upgraded=setPriority(setCropPlan(s,"potato"),"crops");
  assert.ok(isValidOutpost(upgraded));
  assert.equal(upgraded.version,s.version);
  assert.notEqual(upgraded,s);
  assert.equal(upgraded.destination,"mars");
  assert.equal(upgraded.sol,s.sol);
  const ux=readFileSync("src/outpost/JuniorMission.tsx","utf8");
  assert.match(ux,/LEGACY_GAME_KEY/);
  assert.match(ux,/migrateOutpost/);
  assert.match(ux,/localStorage\.setItem\(GAME_KEY/);
  assert.match(ux,/window\.confirm/);
});

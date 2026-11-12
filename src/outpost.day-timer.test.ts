import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {initialOutpost,advanceSol,missionScore} from "./outpost/engine";
import {DAY_TIME_LIMIT_MS,DAY_WARNING_MS,DAY_URGENT_MS,dayTimerKey,dayTimerRuns,failDayDeadline,
 formatDayTime,normalizeSavedDayTime} from "./outpost/dayChallenge";

test("each timed sol has 8 minutes, readable clock, and a 60-second warning",()=>{
 assert.equal(DAY_TIME_LIMIT_MS,480000);
 assert.equal(DAY_WARNING_MS,60000);
 assert.equal(DAY_URGENT_MS,20000);
 assert.equal(formatDayTime(DAY_TIME_LIMIT_MS),"08:00");
 assert.equal(formatDayTime(59999),"01:00");
 assert.equal(formatDayTime(19999),"00:20");
 assert.equal(formatDayTime(0),"00:00");
 assert.equal(formatDayTime(-10),"00:00");
});

test("clock resumes on same saved sol and resets to full time on new sol or invalid storage",()=>{
 assert.notEqual(dayTimerKey("moon"),dayTimerKey("mars"));
 assert.equal(normalizeSavedDayTime(JSON.stringify({sol:3,remainingMs:92000}),3),92000);
 assert.equal(normalizeSavedDayTime(JSON.stringify({sol:3,remainingMs:92000}),4),DAY_TIME_LIMIT_MS);
 assert.equal(normalizeSavedDayTime(null,2),DAY_TIME_LIMIT_MS);
 assert.equal(normalizeSavedDayTime("{",2),DAY_TIME_LIMIT_MS);
 assert.equal(normalizeSavedDayTime(JSON.stringify({sol:2,remainingMs:Infinity}),2),DAY_TIME_LIMIT_MS);
 assert.equal(normalizeSavedDayTime(JSON.stringify({sol:2,remainingMs:-8}),2),0);
 assert.equal(normalizeSavedDayTime(JSON.stringify({sol:2,remainingMs:999999}),2),DAY_TIME_LIMIT_MS);
});

test("timer counts in exploration and engineering consoles but pauses in help, map and hidden tabs",()=>{
 assert.equal(dayTimerRuns("active",null,true),true);
 assert.equal(dayTimerRuns("active","console",true),true);
 for(const panel of ["help","map","mission","event","outcome","timeout"] as const){
  assert.equal(dayTimerRuns("active",panel,true),false,panel);
 }
 assert.equal(dayTimerRuns("active",null,false),false);
 assert.equal(dayTimerRuns("lost",null,true),false);
 assert.equal(dayTimerRuns("won","console",true),false);
});

test("missed daily deadline fails run without mutating previous save or resource values",()=>{
 const original=initialOutpost("moon");
 const before=structuredClone(original);
 const failed=failDayDeadline(original);
 assert.equal(failed.phase,"lost");
 assert.equal(failed.sol,1);
 assert.equal(failed.safety,before.safety);
 assert.equal(failed.credits,before.credits);
 assert.equal(failed.food,before.food);
 assert.match(failed.lastReport.join(" "),/08:00 active-play deadline expired/);
 assert.ok(failed.log.some(x=>x.includes("DAY 1 FAILED")));
 assert.deepEqual(original,before);
 assert.ok(missionScore(failed)<=39);
 assert.equal(failDayDeadline(failed),failed,"failure cannot be charged twice");
 assert.equal(advanceSol(failed),failed,"failed timed challenges cannot advance another day");
});

test("Outpost UI presents readable countdown, warnings, failure actions and restart behavior",()=>{
 const s=readFileSync("src/outpost/Junior3D.tsx","utf8");
 const css=readFileSync("src/outpost/world3d.css","utf8");
 assert.match(s,/lastTimerTick\.current=null/);
 assert.match(s,/document\.addEventListener\("visibilitychange",pause\)/);
 assert.match(s,/dayTimerKey\(session\.destination\)/);
 assert.match(s,/setRemainingMs\(DAY_TIME_LIMIT_MS\)/);
 assert.match(s,/dayTimerRuns\(session\.phase,toolbarEditing\?"help":panel,!document\.hidden\)/);
 assert.match(s,/setSession\(old=>old\?\.phase==="active"\?failDayDeadline\(old\):old\)/);
 assert.match(s,/role="timer"/);
 assert.match(s,/formatDayTime\(remainingMs\)/);
 assert.match(s,/className="j3-panel j3-timeout-panel"/);
 assert.match(s,/RESTART CHALLENGE ↻/);
 assert.match(s,/CHOOSE A PLANET/);
 assert.match(s,/08:00 PER DAY/);
 assert.match(css,/\.j3-day-timer\{/);
 assert.match(css,/\.j3-console-deadline\{/);
 assert.match(css,/\.j3-timeout-panel\{/);
});

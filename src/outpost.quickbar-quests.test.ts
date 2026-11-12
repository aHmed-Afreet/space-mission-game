import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {initialOutpost} from "./outpost/engine";
import {missionSchedule} from "./outpost/missionFlow";
import {allMainMissions,sideQuests} from "./outpost/questBoard";
import {TOOL_CATALOG,QUICKBAR_SLOTS,defaultQuickbar,parseQuickbar,quickbarKey} from "./universalQuickbar";
import {dayTimerRuns} from "./outpost/dayChallenge";

test("Outpost boards list exactly ten planet-specific missions, current day and future objectives",()=>{
 for(const destination of ["moon","mars"] as const){
  const s={...initialOutpost(destination),sol:4};
  const all=allMainMissions(s);
  assert.equal(missionSchedule(destination).length,10);
  assert.equal(all.length,10);
  assert.equal(all.filter(m=>m.done).length,3);
  assert.equal(all.filter(m=>m.current).length,1);
  assert.equal(all[3].status,"IN PROGRESS");
  assert.equal(all[9].status,"UPCOMING");
  assert.ok(all.every(m=>m.planned.title.length>8&&m.planned.description.length>15));
 }
 assert.notEqual(allMainMissions(initialOutpost("moon"))[0].planned.title,allMainMissions(initialOutpost("mars"))[0].planned.title);
});
test("seven side quests reflect existing live resources without modifying saves",()=>{
 const s=initialOutpost("moon"),before=structuredClone(s);
 const q=sideQuests(s);
 assert.equal(q.length,7);
 assert.ok(q.some(x=>x.id==="shield"&&!x.done));
 assert.ok(q.some(x=>x.id==="harvest"&&!x.done));
 assert.equal(sideQuests({...s,shielding:2,foodProduced:30}).filter(x=>x.done).length,q.filter(x=>x.done).length+2);
 assert.deepEqual(s,before);
});
test("toolbar has six editable safe slots, different defaults and independent saves across modes",()=>{
 assert.equal(QUICKBAR_SLOTS,6);
 for(const mode of ["outpost","commander","strategy","history","history_all"] as const){
  const defaults=defaultQuickbar(mode);
  assert.equal(defaults.length,QUICKBAR_SLOTS);
  assert.deepEqual(parseQuickbar(null,mode),defaults);
  assert.deepEqual(parseQuickbar(JSON.stringify(defaults),mode),defaults);
  assert.deepEqual(parseQuickbar("not json",mode),defaults);
  assert.deepEqual(parseQuickbar('["random"]',mode),defaults);
  assert.notEqual(quickbarKey(mode),quickbarKey("outpost")===quickbarKey(mode)?"INVALID":quickbarKey("outpost"));
 }
 assert.ok(Object.keys(TOOL_CATALOG).includes("wrench"));
 assert.ok(Object.keys(TOOL_CATALOG).includes("tablet"));
});
test("board pauses daily clock just like existing help and map screens",()=>{
 assert.equal(dayTimerRuns("active","board",true),false);
 assert.equal(dayTimerRuns("active",null,true),true);
 assert.equal(dayTimerRuns("active","console",true),true);
});
test("Outpost beds keep physical sleep coordinates and move away from giant slabs",()=>{
 const world=readFileSync("src/outpost/worldLogic.ts","utf8");
 const geometry=readFileSync("src/outpost/architectures.ts","utf8");
 assert.match(world,/CREW_BED:Point2=\{x:-2\.75,z:\.75\}/);
 assert.match(geometry,/for\(const z of \[-2\.05,\.65\]\)/);
 assert.match(geometry,/strapped crew bunks/);
 assert.match(geometry,/mattress/);
 assert.match(geometry,/pillow/);
 assert.match(geometry,/blanket/);
 assert.match(geometry,/reading lamp/);
});
test("mission board, hide toggle and quickbar editor are accessible without replacing existing controls",()=>{
 const ui=readFileSync("src/outpost/Junior3D.tsx","utf8");
 const board=readFileSync("src/outpost/MissionBoard.tsx","utf8");
 const modes=readFileSync("src/ModeSelect.tsx","utf8");
 const shared=readFileSync("src/UniversalToolbar.tsx","utf8");
 const world=readFileSync("src/outpost/World3D.tsx","utf8");
 assert.match(ui,/setPanel\("board"\)/);
 assert.match(ui,/setShowObjective\(false\)/);
 assert.match(ui,/setShowObjective\(true\)/);
 assert.match(ui,/orbital-outpost-objective-visible-v1/);
 assert.match(board,/MAIN MISSIONS · 10/);
 assert.match(board,/SIDE QUESTS/);
 assert.match(board,/allMainMissions/);
 assert.match(board,/sideQuests/);
 assert.equal((modes.match(/<UniversalToolbar/g)||[]).length,3);
 assert.match(shared,/aria-label="Customize equipment toolbar"/);
 assert.match(shared,/Equipment for slot/);
 assert.match(shared,/orbital-quickbar-use/);
 assert.match(world,/heldModels/);
 assert.match(world,/latest\.current\.heldTool/);
 assert.match(ui,/blocked=\{Boolean\(panel\)\|\|toolbarEditing\}/);
});

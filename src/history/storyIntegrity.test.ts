import test from "node:test";
import assert from "node:assert/strict";
import { HISTORY_PROGRESS_KEY, HISTORY_RECEIPT_PREFIX, mergeHistoryProgress, readHistoryProgress, readHistoryProgressStrict, saveHistoryProgress } from "./historyProgress";
import { storyFieldEligibility } from "./storyFieldActions";
import { historyMissions } from "./missionHistory";
import { createStoryScenario } from "./storyScenarios";
import { readStoryAttempt, saveStoryAttempt, clearCompletedStoryAttempt, validateStoryAttempt, STORY_ATTEMPT_PREFIX, type StoryAttempt } from "./storyAttempt";
import { storyScienceExercise } from "./storyScience";
function store(initial: Record<string,string>={}) {
 const values=new Map(Object.entries(initial));
 return {values,get length(){return values.size;},key:(i:number)=>[...values.keys()][i]??null,
  getItem:(k:string)=>values.get(k)??null,removeItem:(k:string)=>{values.delete(k);},setItem:(k:string,v:string)=>{values.set(k,v);}};
}
test("U1: every authoritative get/parse/format failure aborts without a single mutation",()=>{
 for(const bytes of ['{', 'null','[]','2','{"version":2,"records":{}}','{"history-1":3}']){
  const storage=store({[HISTORY_PROGRESS_KEY]:bytes});let writes=0;
  assert.deepEqual(readHistoryProgress(storage),{});
  assert.throws(()=>saveHistoryProgress({...storage,setItem:()=>{writes++;}}, {"history-2":2},"history-3",2));
  assert.equal(writes,0);assert.equal(storage.getItem(HISTORY_PROGRESS_KEY),bytes);
 }
 const good=JSON.stringify({"history-1":2,"history-55":2});
 for(const failureIndex of [0,1,50,110]){
  const storage=store({[HISTORY_PROGRESS_KEY]:good});let reads=0,writes=0;
  assert.throws(()=>saveHistoryProgress({...storage,getItem:(k:string)=>{if(reads++===failureIndex)throw Error("denied read");return storage.getItem(k);},setItem:()=>{writes++;}}, {"history-2":2},"history-3",2),/denied read/);
  assert.equal(writes,0);assert.equal(storage.getItem(HISTORY_PROGRESS_KEY),good);
 }
});
test("U2: maximum merge applies to all stored, stale, legacy and unrelated records",()=>{
 const storage=store({[HISTORY_PROGRESS_KEY]:JSON.stringify({"history-1":2,"history-55":1,"history-80":2})});
 const saved=saveHistoryProgress(storage,{"history-1":1,"history-55":2,"history-3":1},"history-2",2);
 assert.deepEqual(saved,{"history-1":2,"history-55":2,"history-80":2,"history-3":1,"history-2":2});
 assert.deepEqual(readHistoryProgressStrict(storage),saved);
 assert.deepEqual(mergeHistoryProgress(saved,{"history-55":1}),saved);
});
test("U2: two interleaved tabs retain every earned best despite a stale legacy summary write",()=>{
 const storage=store({[HISTORY_PROGRESS_KEY]:JSON.stringify({"history-1":2})});
 let interleaved=false;
 const tabA={...storage,setItem:(k:string,v:string)=>{
  if(k===HISTORY_PROGRESS_KEY&&!interleaved){interleaved=true;saveHistoryProgress(storage,{"history-1":1},"history-55",2);}
  storage.setItem(k,v);
 }};
 saveHistoryProgress(tabA,{"history-1":1},"history-2",1);
 assert.equal(JSON.parse(storage.getItem(HISTORY_PROGRESS_KEY)!)["history-55"],undefined,"exercise an actual stale summary overwrite");
 assert.deepEqual(readHistoryProgressStrict(storage),{"history-1":2,"history-2":1,"history-55":2});
 saveHistoryProgress(storage,{"history-1":1,"history-2":1},"history-2",2);
 assert.deepEqual(readHistoryProgressStrict(storage),{"history-1":2,"history-2":2,"history-55":2});
});
test("receipt and summary write failures preserve previous earned scores and permit retry",()=>{
 for(const failAt of [0,1,2]){
  const storage=store({[HISTORY_PROGRESS_KEY]:JSON.stringify({"history-1":2})});let n=0;
  const failing={...storage,setItem:(k:string,v:string)=>{if(n++===failAt)throw Error("quota");storage.setItem(k,v);}};
  assert.throws(()=>saveHistoryProgress(failing,{},"history-2",2),/quota/);
  assert.equal(readHistoryProgressStrict(storage)["history-1"],2);
  assert.equal(saveHistoryProgress(storage,{},"history-2",2)["history-2"],2);
 }
 const broken=store({[HISTORY_RECEIPT_PREFIX+"history-1:2"]:"corrupt"});let writes=0;
 assert.throws(()=>saveHistoryProgress({...broken,setItem:()=>{writes++;}},{},"history-2",2));assert.equal(writes,0);
});
test("U3: each surface action uses its exact unrounded threshold and rejects stale readiness with feedback",()=>{
 for(const action of ["walk","photo","sample","flag"] as const){
  const threshold=action==="walk"?3:2;
  for(const [distance,ready] of [[threshold-.0001,false],[threshold,true],[threshold+.0001,true]] as const){
   const result=storyFieldEligibility(action,true,distance);assert.equal(result.ready,ready);assert.equal(result.minimum,threshold);assert.ok(result.feedback.length>0);
  }
  assert.equal(storyFieldEligibility(action,true,threshold-.4).ready,false,"rounded HUD cannot enable prematurely");
  assert.equal(storyFieldEligibility(action,false,threshold+10).ready,false);
  assert.equal(storyFieldEligibility(action,true,NaN).ready,false);
 }
});
const mission=historyMissions.find(m=>m.title==="Apollo 11")!;
const scenario=createStoryScenario(mission);
function attempt():StoryAttempt{return {version:1,missionId:mission.id,runId:"genuine-training-run",updatedAt:1234,
 taskIds:scenario.tasks.map(t=>t.id),stage:2,completedTaskIds:scenario.tasks.slice(0,2).map(t=>t.id),logged:scenario.tasks.slice(0,2).map(t=>t.complete),
 procedure:null,suitEquipped:true,oxygen:43.273,hatchPrepared:false,
 world:{version:1,outside:true,position:[1,1.65,13],yaw:3.14,pitch:.15,motion:[0,0,0],jumpHeight:0,jumpSpeed:0},scienceRecords:[]};}
test("versioned mid-exercise resume retains actual task, suit oxygen and pose separately from completions",()=>{
 const storage=store();const earned=JSON.stringify({"history-1":2});storage.setItem(HISTORY_PROGRESS_KEY,earned);
 assert.equal(readStoryAttempt(storage,scenario).kind,"missing");const checkpoint=attempt();
 saveStoryAttempt(storage,scenario,checkpoint);
 const loaded=readStoryAttempt(storage,scenario);assert.equal(loaded.kind,"valid");
 if(loaded.kind==="valid")assert.deepEqual(loaded.attempt,checkpoint);
 assert.equal(storage.getItem(HISTORY_PROGRESS_KEY),earned);assert.equal(readHistoryProgressStrict(storage)[mission.id],undefined);
});
test("unknown/corrupt attempts are retained, failed reads never write, and no legacy progress is invented",()=>{
 for(const bytes of ['{','{"version":4}',JSON.stringify({...attempt(),oxygen:101}),JSON.stringify({...attempt(),completedTaskIds:[]})]){
  const storage=store({[STORY_ATTEMPT_PREFIX+mission.id]:bytes});let writes=0;
  assert.notEqual(readStoryAttempt(storage,scenario).kind,"valid");
  assert.throws(()=>saveStoryAttempt({...storage,setItem:()=>{writes++;}},scenario,attempt()));assert.equal(writes,0);
  assert.equal(storage.getItem(STORY_ATTEMPT_PREFIX+mission.id),bytes);
 }
 const old=store({[HISTORY_PROGRESS_KEY]:JSON.stringify({[mission.id]:2})});
 assert.equal(readStoryAttempt(old,scenario).kind,"missing");
 assert.equal(validateStoryAttempt({...attempt(),world:{...attempt().world,position:[Infinity,1,1]}},scenario),false);
});
test("resume rejects foreign run replacement, task manifest drift and unearned procedure receipts",()=>{
 const storage=store();saveStoryAttempt(storage,scenario,attempt());
 assert.throws(()=>saveStoryAttempt(storage,scenario,{...attempt(),runId:"different-run-id"}),/Another tab/);
 assert.equal(validateStoryAttempt({...attempt(),taskIds:["invented"]},scenario),false);
 assert.equal(validateStoryAttempt({...attempt(),procedure:{taskId:"invented",confirmed:true,powerVerified:true,telemetryVerified:true,operationArmed:true,measurement:true,interpretation:null}},scenario),false);
});
test("science exercises label all invented values and preserve the Gemini safety lesson's original task ID",()=>{
 for(const m of historyMissions){const e=storyScienceExercise(m);assert.equal(e.provenance,"synthetic training data");assert.equal(e.modelVersion,1);assert.equal(e.source,m.source);assert.ok(e.rows.every(r=>Number.isFinite(r.value)&&r.unit));}
 const gemini=createStoryScenario(historyMissions.find(m=>m.title==="Gemini 6A and 7")!);
 assert.equal(gemini.tasks[3].id,"anomaly");assert.match(gemini.tasks[3].procedure,/did not experience Gemini 8/);
 assert.equal(historyMissions.reduce((n,m)=>n+createStoryScenario(m).tasks.length,0),230);
});

test("all 55 source mappings retain titles, dated scopes and explicit milestone semantics",async()=>{
 const {storyReferences}=await import("./storyReferences");
 const {officialFilms}=await import("./officialFilms");
 assert.equal(storyReferences.length,55);assert.equal(new Set(storyReferences.map(r=>r.missionId)).size,55);
 for(const m of historyMissions){const r=storyReferences.find(r=>r.missionId===m.id)!;assert.ok(r);assert.equal(r.url,m.source);assert.equal(r.missionTitle,m.title);assert.equal(r.year,m.year);assert.equal(r.checkedAt,"2026-10-29");assert.ok(r.scope&&r.title&&r.eventLabel);assert.match(r.url,/^https:\/\/(www\.)?(nasa\.gov|science\.nasa\.gov|nssdc\.gsfc\.nasa\.gov|esa\.int|isro\.gov\.in|isas\.jaxa\.jp)\//);}
 for(const m of historyMissions.filter(m=>/Freedom 7|Friendship 7|Gemini/.test(m.title))){assert.doesNotMatch(m.source,/apollo/);}
 const expected:Record<string,string>={"Explorer 1":"explorer-1","Voyager 1":"voyager","Voyager 2":"voyager","Mars Pathfinder":"mars-pathfinder","Viking 1":"viking","Galileo Jupiter arrival":"galileo","Cassini–Huygens":"cassini","OSIRIS-REx sampling":"osiris-rex","James Webb Telescope":"webb","Curiosity":"msl-curiosity"};
 for(const [title,slug]of Object.entries(expected))assert.equal(officialFilms[title].record,`https://science.nasa.gov/mission/${slug}/`);
 assert.match(storyReferences.find(r=>r.missionId==="history-26")!.eventLabel,/launched 1973/);
 assert.match(storyReferences.find(r=>r.missionId==="history-49")!.eventLabel,/first science images 2022/);
});

test("Story fixed foreground clock charges the same oxygen time at 1/10/30/60/120 Hz and freezes long stalls",async()=>{
 const {createForegroundClock}=await import("../commander/foregroundTime");
 const {storyFrame}=await import("./storyRuntime");
 for(const hz of [1,10,30,60,120]){
  const clock=createForegroundClock();let oxygen=100,moved=0;
  const step=(delta:number)=>{moved+=delta;oxygen=storyFrame(oxygen,true,false,delta).oxygen;};
  clock.advance(0,{active:true,visible:true},step);
  for(let n=1;n<=hz*10;n++)clock.advance(n*1000/hz,{active:true,visible:true},step);
  assert.ok(Math.abs(moved-10)<1e-8);assert.ok(Math.abs(oxygen-99.4)<1e-8);
  const before=oxygen;assert.equal(clock.advance(15000,{active:true,visible:true},step).suspended,true);assert.equal(oxygen,before);
  clock.advance(16000,{active:false,visible:true},step);clock.advance(17000,{active:true,visible:false},step);assert.equal(oxygen,before);
 }
});

test("all 230 existing task IDs and their mission order match the frozen pre-build source manifest",async()=>{
 const {readFileSync}=await import("node:fs");
 const baseline=JSON.parse(readFileSync(new URL("./storyTaskManifest.fixture.json",import.meta.url),"utf8"));
 assert.deepEqual(historyMissions.map(m=>({id:m.id,tasks:createStoryScenario(m).tasks.map(t=>t.id)})),baseline.missions);
});


test("completion cleanup preserves failed completion attempts, unrelated runs and every earned score",()=>{
 const storage=store();const finished={...attempt(),stage:scenario.tasks.length,completedTaskIds:scenario.tasks.map(t=>t.id),logged:scenario.tasks.map(t=>t.complete)};
 saveStoryAttempt(storage,scenario,finished);
 const bytes=storage.getItem(STORY_ATTEMPT_PREFIX+mission.id);
 assert.throws(()=>saveHistoryProgress({...storage,setItem:()=>{throw Error("quota");}},{},mission.id,2));
 assert.equal(storage.getItem(STORY_ATTEMPT_PREFIX+mission.id),bytes);
 saveHistoryProgress(storage,{},mission.id,2);
 clearCompletedStoryAttempt(storage,scenario,"different-run-id");assert.equal(storage.getItem(STORY_ATTEMPT_PREFIX+mission.id),bytes);
 assert.throws(()=>clearCompletedStoryAttempt({...storage,getItem:()=>{throw Error("denied");}},scenario,finished.runId));
 assert.equal(storage.getItem(STORY_ATTEMPT_PREFIX+mission.id),bytes);
 clearCompletedStoryAttempt(storage,scenario,finished.runId);
 assert.equal(readStoryAttempt(storage,scenario).kind,"missing");assert.equal(readHistoryProgressStrict(storage)[mission.id],2);
});

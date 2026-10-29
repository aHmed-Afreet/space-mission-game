import test from "node:test";
import assert from "node:assert/strict";
import { storyFrame, refillStoryOxygen, storyPixelRatio, STORY_FRAME_MS, storyFrameDue } from "./storyRuntime";
import { readHistoryProgress, saveHistoryProgress, HISTORY_PROGRESS_KEY } from "./historyProgress";
import { historyMissions } from "./missionHistory";
import { createStoryScenario } from "./storyScenarios";

test("all Story modal pauses freeze physics time and oxygen, including exterior inertia",()=>{
  let oxygen=63;
  for(let frame=0;frame<1000;frame++){
    const step=storyFrame(oxygen,true,true,STORY_FRAME_MS/1000);
    assert.equal(step.delta,0); // The exact dt supplied to world.update: no thrust, fall, or inertia.
    assert.equal(step.emergencyReturn,false);oxygen=step.oxygen;
  }
  assert.equal(oxygen,63);
  assert.ok(storyFrame(oxygen,true,false,1/30).oxygen<oxygen);
  assert.equal(storyFrame(oxygen,false,false,1/30).oxygen,oxygen);
});

test("Apollo 11 depleted suit can recharge inside and resume every remaining field task",()=>{
  const scenario=createStoryScenario(historyMissions.find(m=>m.title==="Apollo 11")!);
  for(let stage=1;stage<scenario.tasks.length;stage++){
    const unfinished=scenario.tasks[stage];
    const depleted=storyFrame(.001,true,false,.06);
    assert.equal(depleted.emergencyReturn,true);assert.equal(depleted.oxygen,0);
    assert.equal(refillStoryOxygen(0,true,true),0,"no oxygen source outside");
    assert.equal(refillStoryOxygen(0,false,false),0,"must reach the cabin airlock supply");
    const recharged=refillStoryOxygen(depleted.oxygen,false,true);
    assert.equal(recharged,100);assert.ok(recharged>2,"exit gate permits EVA again");
    assert.equal(scenario.tasks[stage],unfinished,"refill never skips an unfinished action");
  }
});

test("healthy paced Story rendering keeps full resolution, slow rendering adapts within device limits",()=>{
  let ratio=1.55;
  for(let n=0;n<100;n++)ratio=storyPixelRatio(ratio,1.55,1000/STORY_FRAME_MS);
  assert.equal(ratio,1.55);
  assert.equal(storyPixelRatio(1.2,1.55,12),1.08);
  assert.equal(storyPixelRatio(.8,1.55,12),.8);
  assert.equal(storyPixelRatio(.6,.6,12),.6);
  assert.equal(storyPixelRatio(1.2,1.55,26),1.2);
});

test("normal 60 and 120 Hz callback jitter cannot turn a healthy Story into a low-FPS resolution downgrade",()=>{
  for(const hz of [60,120]){
    let last=0,frames=0;
    for(let i=1;i<=hz*10;i++){
      const now=i*1000/hz+(i%2?.08:-.08);
      if(storyFrameDue(now,last)){last=now;frames++;}
    }
    const fps=frames/10;
    assert.ok(fps>=28,`${hz} Hz device kept ${fps} frames per second`);
    assert.equal(storyPixelRatio(1.55,1.55,fps),1.55);
  }
});

test("Story completion commits retain old records and never claim success after a failed write",()=>{
  const values=new Map([[HISTORY_PROGRESS_KEY,JSON.stringify({"history-1":2,"history-2":1})]]);
  const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);}};
  const current=readHistoryProgress(storage);
  const failing={...storage,setItem:()=>{throw Error("quota");}};
  assert.throws(()=>saveHistoryProgress(failing,current,"history-3",2),/quota/);
  assert.deepEqual(readHistoryProgress(storage),current);
  assert.throws(()=>saveHistoryProgress(undefined,current,"history-3",2));
  const saved=saveHistoryProgress(storage,current,"history-3",2);
  assert.deepEqual(readHistoryProgress(storage),saved);assert.equal(saved["history-1"],2);
  assert.equal(saveHistoryProgress(storage,saved,"history-1",1)["history-1"],2,"best result stays intact");
});

test("all 55 historical experiences retain unique IDs and their complete task sequences",()=>{
  assert.equal(historyMissions.length,55);
  assert.equal(new Set(historyMissions.map(m=>m.id)).size,55);
  assert.equal(historyMissions.reduce((n,m)=>n+createStoryScenario(m).tasks.length,0),230);
  for(const mission of historyMissions){
    const tasks=createStoryScenario(mission).tasks;assert.ok(tasks.length>=4);
    assert.equal(new Set(tasks.map(t=>t.id)).size,tasks.length);
  }
});

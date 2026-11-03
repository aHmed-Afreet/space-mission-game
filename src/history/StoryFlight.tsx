import TouchActionButton from "../TouchActionButton";
import {useCallback,useEffect,useRef,useState} from "react";
import type {PointerEvent as ReactPointer} from "react";
import {joystickVector} from "../commander/controls";
import type {HistoryMission} from "./missionHistory";
import {createStoryScenario,type Station,type StoryTask,type FieldAction} from "./storyScenarios";
import { officialFilmFor } from "./officialFilms";
import {startStoryWorld,type StoryWorld} from "./storyWorld";
import { storyFrameDue, storyFrame, refillStoryOxygen } from "./storyRuntime";
import { storyFieldEligibility } from "./storyFieldActions";
import { readStoryAttempt, saveStoryAttempt, type StoryAttempt } from "./storyAttempt";
import { createForegroundClock } from "../commander/foregroundTime";
import { containModalFocus } from "../commander/modalFocus";
import { readHistoryProgressStrict } from "./historyProgress";
import { storyScienceExercise, type StoryScienceRecord } from "./storyScience";
import { createStoryThrust } from "./storyThrust";
import "./storyFlight.css";

const displayName:Record<Station,string>={
 brief:"Flight brief",systems:"Engineering",operations:"Mission operations",science:"Science / Data"
};
type PointerState={id:number,x:number,y:number};
function observeLimit(v:number){return Math.max(-1,Math.min(1,v));}
export default function StoryFlight({mission,onExit,onReadHistory,onComplete,saveError=""}:{
 mission:HistoryMission;onExit:()=>void;onReadHistory:()=>void;onComplete:(correct:boolean,runId:string)=>void;saveError?:string;
}){
 const scenario=createStoryScenario(mission);
 const matchingFilm=officialFilmFor(mission.title);
 const [initialCheckpoint]=useState(()=>{
  try{const checkpoint=readStoryAttempt(localStorage,scenario);
   if(checkpoint.kind==="valid"&&checkpoint.attempt.stage===scenario.tasks.length){
    try{if(readHistoryProgressStrict(localStorage)[mission.id]===2)return {kind:"missing" as const};}catch{/* Preserve the actual attempt when completion storage cannot be read. */}
   }
   return checkpoint;}catch{return {kind:"unavailable" as const,message:"Browser storage is unavailable. This exercise cannot be saved yet."};}
 });
 const resumed=initialCheckpoint.kind==="valid"?initialCheckpoint.attempt:null;
 const [runId]=useState(()=>resumed?.runId??(globalThis.crypto?.randomUUID?.()??`story-${Date.now()}-${Math.random().toString(36).slice(2)}`));
 const [attemptNotice,setAttemptNotice]=useState(initialCheckpoint.kind==="invalid"||initialCheckpoint.kind==="unavailable"?initialCheckpoint.message:resumed?"Saved exercise restored. Oxygen and movement resume only after you continue.":"");
 const attemptClock=useRef(resumed?.updatedAt??0);
 const persistRef=useRef<()=>boolean>(()=>false);
 const advanceRef=useRef<()=>void>(()=>{});
 const root=useRef<HTMLDivElement>(null);
 const canvas=useRef<HTMLCanvasElement>(null);
 const world=useRef<StoryWorld|null>(null);
 const keys=useRef(new Set<string>());
 const stick=useRef<{id:number;x:number;y:number;dx:number;dy:number}|null>(null);
 const lookPointer=useRef<PointerState|null>(null);
 const sprintPointer=useRef<PointerState|null>(null);
 const sprint=useRef(false);
 const [joystick,setJoystick]=useState<{x:number;y:number;dx:number;dy:number}|null>(null);
 const [aim,setAim]=useState<Station|null>(null);
 const [hatchAim,setHatchAim]=useState(false);
 const aimRef=useRef<Station|null>(null);
 const [stage,setStage]=useState(resumed?.stage??0);
 const [procedure,setProcedure]=useState<StoryTask|null>(resumed?.procedure?scenario.tasks[resumed.stage]:null);
 const [confirmed,setConfirmed]=useState(resumed?.procedure?.confirmed??false);
 const [powerVerified,setPowerVerified]=useState(resumed?.procedure?.powerVerified??false);
 const [telemetryVerified,setTelemetryVerified]=useState(resumed?.procedure?.telemetryVerified??false);
 const [operationArmed,setOperationArmed]=useState(resumed?.procedure?.operationArmed??false);
 const [measurement,setMeasurement]=useState(resumed?.procedure?.measurement??false);
 const [logged,setLogged]=useState<string[]>(resumed?.logged??[]);
 const [interpretation,setInterpretation]=useState<number|null>(resumed?.procedure?.interpretation??null);
 const [scienceRecords,setScienceRecords]=useState<StoryScienceRecord[]>(resumed?.scienceRecords??[]);
 const scienceExercise=storyScienceExercise(mission);
 const [paused,setPaused]=useState(false);
 const [showGuide,setShowGuide]=useState(!(resumed&&resumed.stage>=scenario.tasks.length));
 const [error,setError]=useState("");
 const [evaPanel,setEvaPanel]=useState(false);
 const [evaOutside,setEvaOutside]=useState(resumed?.world.outside??false);
 const evaOutsideRef=useRef(resumed?.world.outside??false);
 const [suitEquipped,setSuitEquipped]=useState(resumed?.suitEquipped??false);
 const [suitOxygen,setSuitOxygen]=useState(Math.round(resumed?.oxygen??100));
 const oxygenRef=useRef(resumed?.oxygen??100);
 const [evaNote,setEvaNote]=useState("");
 const [hatchPrepared,setHatchPrepared]=useState(resumed?.hatchPrepared??false);
 const [evaDistance,setEvaDistance]=useState(0);
 const [fieldFeedback,setFieldFeedback]=useState("");
 const verticalTouch=useRef(0);
 const suitReadout=useRef(0);
 const task=scenario.tasks[stage]??null;
 const activeStation=useRef<Station|null>(null);activeStation.current=task?.station??null;
 const completed=stage>=scenario.tasks.length;
 const pauseRef=useRef(false);
 pauseRef.current=paused||!!procedure||completed||showGuide||evaPanel;
 const thrust=useRef<ReturnType<typeof createStoryThrust>|null>(null);
 if(!thrust.current)thrust.current=createStoryThrust({
  flush:()=>advanceRef.current(),active:()=>!pauseRef.current,
  publish:value=>{verticalTouch.current=value;},
 });
 const simulationPaused=pauseRef.current;
 useEffect(()=>{
  const dialogs=root.current?.querySelectorAll<HTMLElement>(".story-fps-dialog");
  const dialog=dialogs?.[dialogs.length-1];
  if(!dialog)return;
  return containModalFocus({dialog,boundary:dialog.parentElement??dialog,onClose:()=>{
   if(error||completed)return;
   if(showGuide){setShowGuide(false);return;}
   if(paused){setPaused(false);return;}
   if(procedure){setProcedure(null);return;}
   setEvaPanel(false);
  }});
 },[showGuide,!!procedure,evaPanel,completed,paused,!!error]);
 const fieldReady=task?.fieldAction?storyFieldEligibility(task.fieldAction,evaOutside,evaDistance):null;
 persistRef.current=()=>{
  if(!world.current)return false;
  const checkpoint:StoryAttempt={version:1,missionId:mission.id,runId,
   updatedAt:Math.max(Date.now(),attemptClock.current+1),taskIds:scenario.tasks.map(t=>t.id),stage,
   completedTaskIds:scenario.tasks.slice(0,stage).map(t=>t.id),logged,
   procedure:procedure?{taskId:procedure.id,confirmed,powerVerified,telemetryVerified,operationArmed,measurement,interpretation}:null,
   suitEquipped,oxygen:oxygenRef.current,hatchPrepared,world:world.current.snapshot(),scienceRecords};
  try{saveStoryAttempt(localStorage,scenario,checkpoint);attemptClock.current=checkpoint.updatedAt;setAttemptNotice("");return true;}
  catch(e){setAttemptNotice(e instanceof Error?e.message:"Exercise could not be saved. Keep this tab open and retry.");return false;}
 };
 useEffect(()=>{persistRef.current();},[stage,procedure,confirmed,powerVerified,telemetryVerified,operationArmed,measurement,interpretation,scienceRecords,suitEquipped,hatchPrepared,evaOutside]);
 useEffect(()=>{
  if(!simulationPaused)return;
  keys.current.clear();stick.current=null;lookPointer.current=null;sprintPointer.current=null;
  sprint.current=false;thrust.current?.clear();setJoystick(null);
 },[simulationPaused]);
 const actRef=useRef<()=>void>(()=>{});
 actRef.current=()=>{
  if(pauseRef.current)return;
  const st=aimRef.current;
  if(scenario.role==="astronaut"&&world.current?.aimingAtHatch()){
    setEvaNote("");setEvaPanel(true);return;
  }
  if(st&&task&&!task.fieldAction&&st===task.station&&!evaOutsideRef.current){
   setProcedure(task);setConfirmed(false);setPowerVerified(false);setTelemetryVerified(false);setOperationArmed(false);setMeasurement(false);setInterpretation(null);
  }
 };
 const onLook=useCallback((dx:number,dy:number)=>world.current?.look(dx,dy),[]);
 useEffect(()=>{
  if(!canvas.current)return;
  let instance:StoryWorld;
  try{instance=startStoryWorld(canvas.current,scenario);world.current=instance;
   if(resumed&&!instance.restore(resumed.world)){
    setError("The saved exercise position is invalid for this mission. Its original checkpoint has been preserved.");
    instance.dispose();world.current=null;return;
   }
   setEvaDistance(instance.distanceToHatch());
  }
  catch(e){setError("3D graphics are unavailable in this browser. Try another browser with WebGL enabled.");return;}
  let frame=0,last=0,lastCheckpoint=0,lastAim:Station|null=null,lastHatchAim=false;
  const clock=createForegroundClock({stepSeconds:1/120,maxFrameSeconds:2});
  const advance=(time:number)=>{
   let x=0,y=0;
   if(!pauseRef.current){
    if(keys.current.has("w")||keys.current.has("arrowup"))y++;
    if(keys.current.has("s")||keys.current.has("arrowdown"))y--;
    if(keys.current.has("a")||keys.current.has("arrowleft"))x--;
    if(keys.current.has("d")||keys.current.has("arrowright"))x++;
    if(stick.current){const s=joystickVector(stick.current.dx,stick.current.dy,59);x+=s.x;y-=s.y;}
   }
   const vertical=pauseRef.current?0:(keys.current.has(" ")||keys.current.has("pageup")?1:0)-(keys.current.has("control")||keys.current.has("pagedown")?1:0)+verticalTouch.current;
   let aimed=lastAim,emergencyReturn=false;
   const elapsed=clock.advance(time,{active:!pauseRef.current,visible:!document.hidden},delta=>{
    const step=storyFrame(oxygenRef.current,evaOutsideRef.current,false,delta);
    oxygenRef.current=step.oxygen;emergencyReturn ||= step.emergencyReturn;
    aimed=instance.update(observeLimit(x),observeLimit(y),sprint.current||keys.current.has("shift"),step.delta,activeStation.current,observeLimit(vertical));
   });
   if(elapsed.steps===0)aimed=instance.update(0,0,false,0,activeStation.current,0);
   if(time-lastCheckpoint>=5000){persistRef.current();lastCheckpoint=time;}
   if(evaOutsideRef.current){
    suitReadout.current+=elapsed.acceptedSeconds;
    const trueDistance=instance.distanceToHatch();
    setEvaDistance(d=>Math.abs(d-trueDistance)>.001?trueDistance:d);
    if(suitReadout.current>=.5){
     setSuitOxygen(Math.round(oxygenRef.current));
     suitReadout.current=0;
    }
    if(emergencyReturn){
     evaOutsideRef.current=false;instance.setExcursion(false);setEvaOutside(false);
     setSuitOxygen(0);setHatchPrepared(false);
     setEvaNote("Emergency training return: suit oxygen depleted. Restore reserves before another EVA.");
     setEvaPanel(true);
    }
   }
   if(lastAim!==aimed){lastAim=aimed;aimRef.current=aimed;setAim(aimed);}
   const nowHatchAim=scenario.role==="astronaut"&&instance.aimingAtHatch();
   if(nowHatchAim!==lastHatchAim){lastHatchAim=nowHatchAim;setHatchAim(nowHatchAim);}
  };
  advanceRef.current=()=>advance(performance.now());
  const tick=(time:number)=>{
   frame=requestAnimationFrame(tick);
   if(!storyFrameDue(time,last))return;
   last=time;advance(performance.now());
  };
  const resize=()=>instance.resize();
  const down=(e:KeyboardEvent)=>{
   advanceRef.current();
   if(e.key==="Escape"){if(pauseRef.current)return;e.preventDefault();setPaused(true);return;}
   if(pauseRef.current)return;
   if(e.key.toLowerCase()==="e"&&!e.repeat){e.preventDefault();actRef.current();}
   if((e.key===" "||e.key==="Spacebar")&&!e.repeat)world.current?.jump();
   if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key))e.preventDefault();
   keys.current.add(e.key.toLowerCase());
  };
  const up=(e:KeyboardEvent)=>{advanceRef.current();keys.current.delete(e.key.toLowerCase());};
  const blur=()=>{advanceRef.current();keys.current.clear();sprint.current=false;stick.current=null;lookPointer.current=null;sprintPointer.current=null;thrust.current?.clear();setJoystick(null);persistRef.current();};
  const visibility=()=>{blur();clock.reset();};
  const pagehide=()=>persistRef.current();
  window.addEventListener("keydown",down);
  window.addEventListener("keyup",up);
  window.addEventListener("blur",blur);
  window.addEventListener("resize",resize);
  window.addEventListener("pagehide",pagehide);document.addEventListener("visibilitychange",visibility);
  frame=requestAnimationFrame(tick);
  return ()=>{
   cancelAnimationFrame(frame);advanceRef.current=()=>{};instance.dispose();world.current=null;
   keys.current.clear();window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);
   window.removeEventListener("blur",blur);window.removeEventListener("resize",resize);
   window.removeEventListener("pagehide",pagehide);document.removeEventListener("visibilitychange",visibility);
  };
 },[mission.id]);
 const beginStick=(e:ReactPointer<HTMLDivElement>)=>{
  if(pauseRef.current)return;
  e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);
  stick.current={id:e.pointerId,x:e.clientX,y:e.clientY,dx:0,dy:0};
  setJoystick({x:e.clientX,y:e.clientY,dx:0,dy:0});
 };
 const moveStick=(e:ReactPointer<HTMLDivElement>)=>{
  const s=stick.current;if(!s||s.id!==e.pointerId)return;
  const dx=e.clientX-s.x,dy=e.clientY-s.y,mag=Math.hypot(dx,dy),f=mag>59?59/mag:1;
  s.dx=dx*f;s.dy=dy*f;setJoystick({x:s.x,y:s.y,dx:s.dx,dy:s.dy});
 };
 const stopStick=(e:ReactPointer<HTMLDivElement>)=>{
  if(stick.current?.id!==e.pointerId)return;stick.current=null;setJoystick(null);
 };
 const beginLook=(e:ReactPointer<HTMLDivElement>)=>{
  if(pauseRef.current)return;
  if(e.pointerType==="mouse"&&e.button!==0)return;
  e.currentTarget.setPointerCapture(e.pointerId);
  lookPointer.current={id:e.pointerId,x:e.clientX,y:e.clientY};
 };
 const moveLook=(e:ReactPointer<HTMLDivElement>)=>{
  const p=lookPointer.current;if(!p||p.id!==e.pointerId||pauseRef.current)return;
  onLook(e.clientX-p.x,e.clientY-p.y);p.x=e.clientX;p.y=e.clientY;
 };
 const endLook=(e:ReactPointer<HTMLDivElement>)=>{
  if(lookPointer.current?.id===e.pointerId)lookPointer.current=null;
 };
 const beginSprint=(e:ReactPointer<HTMLButtonElement>)=>{
  if(pauseRef.current)return;
  e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);sprint.current=true;
  sprintPointer.current={id:e.pointerId,x:e.clientX,y:e.clientY};
 };
 const moveSprint=(e:ReactPointer<HTMLButtonElement>)=>{
  const p=sprintPointer.current;if(!p||p.id!==e.pointerId||pauseRef.current)return;
  onLook(e.clientX-p.x,e.clientY-p.y);p.x=e.clientX;p.y=e.clientY;
 };
 const endSprint=(e:ReactPointer<HTMLButtonElement>)=>{
  if(sprintPointer.current?.id!==e.pointerId)return;
  sprintPointer.current=null;sprint.current=false;
 };
 const canFinish=!!procedure&&confirmed&&(
  procedure.station==="brief"||
  (procedure.station==="systems"&&powerVerified&&telemetryVerified)||
  (procedure.station==="operations"&&operationArmed)||
  (procedure.station==="science"&&measurement)
 );
 const completeField=(action:FieldAction)=>{
  advanceRef.current();
  if(!task||task.fieldAction!==action)return;
  const eligibility=storyFieldEligibility(action,evaOutsideRef.current,world.current?.distanceToHatch()??NaN);
  if(!eligibility.ready){setFieldFeedback(eligibility.feedback);setEvaDistance(world.current?.distanceToHatch()??0);return;}
  setFieldFeedback("");
  setLogged(a=>[...a,task.complete]);
  setStage(s=>s+1);
 };
 const captureScience=()=>{
  if(!procedure||procedure.station!=="science")return;
  setMeasurement(true);
  setScienceRecords(records=>[...records.filter(r=>r.taskId!==procedure.id),{version:1,taskId:procedure.id,exercise:scienceExercise,interpretation:interpretation as 0|1|null}]);
 };
 const chooseInterpretation=(choice:0|1)=>{
  setInterpretation(choice);
  if(procedure&&measurement)setScienceRecords(records=>records.map(r=>r.taskId===procedure.id?{...r,interpretation:choice}:r));
 };
 const finishTask=()=>{
  if(!task||!canFinish)return;
  setLogged(a=>[...a,task.complete]);
  setStage(s=>s+1);setProcedure(null);setConfirmed(false);
 };
 const quit=()=>{sprint.current=false;persistRef.current();onExit();};
 const readHistory=()=>{persistRef.current();onReadHistory();};
 const canEva=scenario.role==="astronaut";
 const refillSuit=()=>{
  if(evaOutsideRef.current||!world.current?.nearHatch())return;
  oxygenRef.current=refillStoryOxygen(oxygenRef.current,false,true);
  setSuitOxygen(oxygenRef.current);suitReadout.current=0;setHatchPrepared(false);
  setEvaNote("Suit oxygen replenished from cabin reserves. Prepare the hatch again and resume the unfinished mission task.");
 };
 const openEva=()=>{
  if(!canEva||pauseRef.current)return;
  if(!world.current?.nearHatch()){setEvaNote("Move to the airlock hatch at the rear of the cabin, or return near the spacecraft to re-enter.");setEvaPanel(true);return;}
  setEvaNote("");setEvaPanel(true);
 };
 const cycleEva=()=>{
  if(!world.current?.nearHatch())return;
  if(!evaOutside&&(!suitEquipped||!hatchPrepared))return;
  if(!evaOutside&&oxygenRef.current<=2)return;
  const next=!evaOutside;
  world.current.setExcursion(next);
  evaOutsideRef.current=next;setEvaOutside(next);setEvaPanel(false);
  setHatchPrepared(false);thrust.current?.clear();
  setEvaDistance(world.current.distanceToHatch());
  if(task?.fieldAction==="egress"&&next){setLogged(a=>[...a,task.complete]);setStage(s=>s+1);}
  if(task?.fieldAction==="return"&&!next){setLogged(a=>[...a,task.complete]);setStage(s=>s+1);}
 };
 return <div ref={root} className="story-fps-root"
  onPointerDownCapture={()=>advanceRef.current()} onPointerMoveCapture={()=>advanceRef.current()}
  onPointerUpCapture={()=>advanceRef.current()} onPointerCancelCapture={()=>advanceRef.current()}
  onLostPointerCaptureCapture={()=>advanceRef.current()} onClickCapture={()=>advanceRef.current()}>
  <canvas ref={canvas} className="story-fps-canvas" aria-label={"First person interactive 3D training scene for "+mission.title}/>
  <header className="story-fps-top">
   <TouchActionButton type="button" onActivate={()=>setPaused(true)}>← Missions</TouchActionButton>
   <div><strong>{mission.title}</strong><small>{mission.year} · {scenario.craft}</small></div>
   <div className="story-fps-top-actions">
    {canEva&&<TouchActionButton type="button" className="story-fps-eva-button" onActivate={openEva}>
      {evaOutside?"RETURN / AIRLOCK":"EVA / AIRLOCK"}
    </TouchActionButton>}
    <TouchActionButton type="button" onActivate={()=>setPaused(true)}>II MENU</TouchActionButton>
   </div>
  </header>
  <div className="story-fps-panels">
  {evaOutside&&<div className="story-fps-suit-hud" role="status">
    <strong>● SUIT SEALED · {scenario.setting==="moon"?"LUNAR SURFACE":scenario.setting==="mars"?"SURFACE EVA":"ORBITAL EVA"}</strong>
    <span>O₂ {suitOxygen}% · SUIT SEALED · {evaDistance.toFixed(1)} m FROM HATCH</span>
    <small>{scenario.setting==="moon"?"LOW GRAVITY · JUMP AND WALK":scenario.setting==="mars"?"MARS GRAVITY · JUMP AND WALK":"ORBITAL THRUSTERS · UP / DOWN · 24 m TETHER"} · RETURN TO HATCH</small>
   </div>}
  <div className="story-fps-objective">
   <small>{task?.fieldAction?"APOLLO 11 · DOCUMENTED MOONWALK RECREATION":evaOutside?"OPTIONAL EVA TRAINING — ORIGINAL MISSION TASKS REMAIN INSIDE":scenario.role==="astronaut"?"ASTRONAUT TRAINING":"REMOTE OPERATIONS / NO CREW ABOARD"}</small>
   <h2>{completed?"History exercise complete":task.heading}</h2>
   <details className="story-fps-objective-detail"><summary>Read mission instructions</summary><p>{completed?mission.outcome:task.procedure}</p></details>
   <span>{task?.fieldAction?"HISTORICAL ACTION":"PROCEDURE"} {Math.min(stage+1,scenario.tasks.length)} / {scenario.tasks.length} · {task?.fieldAction?"DOCUMENTED NASA EVA SEQUENCE":scenario.profile.visual}</span>
   {attemptNotice&&<p className="story-fps-save-status" role="status">{attemptNotice}</p>}
   <div className="story-fps-progress">{scenario.tasks.map((s,i)=><i key={s.id} className={i<stage?"done":i===stage?"current":""}/>)}</div>
  </div>
  {task?.fieldAction&&evaOutside&&task.fieldAction!=="egress"&&task.fieldAction!=="return"&&
    <div className="story-fps-historical-action">
      <small>DOCUMENTED NASA EVA TASK · {stage+1}/{scenario.tasks.length}</small>
      <strong>{task.heading}</strong>
      <p role="status">{fieldFeedback||fieldReady?.feedback}</p>
      <TouchActionButton type="button" disabled={!fieldReady?.ready}
        onActivate={()=>completeField(task.fieldAction!)}>{
          task.fieldAction==="walk"?"EXAMINE LUNAR SOIL":
          task.fieldAction==="photo"?"TAKE FIELD PHOTOGRAPH":
          task.fieldAction==="sample"?"COLLECT CONTINGENCY SAMPLE":
          "DEPLOY FLAG WITH CREW"}</TouchActionButton>
      <details><summary>About this reconstruction</summary><small>Equipment interaction is a simplified teaching model, not an exact recreation of the astronaut's hand movements.</small></details>
    </div>}
  </div>
  {!completed&&<div className="story-fps-target" aria-live="polite">
   <div className="story-fps-crosshair">+</div>
   {hatchAim?<span>AIRLOCK CONTROL · PRESS INTERACT</span>:!task?.fieldAction&&aim&&<span>{displayName[aim]} · {aim===task.station?"PRESS INTERACT":"Find "+displayName[task.station]}</span>}
  </div>}
  <div className="story-fps-instruction">{task?.fieldAction?
    task.fieldAction==="egress"?"EQUIP SUIT · GO TO HATCH · ENTER SURFACE":
    task.fieldAction==="return"?"RETURN TO EAGLE · OPEN AIRLOCK · ENTER":
    `WALK ON THE LUNAR SURFACE · ${evaDistance.toFixed(1)} m FROM EAGLE`:
    evaOutside?"EXPLORE THE ENVIRONMENT · RETURN TO HATCH FOR ORIGINAL TASKS":
    `FIND ${task?displayName[task.station].toUpperCase():"MISSION COMPLETE"} · AIM + INTERACT`}</div>
  <div className="story-fps-look" onPointerDown={beginLook} onPointerMove={moveLook} onPointerUp={endLook} onPointerCancel={endLook} onLostPointerCapture={endLook} aria-label="Drag to look around"/>
  <div className="story-fps-movement" onPointerDown={beginStick} onPointerMove={moveStick}
    onPointerUp={stopStick} onPointerCancel={stopStick} onLostPointerCapture={stopStick} aria-label="Touch to move">
    {joystick&&<div className="story-fps-joystick" style={{left:joystick.x,top:joystick.y}}>
      <div style={{transform:"translate("+joystick.dx+"px,"+joystick.dy+"px)"}}/>
    </div>}
  </div>
  {evaOutside&&<div className="story-fps-eva-vertical">
    {scenario.setting==="moon"||scenario.setting==="mars"
      ? <TouchActionButton type="button" onActivate={()=>world.current?.jump()} aria-label="Jump in low gravity">JUMP</TouchActionButton>
      : <>
       <button type="button" onPointerDown={e=>{if(pauseRef.current)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);thrust.current?.press(e.pointerId,1);}}
         onPointerUp={e=>thrust.current?.release(e.pointerId)} onPointerCancel={e=>thrust.current?.release(e.pointerId)}
         onLostPointerCapture={e=>thrust.current?.release(e.pointerId)} aria-label="Ascend in zero gravity">↑ UP</button>
       <button type="button" onPointerDown={e=>{if(pauseRef.current)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);thrust.current?.press(e.pointerId,-1);}}
         onPointerUp={e=>thrust.current?.release(e.pointerId)} onPointerCancel={e=>thrust.current?.release(e.pointerId)}
         onLostPointerCapture={e=>thrust.current?.release(e.pointerId)} aria-label="Descend in zero gravity">↓ DOWN</button>
      </>}
   </div>}
  <div className="story-fps-actions">
    <button type="button" className="story-fps-sprint" onPointerDown={beginSprint} onPointerMove={moveSprint}
      onPointerUp={endSprint} onPointerCancel={endSprint} onLostPointerCapture={endSprint}>SPRINT</button>
    <TouchActionButton type="button" className="story-fps-interact" disabled={!!procedure||completed||paused||showGuide||evaPanel||!(hatchAim||(!task?.fieldAction&&!evaOutside&&aim===task?.station))}
      onActivate={()=>actRef.current()}>INTERACT</TouchActionButton>
  </div>
  {evaPanel&&<div className="story-fps-shade"><section className="story-fps-dialog" role="dialog" aria-modal="true" aria-label="EVA safety and airlock">
    <small>MISSION EQUIPMENT · PRESSURE LOCK · PROTECTIVE SUIT</small>
    <h2>{evaOutside?"Return aboard spacecraft":"Prepare for exterior exploration"}</h2>
    <p>{scenario.setting==="moon"?"Exterior: lunar regolith, boulders and low gravity.":scenario.setting==="mars"?"Exterior: planetary terrain.":"Exterior: open space with your actual destination visible."}</p>
    <p><strong>Safety:</strong> {scenario.tasks.some(t=>t.fieldAction)
      ? "This mission requires the selected documented Apollo 11 surface sequence. Suit and hatch controls are simplified educational reconstructions."
      : "This is an optional fictional training excursion. Some historic crews never performed EVA. It is not an additional claimed event in the real mission."}</p>
    <p>{evaNote||"Approach the airlock, prepare the spacesuit, equalize the fictional chamber, and use the control on your side of the hatch."}</p>
    {!evaOutside&&<TouchActionButton type="button" className={suitEquipped?"story-fps-armed":"story-fps-minor"} onActivate={()=>setSuitEquipped(true)}>
      {suitEquipped?"✓ HELMET SEALED · GLOVES SECURED · O₂ CONNECTED":"EQUIP PROTECTIVE SPACE SUIT"}
    </TouchActionButton>}
    <div className="story-fps-readout">SUIT OXYGEN <strong>{suitOxygen}%</strong></div>
    {!evaOutside&&<TouchActionButton type="button" className="story-fps-minor" disabled={!world.current?.nearHatch()||suitOxygen>=100} onActivate={refillSuit}>
      REPLENISH SUIT OXYGEN FROM CABIN
    </TouchActionButton>}
    {!evaOutside&&suitEquipped&&<TouchActionButton type="button" className={hatchPrepared?"story-fps-armed":"story-fps-minor"}
      onActivate={()=>setHatchPrepared(true)}>
       {hatchPrepared?"✓ INNER HATCH SEALED · CHAMBER SIMULATED AT VACUUM":"CLOSE INNER HATCH · SIMULATE DEPRESSURIZATION"}
    </TouchActionButton>}
    <TouchActionButton type="button" disabled={!world.current?.nearHatch()||(!evaOutside&&(!suitEquipped||!hatchPrepared||suitOxygen<=2))} onActivate={cycleEva}>
      {evaOutside?"CLOSE OUTER HATCH · REPRESSURIZE · ENTER":"OPEN OUTER HATCH · EXIT IN SUIT"}
    </TouchActionButton>
    <TouchActionButton type="button" className="story-fps-minor" onActivate={()=>setEvaPanel(false)}>BACK TO GAME</TouchActionButton>
   </section></div>}
  {showGuide&&<div className="story-fps-shade"><section className="story-fps-dialog" role="dialog" aria-modal="true" aria-label="Mission guide">
    <small>REAL HISTORY · FIRST-PERSON OPERATIONS</small>
    <h1>{mission.title}</h1><p>{scenario.historicalNote}</p>
    <p><strong>Spacecraft represented:</strong> {scenario.craft}</p><p><strong>Recognizable hardware:</strong> {scenario.profile.visual}. {scenario.profile.hardware}.</p>
    <p><strong>Your role:</strong> {scenario.role==="astronaut"?"First-person astronaut in a stylized mission training environment. Real spacecraft interiors were generally much smaller.":"First-person mission controller on Earth using remote spacecraft telemetry. The uncrewed vehicle is represented by a 3D model, not an astronaut aboard it."}</p>
    <p><strong>Objective:</strong> {mission.mission}</p>
    {matchingFilm&&<p><strong>Official video:</strong> <a href={matchingFilm.url} rel="noopener noreferrer" target="_blank">{matchingFilm.title} · NASA ↗</a>. The following tasks represent documented actions in chronological order; some movement and controls are simplified.</p>}
    {task?.fieldAction&&<p><strong>Apollo 11 EVA:</strong> Wear the suit, use the hatch, walk on the lunar surface, perform the field actions in order and return to Eagle. This is a selected segment of the moonwalk, not the entire three-hour EVA.</p>}
    <p>Move with WASD or the floating joystick; drag to look. Outside, use UP/DOWN (Space/Ctrl) to steer in zero gravity or JUMP on a surface. To leave, visit the airlock, equip a suit and close the inner hatch before depressurizing. Return through the exterior hatch. {scenario.tasks.some(t=>t.fieldAction)?"Complete the required surface tasks and return to Eagle. Replenish suit oxygen inside if necessary.":"EVA training is optional and does not change real history."}</p>
    {attemptNotice&&<p role="status">{attemptNotice}</p>}
    <TouchActionButton type="button" onActivate={()=>setShowGuide(false)}>{resumed?"RESUME SAVED 3D MISSION →":"BEGIN 3D MISSION →"}</TouchActionButton>
    <TouchActionButton type="button" className="story-fps-minor" onActivate={readHistory}>READ REAL HISTORY</TouchActionButton>
  </section></div>}
  {procedure&&!showGuide&&!paused&&<div className="story-fps-shade"><section className="story-fps-dialog" role="dialog" aria-modal="true" aria-label="Mission procedure">
    <small>MISSION CONTROL PROCEDURE · {displayName[procedure.station].toUpperCase()}</small>
    <h2>{procedure.heading}</h2>
    <p>{procedure.procedure}</p>
    <div className="story-fps-instrument">
      {procedure.station==="brief"&&<p>Confirm the mission's historical objective and the necessary flight checklist.</p>}
      {procedure.station==="systems"&&<>
        <p><strong>Historical hardware:</strong> {scenario.profile.hardware}</p>
        <p>This is a training-system checkout, not a real spacecraft switch sequence. Inspect both simulated subsystems:</p>
        <TouchActionButton type="button" className={powerVerified?"story-fps-armed":"story-fps-minor"}
          onActivate={()=>setPowerVerified(true)}>
          {powerVerified?"✓ POWER / THERMAL STATUS VERIFIED":"VERIFY POWER & THERMAL STATUS"}
        </TouchActionButton>
        <TouchActionButton type="button" className={telemetryVerified?"story-fps-armed":"story-fps-minor"}
          onActivate={()=>setTelemetryVerified(true)}>
          {telemetryVerified?"✓ COMMUNICATIONS STATUS VERIFIED":"VERIFY TELEMETRY & COMMUNICATIONS"}
        </TouchActionButton>
        <div className="story-fps-readout">{scenario.profile.hardware} <strong>{powerVerified&&telemetryVerified?"CHECKS COMPLETE":"CHECKS PENDING"}</strong></div>
      </>}
      {procedure.station==="operations"&&<>
        <p><strong>Historical task:</strong> {scenario.profile.operation}</p><p>Activate the simulated task sequence to record that this historical operation has been reviewed.</p>
        <TouchActionButton type="button" className={operationArmed?"story-fps-armed":"story-fps-minor"} onActivate={()=>setOperationArmed(true)}>
          {operationArmed?"✓ MISSION SEQUENCE ARMED":"ARM "+procedure.action.toUpperCase()}</TouchActionButton>
      </>}
      {procedure.station==="science"&&<>
        <p><strong>Historical observation goal:</strong> {scenario.profile.observation}</p>
        <p><strong>SYNTHETIC TRAINING DATA · MODEL v{scienceExercise.modelVersion}</strong> These invented examples teach interpretation. They are not measurements from NASA or this historical mission.</p>
        <h3>{scienceExercise.title}</h3>
        <table className="story-fps-science-table"><tbody>{scienceExercise.rows.map(row=><tr key={row.label}><th scope="row">{row.label}</th><td>{row.value} {row.unit}</td></tr>)}</tbody></table>
        <p>{scienceExercise.question}</p>
        {scienceExercise.choices.map((choice,index)=><TouchActionButton type="button" key={choice} className={interpretation===index?"story-fps-armed":"story-fps-minor"} aria-pressed={interpretation===index} onActivate={()=>chooseInterpretation(index as 0|1)}>{choice}</TouchActionButton>)}
        {interpretation!==null&&<p role="status">{interpretation===scienceExercise.correct?"Correct interpretation. ":"Recheck the interpretation. "}{scienceExercise.explanation}</p>}
        <p>Interpretation practice is optional; it adds no required task or reward. Capture files the example and your actual answer.</p>
        <a href={scienceExercise.source} target="_blank" rel="noopener noreferrer">Mission context and historical records ↗</a>
        <TouchActionButton type="button" className={measurement?"story-fps-armed":"story-fps-minor"} onActivate={captureScience}>
          {measurement?"✓ OBSERVATION CAPTURED":"CAPTURE SCIENCE READING"}</TouchActionButton>
      </>}
    </div>
    <div className="story-fps-check">
     <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>
       Verify the checklist and acknowledge the simulated operation.
     </label>
    </div>
    <TouchActionButton type="button" disabled={!canFinish} onActivate={finishTask}>{procedure.action.toUpperCase()} ✓</TouchActionButton>
    <TouchActionButton type="button" className="story-fps-minor" onActivate={()=>setProcedure(null)}>BACK TO SPACECRAFT</TouchActionButton>
  </section></div>}
  {completed&&<div className="story-fps-shade"><section className="story-fps-dialog" role="dialog" aria-modal="true" aria-label="Mission completed">
    <small>HISTORICAL MISSION · TRAINING COMPLETE</small>
    <h1>{mission.title} — Mission Record</h1>
    <p><strong>What really happened:</strong> {mission.outcome}</p>
    <p><strong>Historical challenge:</strong> {mission.challenge}</p>
    <p><strong>Skill practiced:</strong> {mission.skill}</p>
    <ul>{logged.map((entry,i)=><li key={i}>{entry}</li>)}</ul>
    {scienceRecords.length>0&&<details><summary>Captured training observations ({scienceRecords.length})</summary>
     <p>Synthetic training data, model v1. These are the examples you captured; no historical spacecraft measurements are implied.</p>
     {scienceRecords.map(record=><article key={record.taskId}><h3>{record.exercise.title}</h3><ul>{record.exercise.rows.map(row=><li key={row.label}>{row.label}: {row.value} {row.unit}</li>)}</ul><p>Interpretation: {record.interpretation===null?"not answered":record.exercise.choices[record.interpretation]}</p></article>)}
    </details>}
    <p>The spacecraft shapes and workstations are educational approximations, not flight-ready layouts. Procedures are simplified; historical outcomes remain unchanged.</p>
    {saveError&&<p role="alert">{saveError}</p>}
    <TouchActionButton type="button" onActivate={()=>{persistRef.current();onComplete(true,runId);}}>{saveError?"RETRY SAVE COMPLETION & RETURN":"SAVE COMPLETION & RETURN"}</TouchActionButton>
    <TouchActionButton type="button" className="story-fps-minor" onActivate={readHistory}>READ THE ACTUAL HISTORY</TouchActionButton>
    <a href={mission.source} target="_blank" rel="noopener noreferrer">Official mission archive ↗</a>
  </section></div>}
  {paused&&!showGuide&&!completed&&<div className="story-fps-shade"><section className="story-fps-dialog" role="dialog" aria-modal="true" aria-label="Mission paused">
    <small>MISSION PAUSED</small><h2>{mission.title}</h2>
    <p>Your task, procedure, suit oxygen and position are saved separately from earned story completions. Return to this story to resume.</p>
    {attemptNotice&&<p role="alert">{attemptNotice}</p>}
    <TouchActionButton type="button" className="story-fps-minor" onActivate={()=>persistRef.current()}>SAVE EXERCISE CHECKPOINT</TouchActionButton>
    <TouchActionButton type="button" onActivate={()=>setPaused(false)}>RESUME MISSION</TouchActionButton>
    <TouchActionButton type="button" className="story-fps-minor" onActivate={readHistory}>READ HISTORY</TouchActionButton>
    <TouchActionButton type="button" className="story-fps-minor" onActivate={quit}>BACK TO MISSION LIST</TouchActionButton>
  </section></div>}
  {error&&<div className="story-fps-shade"><section className="story-fps-dialog" role="dialog" aria-modal="true" aria-label="3D unavailable"><h2>3D unavailable</h2><p>{error}</p><TouchActionButton onActivate={readHistory}>Read mission history</TouchActionButton></section></div>}
 </div>;
}

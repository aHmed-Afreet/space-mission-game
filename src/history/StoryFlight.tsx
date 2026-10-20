import {useCallback,useEffect,useRef,useState} from "react";
import type {PointerEvent as ReactPointer} from "react";
import {joystickVector} from "../commander/controls";
import type {HistoryMission} from "./missionHistory";
import {createStoryScenario,type Station,type StoryTask} from "./storyScenarios";
import {startStoryWorld,type StoryWorld} from "./storyWorld";
import "./storyFlight.css";

const displayName:Record<Station,string>={
 brief:"Flight brief",systems:"Engineering",operations:"Mission operations",science:"Science / Data"
};
type PointerState={id:number,x:number,y:number};
function observeLimit(v:number){return Math.max(-1,Math.min(1,v));}
export default function StoryFlight({mission,onExit,onReadHistory,onComplete}:{
 mission:HistoryMission;onExit:()=>void;onReadHistory:()=>void;onComplete:(correct:boolean)=>void;
}){
 const scenario=createStoryScenario(mission);
 const canvas=useRef<HTMLCanvasElement>(null);
 const world=useRef<StoryWorld|null>(null);
 const keys=useRef(new Set<string>());
 const stick=useRef<{id:number;x:number;y:number;dx:number;dy:number}|null>(null);
 const lookPointer=useRef<PointerState|null>(null);
 const sprintPointer=useRef<PointerState|null>(null);
 const sprint=useRef(false);
 const [joystick,setJoystick]=useState<{x:number;y:number;dx:number;dy:number}|null>(null);
 const [aim,setAim]=useState<Station|null>(null);
 const aimRef=useRef<Station|null>(null);
 const [stage,setStage]=useState(0);
 const [procedure,setProcedure]=useState<StoryTask|null>(null);
 const [confirmed,setConfirmed]=useState(false);
 const [calibration,setCalibration]=useState(35);
 const [operationArmed,setOperationArmed]=useState(false);
 const [measurement,setMeasurement]=useState(false);
 const [logged,setLogged]=useState<string[]>([]);
 const [paused,setPaused]=useState(false);
 const [showGuide,setShowGuide]=useState(true);
 const [error,setError]=useState("");
 const task=scenario.tasks[stage]??null;
 const completed=stage>=scenario.tasks.length;
 const pauseRef=useRef(false);
 pauseRef.current=paused||!!procedure||completed||showGuide;
 const actRef=useRef<()=>void>(()=>{});
 actRef.current=()=>{
  if(pauseRef.current)return;
  const st=aimRef.current;
  if(st&&task&&st===task.station){
   setProcedure(task);setConfirmed(false);setCalibration(35);setOperationArmed(false);setMeasurement(false);
  }
 };
 const onLook=useCallback((dx:number,dy:number)=>world.current?.look(dx,dy),[]);
 useEffect(()=>{
  if(!canvas.current)return;
  let instance:StoryWorld;
  try{instance=startStoryWorld(canvas.current,scenario);world.current=instance;}
  catch(e){setError("3D graphics are unavailable in this browser. Try another browser with WebGL enabled.");return;}
  let frame=0,last=0,lastAim:Station|null=null;
  const tick=(time:number)=>{
   frame=requestAnimationFrame(tick);
   if(time-last<30)return;
   const delta=Math.min((time-last)/1000,.06);last=time;
   let x=0,y=0;
   if(!pauseRef.current){
    if(keys.current.has("w")||keys.current.has("arrowup"))y++;
    if(keys.current.has("s")||keys.current.has("arrowdown"))y--;
    if(keys.current.has("a")||keys.current.has("arrowleft"))x--;
    if(keys.current.has("d")||keys.current.has("arrowright"))x++;
    if(stick.current){const s=joystickVector(stick.current.dx,stick.current.dy,59);x+=s.x;y-=s.y;}
   }
   const aimed=instance.update(observeLimit(x),observeLimit(y),sprint.current||keys.current.has("shift"),delta);
   if(lastAim!==aimed){lastAim=aimed;aimRef.current=aimed;setAim(aimed);}
  };
  const resize=()=>instance.resize();
  const down=(e:KeyboardEvent)=>{
   if(e.key.toLowerCase()==="e"&&!e.repeat){e.preventDefault();actRef.current();}
   if(e.key==="Escape")setPaused(p=>!p);
   if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key))e.preventDefault();
   keys.current.add(e.key.toLowerCase());
  };
  const up=(e:KeyboardEvent)=>keys.current.delete(e.key.toLowerCase());
  const blur=()=>{keys.current.clear();sprint.current=false;stick.current=null;};
  window.addEventListener("keydown",down);
  window.addEventListener("keyup",up);
  window.addEventListener("blur",blur);
  window.addEventListener("resize",resize);
  frame=requestAnimationFrame(tick);
  return ()=>{
   cancelAnimationFrame(frame);instance.dispose();world.current=null;
   keys.current.clear();window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);
   window.removeEventListener("blur",blur);window.removeEventListener("resize",resize);
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
  (procedure.station==="systems"&&calibration>=70&&calibration<=85)||
  (procedure.station==="operations"&&operationArmed)||
  (procedure.station==="science"&&measurement)
 );
 const finishTask=()=>{
  if(!task||!canFinish)return;
  setLogged(a=>[...a,task.complete]);
  setStage(s=>s+1);setProcedure(null);setConfirmed(false);
 };
 const quit=()=>{sprint.current=false;onExit();};
 return <div className="story-fps-root">
  <canvas ref={canvas} className="story-fps-canvas" aria-label={"First person interactive 3D training scene for "+mission.title}/>
  <header className="story-fps-top">
   <button type="button" onClick={()=>setPaused(true)}>← Missions</button>
   <div><strong>{mission.title}</strong><small>{mission.year} · {scenario.craft}</small></div>
   <button type="button" onClick={()=>setPaused(true)}>II MENU</button>
  </header>
  <div className="story-fps-objective">
   <small>{scenario.role==="astronaut"?"ASTRONAUT TRAINING":"REMOTE OPERATIONS / NO CREW ABOARD"}</small>
   <h2>{completed?"History exercise complete":task.heading}</h2>
   <p>{completed?mission.outcome:task.procedure}</p>
   <span>PROCEDURE {Math.min(stage+1,scenario.tasks.length)} / {scenario.tasks.length}</span>
   <div className="story-fps-progress">{scenario.tasks.map((s,i)=><i key={s.id} className={i<stage?"done":i===stage?"current":""}/>)}</div>
  </div>
  {!completed&&<div className="story-fps-target" aria-live="polite">
   <div className="story-fps-crosshair">+</div>
   {aim&&<span>{displayName[aim]} · {aim===task.station?"PRESS INTERACT":"Find "+displayName[task.station]}</span>}
  </div>}
  <div className="story-fps-instruction">FIND {task?displayName[task.station].toUpperCase():"MISSION COMPLETE"} · AIM + INTERACT</div>
  <div className="story-fps-look" onPointerDown={beginLook} onPointerMove={moveLook} onPointerUp={endLook} onPointerCancel={endLook} onLostPointerCapture={endLook} aria-label="Drag to look around"/>
  <div className="story-fps-movement" onPointerDown={beginStick} onPointerMove={moveStick}
    onPointerUp={stopStick} onPointerCancel={stopStick} onLostPointerCapture={stopStick} aria-label="Touch to move">
    {joystick&&<div className="story-fps-joystick" style={{left:joystick.x,top:joystick.y}}>
      <div style={{transform:"translate("+joystick.dx+"px,"+joystick.dy+"px)"}}/>
    </div>}
  </div>
  <div className="story-fps-actions">
    <button type="button" className="story-fps-sprint" onPointerDown={beginSprint} onPointerMove={moveSprint}
      onPointerUp={endSprint} onPointerCancel={endSprint} onLostPointerCapture={endSprint}>SPRINT</button>
    <button type="button" className="story-fps-interact" disabled={!!procedure||completed||paused||showGuide||aim!==task?.station}
      onClick={()=>actRef.current()}>INTERACT</button>
  </div>
  {showGuide&&<div className="story-fps-shade"><section className="story-fps-dialog">
    <small>REAL HISTORY · FIRST-PERSON OPERATIONS</small>
    <h1>{mission.title}</h1><p>{scenario.historicalNote}</p>
    <p><strong>Spacecraft represented:</strong> {scenario.craft}</p>
    <p><strong>Your role:</strong> {scenario.role==="astronaut"?"Astronaut aboard / near the historic vehicle (simplified training scene)":"Earth mission operator controlling an uncrewed vehicle remotely — no astronaut was on board."}</p>
    <p><strong>Objective:</strong> {mission.mission}</p>
    <p>Move with WASD or your floating joystick; drag to look. Hold Sprint and drag to turn. Aim at the labeled station and press INTERACT. Complete the checks in order.</p>
    <button type="button" onClick={()=>setShowGuide(false)}>BEGIN 3D MISSION →</button>
    <button type="button" className="story-fps-minor" onClick={onReadHistory}>READ REAL HISTORY</button>
  </section></div>}
  {procedure&&<div className="story-fps-shade"><section className="story-fps-dialog" role="dialog" aria-modal="true" aria-label="Mission procedure">
    <small>MISSION CONTROL PROCEDURE · {displayName[procedure.station].toUpperCase()}</small>
    <h2>{procedure.heading}</h2>
    <p>{procedure.procedure}</p>
    <div className="story-fps-instrument">
      {procedure.station==="brief"&&<p>Confirm the mission's historical objective and the necessary flight checklist.</p>}
      {procedure.station==="systems"&&<>
        <label htmlFor="story-calibration">SYSTEMS CALIBRATION — {calibration}% {calibration>=70&&calibration<=85?"· NOMINAL":"· ADJUST TO 70–85%"}</label>
        <input id="story-calibration" type="range" min="0" max="100" step="5" value={calibration}
         onChange={e=>setCalibration(Number(e.target.value))}/>
        <div className="story-fps-readout">POWER / THERMAL / TELEMETRY <strong>{calibration>=70&&calibration<=85?"NOMINAL":"NOT READY"}</strong></div>
      </>}
      {procedure.station==="operations"&&<>
        <p>Arm the correct operation sequence before running it. The training console records your selection.</p>
        <button type="button" className={operationArmed?"story-fps-armed":"story-fps-minor"} onClick={()=>setOperationArmed(true)}>
          {operationArmed?"✓ MISSION SEQUENCE ARMED":"ARM "+procedure.action.toUpperCase()}</button>
      </>}
      {procedure.station==="science"&&<>
        <p>Record the observation and confirm the mission's data are prepared for the ground team.</p>
        <button type="button" className={measurement?"story-fps-armed":"story-fps-minor"} onClick={()=>setMeasurement(true)}>
          {measurement?"✓ OBSERVATION CAPTURED":"CAPTURE SCIENCE READING"}</button>
      </>}
    </div>
    <div className="story-fps-check">
     <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>
       Verify the checklist and acknowledge the simulated operation.
     </label>
    </div>
    <button type="button" disabled={!canFinish} onClick={finishTask}>{procedure.action.toUpperCase()} ✓</button>
    <button type="button" className="story-fps-minor" onClick={()=>setProcedure(null)}>BACK TO SPACECRAFT</button>
  </section></div>}
  {completed&&<div className="story-fps-shade"><section className="story-fps-dialog" role="dialog" aria-modal="true" aria-label="Mission completed">
    <small>HISTORICAL MISSION · TRAINING COMPLETE</small>
    <h1>{mission.title} — Mission Record</h1>
    <p><strong>What really happened:</strong> {mission.outcome}</p>
    <p><strong>Historical challenge:</strong> {mission.challenge}</p>
    <p><strong>Skill practiced:</strong> {mission.skill}</p>
    <ul>{logged.map((entry,i)=><li key={i}>{entry}</li>)}</ul>
    <p>These steps were simplified training procedures, not a complete historical reconstruction.</p>
    <button type="button" onClick={()=>onComplete(true)}>SAVE COMPLETION & RETURN</button>
    <button type="button" className="story-fps-minor" onClick={onReadHistory}>READ THE ACTUAL HISTORY</button>
    <a href={mission.source} target="_blank" rel="noopener noreferrer">Official mission archive ↗</a>
  </section></div>}
  {paused&&!showGuide&&!completed&&<div className="story-fps-shade"><section className="story-fps-dialog">
    <small>MISSION PAUSED</small><h2>{mission.title}</h2>
    <p>Your current progress is retained while you remain in this story. Leaving closes the current training exercise.</p>
    <button type="button" onClick={()=>setPaused(false)}>RESUME MISSION</button>
    <button type="button" className="story-fps-minor" onClick={onReadHistory}>READ HISTORY</button>
    <button type="button" className="story-fps-minor" onClick={quit}>BACK TO MISSION LIST</button>
  </section></div>}
  {error&&<div className="story-fps-shade"><section className="story-fps-dialog"><h2>3D unavailable</h2><p>{error}</p><button onClick={onReadHistory}>Read mission history</button></section></div>}
 </div>;
}

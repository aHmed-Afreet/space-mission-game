import {useEffect,useState} from "react";
import {
 ACTIONS,CROPS,GAME_KEY,LEGACY_GAME_KEY,MISSION_LENGTH,WORLD,
 advanceSol,availableAction,chooseIncident,currentIncident,forecast,
 initialOutpost,migrateOutpost,missionCriteria,missionScore,perform,
 projectPower,setCropPlan,setPriority,
 type Action,type CropType,type Destination,type Outpost,type Priority
} from "./engine";
import {FacilityIllustration,FacilityScene,FACILITIES,type FacilityId} from "./FacilityScene";
import {dayBrief,dayLesson,dailyChanges} from "./missionFlow";
import "./outpost.css";
import "./mission.css";

type Outcome={before:Outpost;after:Outpost};
type Metric="oxygen"|"water"|"food"|"battery";
const metricMeta:{key:Metric;label:string;icon:string}[]=[
 {key:"oxygen",label:"Oxygen",icon:"◉"},{key:"water",label:"Water",icon:"◈"},
 {key:"battery",label:"Power",icon:"ϟ"},{key:"food",label:"Food",icon:"✿"}
];
const priorities:{id:Priority;title:string;desc:string}[]=[
 {id:"crew",title:"Save power",desc:"Turn off greenhouse lighting; crops will not grow."},
 {id:"balanced",title:"Balanced",desc:"Support life systems and moderate crop growth."},
 {id:"crops",title:"Grow food",desc:"Faster crop growth, but greater water and energy use."}
];
function readSaved(destination:Destination):Outpost|null{
 try{
  const raw=localStorage.getItem(GAME_KEY+"-"+destination)??localStorage.getItem(LEGACY_GAME_KEY+"-"+destination);
  if(!raw)return null;
  const migrated=migrateOutpost(JSON.parse(raw) as unknown);
  return migrated?.destination===destination?migrated:null;
 }catch{return null;}
}
function gauge(s:Outpost,key:Metric){
 const v=s[key];return v<=25?"critical":v<=50?"caution":"stable";
}
function Meter({session,k}:{session:Outpost;k:(typeof metricMeta)[number]}){
 const v=session[k.key];
 return <div className={"jm-meter jm-"+gauge(session,k.key)} title={k.label+" supply "+Math.round(v)+" percent"}>
  <span className="jm-meter-label"><b aria-hidden="true">{k.icon}</b>{k.label}</span>
  <strong>{Math.round(v)}<small>%</small></strong>
  <span className="jm-gauge-track" aria-hidden="true"><span style={{width:Math.max(0,Math.min(100,v))+"%"}}/></span>
 </div>;
}
const infoSteps=[
 {n:"01",title:"Read your mission",desc:"Mission Control tells you what is happening today. You can choose your own engineering strategy."},
 {n:"02",title:"Tap a building",desc:"Enter the solar field, greenhouse, life support, storm shelter, habitat or battery bank. Each has real controls."},
 {n:"03",title:"Make one upgrade",desc:"Choose one facility action per day, using your limited credits. Watch your resource preview change."},
 {n:"04",title:"Handle danger and advance",desc:"Respond to any emergency, select how to allocate electricity, then advance the day to see the consequences."}
];
export default function JuniorMission({onExit}:{onExit:()=>void}){
 const [session,setSession]=useState<Outpost|null>(null);
 const [room,setRoom]=useState<FacilityId|null>(null);
 const [outcome,setOutcome]=useState<Outcome|null>(null);
 const [tutorial,setTutorial]=useState(false);
 const [dataOpen,setDataOpen]=useState(false);
 const [note,setNote]=useState("");
 const [savedState,setSavedState]=useState<"ok"|"blocked"|"">("");
 useEffect(()=>{
  if(!session)return;
  try{
   localStorage.setItem(GAME_KEY+"-"+session.destination,JSON.stringify(session));
   setSavedState("ok");
  }catch{setSavedState("blocked");}
 },[session]);
 function start(world:Destination){
  const saved=readSaved(world);
  setSession(saved??initialOutpost(world));
  setRoom(null);setOutcome(null);setNote("");setDataOpen(false);
  setTutorial(!saved);
 }
 function reset(){
  if(!session)return;
  if(window.confirm("Start a new "+WORLD[session.destination].label+" mission? The current outpost run will be replaced.")){
   setSession(initialOutpost(session.destination));
   setRoom(null);setOutcome(null);setTutorial(true);setNote("");setDataOpen(false);
  }
 }
 function operation(action:Action){
  if(!session)return;
  const status=availableAction(session,action);
  if(!status.ok){setNote(status.reason??"Operation unavailable.");return;}
  const updated=perform(session,action);
  if(updated!==session){
   setSession(updated);
   setNote("✓ "+ACTIONS.find(a=>a.id===action)!.title+" completed. Its full resource effects will appear after the day advances.");
  }
 }
 function respond(choice:Outpost["incidentChoice"]){
  if(!session||!choice)return;
  const updated=chooseIncident(session,choice);
  if(updated!==session){setSession(updated);setNote("✓ Emergency response chosen. The consequences appear in the next Mission Control report.");}
 }
 function nextDay(){
  if(!session)return;
  const updated=advanceSol(session);
  if(updated===session)return;
  setSession(updated);setOutcome({before:session,after:updated});setRoom(null);setNote("");
 }
 if(!session)return <div className="outpost-app jm-app">
  <header className="jm-bar"><button onClick={onExit}>← GAME HOME</button><strong>✦ ORBITAL / JUNIOR ASTRONAUT</strong><span>SPACE OUTPOST TRAINER</span></header>
  <main className="jm-world-select">
   <div className="outpost-eyebrow">YOUR MISSION BEGINS HERE</div>
   <h1>YOU'RE IN CHARGE<br/><em>OF A SPACE BASE.</em></h1>
   <p>Keep your astronauts alive. Grow food, manage electricity, shield your crew from radiation and survive ten mission days. Every choice has a consequence.</p>
   <div className="jm-world-grid">{(["moon","mars"] as Destination[]).map(world=>{
    const saved=readSaved(world);
    return <button key={world} className={"jm-world jm-world-"+world} onClick={()=>start(world)}>
      <span className="jm-world-planet" aria-hidden="true"/><span className="outpost-eyebrow">{WORLD[world].difficulty.toUpperCase()} · 10 DAYS</span>
      <strong>{world==="moon"?"MOON BASE ALPHA":"MARS BASE NOVA"}</strong>
      <small>{world==="moon"?"Survive darkness and solar radiation.":"Manage dust storms and weaker sunlight."}</small>
      <b>{saved?"RESUME DAY "+Math.min(saved.sol,10)+" →":"START YOUR MISSION →"}</b>
    </button>;
   })}</div>
   <p className="jm-legal">Independent educational simulation, not affiliated with NASA. Resource quantities and event timings are simplified game rules.</p>
  </main>
 </div>;
 const brief=dayBrief(session);
 const incident=currentIncident(session);
 const pending=Boolean(incident&&session.incidentSol!==session.sol);
 const answered=incident&&session.incidentSol===session.sol;
 const completed=session.phase!=="active";
 const selectedOperation=ACTIONS.find(a=>a.id===session.selected);
 const forecastToday=forecast(session.destination,session.sol);
 const power=projectPower(session);
 const canAdvance=Boolean(session.selected)&&!pending&&!completed;
 const facility=room?FACILITIES.find(f=>f.id===room):null;
 const requirement=missionCriteria(session);
 const missionButton=completed?"VIEW MISSION RESULT":canAdvance?"FINISH DAY "+session.sol+" →":pending?"RESPOND TO EMERGENCY FIRST":"CHOOSE AN ACTION TO CONTINUE";
 const actionNote=session.selected?"✓ "+(selectedOperation?.title??"Operation")+" selected":"0 of 1 daily actions used";
 const hazardText=forecastToday.sunlight===0?"NO SUNLIGHT":forecastToday.dust?"DUST STORM":forecastToday.storm?"SOLAR WARNING":"NORMAL CONDITIONS";
 return <div className="outpost-app jm-app">
  <header className="jm-bar">
   <button onClick={()=>{setSession(null);setRoom(null);setOutcome(null);}}>← OUTPOSTS</button>
   <strong>✦ {session.destination==="moon"?"MOON BASE ALPHA":"MARS BASE NOVA"}</strong>
   <div className="jm-bar-end"><span>DAY {Math.min(session.sol,10)} / 10</span><button onClick={()=>setTutorial(true)} aria-label="How to play">? HELP</button><button onClick={onExit}>EXIT ↗</button></div>
  </header>
  <main className="jm-game">
   <div className="jm-hud">
    <div className="jm-hud-name"><span className="outpost-eyebrow">MISSION CONTROL</span><strong>{completed?"MISSION COMPLETE":hazardText}</strong></div>
    <div className="jm-hud-meters">{metricMeta.map(k=><Meter key={k.key} k={k} session={session}/>)}</div>
    <div className="jm-crew">CREW <strong>{Math.round(session.safety)}%</strong><span>RADIATION <b>{Math.round(session.radiation)}</b></span></div>
   </div>
   <div className="jm-playfield">
    <section className="jm-exploration" aria-label="Interactive outpost environment">
     <div className="jm-explore-header"><span><i className="jm-status-dot"/> EXPLORE THE BASE</span><small>Tap a building to operate it</small></div>
     <div className={"jm-stage"+(session.battery<20?" jm-stage-lowpower":"")}>
      <FacilityScene s={session} selected={room??brief.focus} sceneOnly
       onSelect={(id)=>{setRoom(id);setNote("");}}
       onAction={operation}
       onCropPlan={crop=>setSession(s=>s?setCropPlan(s,crop):s)}/>
      {room&&facility&&<div className="jm-room" role="region" aria-label={facility.title+" controls"}>
       <div className="jm-room-bar"><button onClick={()=>{setRoom(null);setNote("");}}>← BACK TO BASE</button><span>{facility.icon} {facility.title.toUpperCase()}</span></div>
       <div className="jm-room-content">
        <div className="jm-room-visual">
         <FacilityIllustration id={room} s={session}/>
         <p>{facility.description}</p>
        </div>
        <div className="jm-room-ops">
         <div className="outpost-eyebrow">OPERATE THIS FACILITY</div>
         <h2>{facility.title}</h2>
         {room==="greenhouse"&&<div className="jm-crops">
          <strong>Choose what to grow</strong>
          <div>{(Object.keys(CROPS) as CropType[]).map(crop=><button type="button" key={crop}
            onClick={()=>setSession(s=>s?setCropPlan(s,crop):s)}
            disabled={completed||Boolean(session.selected)}
            className={session.plannedCrop===crop?"active":""}
            aria-pressed={session.plannedCrop===crop}>{CROPS[crop].label}<small>Food +{CROPS[crop].harvest} · Water {CROPS[crop].water} · Power {CROPS[crop].power}</small></button>)}</div>
          <small>To change crops, choose a new type and select “Change greenhouse crop” below. Harvesting is a separate daily action.</small>
         </div>}
         {facility.operations.map(id=>{
          const action=id as Action,details=ACTIONS.find(a=>a.id===action)!;
          const available=availableAction(session,action);
          return <button key={id} className="jm-operation" disabled={!available.ok} onClick={()=>operation(action)}>
           <span><b>{details.title}</b><em>{details.cost?details.cost+" credits":"FREE"}</em></span>
           <small>{available.ok?details.note:available.reason}</small>
          </button>;
         })}
         <button className="jm-operation jm-monitor" disabled={Boolean(session.selected)||completed} onClick={()=>operation("monitor")}>
          <span><b>Skip upgrade today</b><em>FREE</em></span><small>Monitor systems and keep all remaining credits.</small>
         </button>
         <p className="jm-operation-help">You can perform one facility operation per day. There are no reaction-time challenges.</p>
        </div>
       </div>
      </div>}
     </div>
     <div className="jm-stage-foot">
      <span>{room?"Inside "+facility?.title:"Explore the six buildings to keep the outpost working."}</span>
      <button type="button" onClick={()=>{setRoom(brief.focus);setNote("");}}>OPEN RECOMMENDED FACILITY ↗</button>
     </div>
    </section>
    <aside className="jm-guidance" aria-label="Daily mission and next steps">
     <div className="jm-mission-card">
      <div className="jm-card-overline"><span className="outpost-eyebrow">TODAY'S MISSION</span><strong>DAY {Math.min(session.sol,10)} / {MISSION_LENGTH}</strong></div>
      <h1>{brief.title}</h1><p>{brief.description}</p>
      <button className="jm-focus" onClick={()=>{setRoom(brief.focus);setNote("");}}>GO TO {FACILITIES.find(f=>f.id===brief.focus)?.title.toUpperCase()} <span>↗</span></button>
      <div className="jm-tip"><span>WHY IT MATTERS</span>{brief.tip}</div>
     </div>
     {!completed && incident&&<div className="jm-crisis">
      <div className="jm-crisis-label">⚠ IMPORTANT EVENT</div>
      <h2>{incident.title}</h2><p>{incident.detail}</p>
      {pending?<div className="jm-crisis-choices">{incident.options.map(choice=><button key={choice.id} onClick={()=>respond(choice.id)} disabled={(choice.id==="sweep"&&session.credits<8)||(choice.id==="patch"&&session.credits<12)}>
       <b>{choice.title}</b><small>{choice.detail}</small>
      </button>)}</div>:<div className="jm-crisis-selected">✓ Decision: {incident.options.find(c=>c.id===session.incidentChoice)?.title}</div>}
     </div>}
     <div className="jm-power-choice">
      <div className="jm-power-heading"><strong>POWER PLAN</strong><small>Today's predicted battery: <b>{Math.round(power.projectedBattery)}%</b></small></div>
      <div className="jm-priority-options">{priorities.map(p=><button key={p.id} type="button" className={session.priority===p.id?"active":""} disabled={completed} onClick={()=>setSession(s=>s?setPriority(s,p.id):s)} aria-pressed={session.priority===p.id} title={p.desc}>{p.title}</button>)}</div>
      <p>{priorities.find(p=>p.id===session.priority)?.desc}</p>
     </div>
     <div className="jm-progress"><span>{actionNote}</span><span><b>{session.credits}</b> credits available</span></div>
     <button className="jm-advance" onClick={()=>completed?setOutcome({before:session,after:session}):nextDay()} disabled={!canAdvance&&!completed}>{missionButton}</button>
     {pending&&<p className="jm-guidance-helper">Answer the event above before advancing.</p>}
     {!pending&&!selectedOperation&&!completed&&<p className="jm-guidance-helper">Open a building and choose one action. You can always monitor systems for free.</p>}
     {note&&<div className="jm-feedback" role="status">{note}</div>}
     <button className="jm-data-toggle" type="button" onClick={()=>setDataOpen(v=>!v)} aria-expanded={dataOpen}>MISSION DATA & SCIENCE {dataOpen?"−":"+"}</button>
     {dataOpen&&<div className="jm-extra-data">
      <div>Solar production: +{power.generation} · Demand: −{power.demand}</div>
      <div>Radiation: {Math.round(session.radiation)} · Shield level: {session.shielding}</div>
      <div>Greenhouse: {CROPS[session.cropType].label}, growth {Math.round(session.crop)}</div>
      <div>Food harvested: {session.foodProduced} · Habitat: {Math.round(session.integrity)}%</div>
      <details><summary>Mission checklist ({requirement.filter(r=>r.met).length}/{requirement.length})</summary>
       {requirement.map((r,i)=><p key={i}>{r.met?"✓":"○"} {r.title}</p>)}
      </details>
      <details><summary>Previous Mission Control reports</summary>{session.log.slice(-10).reverse().map((v,i)=><p key={i}>{v}</p>)}</details>
      <div><a href="https://science.nasa.gov/moon/" target="_blank" rel="noopener noreferrer">NASA Moon science ↗</a> · <a href="https://science.nasa.gov/mars/" target="_blank" rel="noopener noreferrer">NASA Mars science ↗</a></div>
      <button onClick={reset} className="jm-reset">Restart this outpost</button>
     </div>}
    </aside>
   </div>
   <div className="jm-mission-caption"><span>{savedState==="blocked"?"⚠ Browser saving is unavailable":"✓ Progress saved on this device"}</span><span>Independent educational simulation · Simplified engineering model · Not affiliated with NASA</span></div>
  </main>
  {(outcome||completed)&&<div className="jm-overlay" role="presentation"><section className="jm-dialog jm-outcome" role="dialog" aria-modal="true" aria-label="Mission Control report">
   <span className="outpost-eyebrow">{completed?"MISSION DEBRIEF":"MISSION CONTROL · DAY "+outcome?.before.sol+" COMPLETE"}</span>
   <h2>{completed?(session.phase==="won"?"YOU SAVED THE OUTPOST!":"LET'S LEARN FROM THIS MISSION"):"YOUR CHOICES HAD CONSEQUENCES"}</h2>
   <p>{outcome&&outcome.before!==outcome.after?dayLesson(outcome.before,outcome.after):completed?"Review your result, then try another strategy if you want.":"Review the changes."}</p>
   {outcome&&outcome.before!==outcome.after&&<div className="jm-result-grid">{dailyChanges(outcome.before,outcome.after).filter(c=>c.key!=="crop").map(c=><div key={c.key} className={(c.key==="radiation"?c.delta<0:c.delta>0)?"jm-gain":c.delta===0?"":"jm-loss"}>
    <small>{c.label}</small><strong>{Math.round(c.after)}{c.key==="radiation"?"":"%"}</strong>
    <span>{c.delta>0?"+":""}{c.delta}</span>
   </div>)}</div>}
   {completed&&<><div className="jm-final-score">{missionScore(session)}<span>/100 MISSION SCORE</span></div>
    <div className="jm-final-checks">{requirement.map((r,i)=><div key={i}>{r.met?"✓":"○"} {r.title}</div>)}</div></>}
   {outcome?.after.lastReport&&<details><summary>Why did this happen?</summary>{outcome.after.lastReport.map((x,i)=><p key={i}>{x}</p>)}</details>}
   <div className="jm-dialog-actions">{completed?<><button className="jm-primary" onClick={reset}>TRY AGAIN ↻</button><button onClick={()=>{setSession(null);setOutcome(null);}}>CHOOSE ANOTHER OUTPOST</button></>:
   <button className="jm-primary" onClick={()=>setOutcome(null)}>CONTINUE TO DAY {session.sol} →</button>}</div>
  </section></div>}
  {tutorial&&<div className="jm-overlay" role="presentation"><section className="jm-dialog jm-tutorial" role="dialog" aria-modal="true" aria-label="How to play Junior Astronaut">
   <span className="outpost-eyebrow">MISSION BRIEFING · 60-SECOND GUIDE</span>
   <h2>YOU ARE THE COMMANDER.</h2>
   <p>Your job is to keep your crew alive for ten days. Every building affects at least one other system.</p>
   <div className="jm-tutorial-steps">{infoSteps.map(s=><div key={s.n}><span>{s.n}</span><div><strong>{s.title}</strong><p>{s.desc}</p></div></div>)}</div>
   <p className="jm-simulation-note">Mission resource quantities are educational game units, not real mission requirements.</p>
   <button className="jm-primary" onClick={()=>setTutorial(false)}>GOT IT — START PLAYING →</button>
  </section></div>}
 </div>;
}

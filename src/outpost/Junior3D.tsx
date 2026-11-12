import {useCallback,useEffect,useLayoutEffect,useRef,useState,type PointerEvent as ReactPointer} from "react";
import {ACTIONS,CROPS,GAME_KEY,LEGACY_GAME_KEY,WORLD,advanceSol,availableAction,
 chooseIncident,currentIncident,forecast,initialOutpost,migrateOutpost,missionCriteria,
 missionScore,perform,projectPower,setCropPlan,setPriority,crewMealStatus,eatCrewMeal,crewSleepStatus,
 type Action,type CropType,type Destination,type Outpost,type Priority} from "./engine";
import {FACILITIES,type FacilityId} from "./FacilityScene";
import {dayBrief,dailyChanges,dayLesson} from "./missionFlow";
import World3D,{type Movement,type Proximity,type CameraDelta,type WorldPose} from "./World3D";
import OutpostMap from "./OutpostMap";
import {destinationGuide,missionDestination} from "./navigation";
import {distance,exteriorDoorSpawn,exteriorDoorYaw,HABITAT_WAKE,type Point2} from "./worldLogic";
import {lockOutpostViewport} from "./scrollLock";
import {greenhouseClimate} from "./greenhouseClimate";
import {createPostClickActivationQueue} from "../touchActivation";
import {initializePreferences,type PlayerPreferences} from "../commander/campaign/preferences";
import "./world3d.css";

type Panel=null|"console"|"event"|"help"|"outcome"|"mission"|"map";
type Result={before:Outpost;after:Outpost};
const meters=[
 {key:"oxygen",label:"OXYGEN",icon:"◉"},{key:"water",label:"WATER",icon:"◈"},
 {key:"battery",label:"POWER",icon:"ϟ"},{key:"food",label:"FOOD",icon:"✿"},
] as const;
const locationForEvent=(id:string|null):FacilityId=>
 id==="radiation"?"shield":id==="blackout"?"battery":id==="dust"?"solar":"recycle";
const priorityChoices:{id:Priority;title:string;why:string}[]=[
 {id:"crew",title:"Conserve electricity",why:"Reduce crop lighting; life-support power takes priority."},
 {id:"balanced",title:"Balance all systems",why:"Moderate crop growth and moderate power demand."},
 {id:"crops",title:"Grow more food",why:"Faster crops but higher energy and water demand."},
];
function readSaved(destination:Destination){
 try{
   const s=localStorage.getItem(GAME_KEY+"-"+destination)??localStorage.getItem(LEGACY_GAME_KEY+"-"+destination);
   if(!s)return null;
   const restored=migrateOutpost(JSON.parse(s) as unknown);
   return restored?.destination===destination?restored:null;
 }catch{return null;}
}
/** Dynamically floating movement joystick in the lower-left touch zone. */
function Stick({move}:{move:React.RefObject<Movement>}){
 const active=useRef<number|null>(null);
 const origin=useRef({x:0,y:0});
 const ring=useRef<HTMLDivElement>(null),thumb=useRef<HTMLDivElement>(null);
 function update(e:ReactPointer<HTMLDivElement>){
   const dx=e.clientX-origin.current.x,dy=e.clientY-origin.current.y;
   const radius=58,len=Math.hypot(dx,dy),dead=5,ratio=len<=dead?0:Math.min(1,(len-dead)/(radius-dead));
   const vx=len>0?dx/len*ratio:0,vy=len>0?dy/len*ratio:0;
   move.current.x=vx;move.current.y=-vy;
   thumb.current?.style.setProperty("--jx",vx*radius*.75+"px");
   thumb.current?.style.setProperty("--jy",vy*radius*.75+"px");
 }
 function down(e:ReactPointer<HTMLDivElement>){
   if(active.current!==null)return;
   e.preventDefault();active.current=e.pointerId;
   e.currentTarget.setPointerCapture(e.pointerId);
   origin.current={x:e.clientX,y:e.clientY};
   const rect=e.currentTarget.getBoundingClientRect();
   if(ring.current){ring.current.style.left=e.clientX-rect.left+"px";
     ring.current.style.top=e.clientY-rect.top+"px";ring.current.classList.add("using");}
   update(e);
 }
 function end(e:ReactPointer<HTMLDivElement>){
   if(active.current!==e.pointerId)return;
   active.current=null;move.current.x=0;move.current.y=0;
   thumb.current?.style.setProperty("--jx","0px");
   thumb.current?.style.setProperty("--jy","0px");
   ring.current?.classList.remove("using");
 }
 return <div className="j3-move-zone" role="group" aria-label="Touch anywhere in this lower-left area to walk"
   onPointerDown={down} onPointerMove={e=>{if(active.current===e.pointerId)update(e);}}
   onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
   <div className="j3-joystick" ref={ring} aria-hidden="true"><div className="j3-thumb" ref={thumb}/></div>
   <span className="j3-move-hint">TOUCH HERE TO WALK</span>
 </div>;
}
type ButtonContact={id:number;x:number;y:number;startX:number;startY:number;dragged:boolean};
const focusAction=(id:FacilityId)=>FACILITIES.find(x=>x.id===id)!;
export default function Junior3D({onExit}:{onExit:()=>void}){
 const [settings]=useState(()=>{try{return initializePreferences(localStorage);}catch{return initializePreferences();}});
 const [graphics,setGraphics]=useState<PlayerPreferences["graphics"]>(settings.value.graphics);
 const [session,setSession]=useState<Outpost|null>(null);
 const [room,setRoom]=useState<FacilityId|null>(null);
 const [near,setNear]=useState<Proximity>(null);
 const [seq,setSeq]=useState(0);
 const [panel,setPanel]=useState<Panel>(null);
 // iOS may dispatch a compatibility click after INTERACT opens the console;
 // avoid interpreting it as a separate press of the newly mounted Close.
 const consoleOpenedAt=useRef(-Infinity);
 const [lastResult,setLastResult]=useState<Result|null>(null);
 const [notice,setNotice]=useState("");
 const [error,setError]=useState("");
 const [saveOk,setSaveOk]=useState(true);
 const [playerPosition,setPlayerPosition]=useState<Point2>({x:0,z:0});
 const movement=useRef<Movement>({x:0,y:0,run:false});
 const cameraDelta=useRef<CameraDelta>({yaw:0,pitch:0});
 const spawn=useRef<WorldPose>({position:{x:0,z:0},yaw:0,pitch:.15});
 const enteredBuilding=useRef<FacilityId|null>(null);
 const buttonContacts=useRef<{run:ButtonContact|null;interact:ButtonContact|null}>({run:null,interact:null});
 const lastTouchActivation=useRef(0),skipInteractClick=useRef(false);
 const postClickInteract=useRef(createPostClickActivationQueue(
   callback=>window.setTimeout(callback,70),
   handle=>window.clearTimeout(handle),
 ));
 useEffect(()=>()=>postClickInteract.current.cancel(),[]);
 useEffect(()=>{
   if(!session)return;
   try{localStorage.setItem(GAME_KEY+"-"+session.destination,JSON.stringify(session));setSaveOk(true);}
   catch{setSaveOk(false);}
 },[session]);
 // Lock scroll before paint; restore homepage scroll on exit.
 useLayoutEffect(()=>lockOutpostViewport(),[]);
 // Avoid permanent key capture when an overlay hides movement controls.
 useEffect(()=>{if(panel){movement.current.x=0;movement.current.y=0;movement.current.run=false;}},[panel]);
 function start(destination:Destination){
   const saved=readSaved(destination);
   setSession(saved??initialOutpost(destination));setNear(null);setRoom("habitat");
   setPlayerPosition({...HABITAT_WAKE});cameraDelta.current={yaw:0,pitch:0};
   spawn.current={position:{...HABITAT_WAKE},yaw:0,pitch:.15};
   enteredBuilding.current="habitat";
   setLastResult(null);setNotice("");setError("");
   setPanel(saved?(saved.phase!=="active"?"outcome":null):"help");
 }
 function restart(){
   if(!session)return;
   if(!window.confirm("Restart this "+session.destination+" mission? Your existing outpost progress will be replaced."))return;
   setSession(initialOutpost(session.destination));setRoom("habitat");setPanel("help");
   setPlayerPosition({...HABITAT_WAKE});cameraDelta.current={yaw:0,pitch:0};
   spawn.current={position:{...HABITAT_WAKE},yaw:0,pitch:.15};
   enteredBuilding.current="habitat";
   setLastResult(null);setNotice("");setNear(null);
 }
 function operate(action:Action){
   if(!session)return;
   const status=availableAction(session,action);
   if(!status.ok){setNotice(status.reason??"That equipment cannot be operated yet.");return;}
   const next=perform(session,action);
   setSession(next);
   setNotice("SYSTEM UPDATED: "+ACTIONS.find(a=>a.id===action)?.title+" — next-day consequences will be simulated.");
 }
 function chooseResponse(id:NonNullable<Outpost["incidentChoice"]>){
   if(!session)return;const next=chooseIncident(session,id);
   if(next!==session){setSession(next);setNotice("Crew response confirmed. The next day will reflect this decision.");}
 }
 function advance(){
   if(!session)return;
   if(room!=="habitat"||near?.kind!=="sleep"){
     setNotice("Return to Crew Habitat and press INTERACT at a sleeping bunk.");
     return;
   }
   const ready=crewSleepStatus(session);
   if(!ready.ok){setNotice(ready.message);return;}
   const next=advanceSol(session);
   if(next===session){setNotice("Resolve today's engineering task and emergency first.");return;}
   spawn.current={position:{...HABITAT_WAKE},yaw:0,pitch:.15};
   enteredBuilding.current="habitat";
   setRoom("habitat");setPlayerPosition({...HABITAT_WAKE});
   setLastResult({before:session,after:next});setSession(next);setPanel("outcome");
   setNotice("");setNear(null);movement.current.x=0;movement.current.y=0;
 }
 function routineInteraction(kind:"meal"|"sleep"){
   if(!session||session.phase!=="active")return;
   if(kind==="sleep"){advance();return;}
   const meal=session.breakfastSol!==session.sol?"breakfast":"dinner";
   const status=crewMealStatus(session,meal);
   if(!status.ok){setNotice(status.message);return;}
   setSession(eatCrewMeal(session,meal));
   setNotice(meal==="breakfast"?"✓ Breakfast complete. Leave the habitat and complete your mission.":"✓ Dinner complete. Go to your bunk and sleep to finish the day.");
 }
 const enter=useCallback((id:FacilityId|null,pose:WorldPose)=>{
   if(id){
     enteredBuilding.current=id;
     
     spawn.current={position:{x:0,z:2.85},yaw:0,pitch:pose.pitch};
   }else{
     // Return to the SAME door the player used, never the central spawn.
     const previous=enteredBuilding.current;
     const position=previous?exteriorDoorSpawn(previous):pose.position;
     spawn.current={position,yaw:previous?exteriorDoorYaw(previous):pose.yaw,pitch:pose.pitch};
     setPlayerPosition(position);
     enteredBuilding.current=null;
   }
   setRoom(id);setPanel(null);setNear(null);
   setNotice(id?"Entered "+focusAction(id).title+". Find the illuminated control panel.":"Exited through the same airlock.");
 },[]);
 const openConsole=useCallback((id:FacilityId)=>{
   consoleOpenedAt.current=performance.now();
   setRoom(id);setPanel("console");setNotice("");
 },[]);
 const nearCallback=useCallback((q:Proximity)=>setNear(prev=>
   prev?.kind===q?.kind&&prev?.id===q?.id&&prev?.title===q?.title?prev:q),[]);
 const positionCallback=useCallback((p:Point2)=>setPlayerPosition(prev=>distance(prev,p)<.35?prev:p),[]);
 // RUN and INTERACT capture their own pointer IDs, and drags on either button
 // contribute to the same live camera even if the walking stick is held.
 function actionDown(kind:"run"|"interact",e:ReactPointer<HTMLButtonElement>){
   if(buttonContacts.current[kind])return;
   if(e.pointerType==="touch")e.preventDefault();
   e.currentTarget.setPointerCapture(e.pointerId);
   buttonContacts.current[kind]={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,dragged:false};
   if(kind==="run")movement.current.run=true;
   if(kind==="interact")skipInteractClick.current=false;
 }
 function actionMove(kind:"run"|"interact",e:ReactPointer<HTMLButtonElement>){
   const p=buttonContacts.current[kind];
   if(!p||p.id!==e.pointerId)return;
   const dx=e.clientX-p.x,dy=e.clientY-p.y;
   if(Math.hypot(e.clientX-p.startX,e.clientY-p.startY)>12)p.dragged=true;
   cameraDelta.current.yaw-=dx*.0045;
   cameraDelta.current.pitch+=dy*.003;
   p.x=e.clientX;p.y=e.clientY;
 }
 function actionEnd(kind:"run"|"interact",e:ReactPointer<HTMLButtonElement>){
   const p=buttonContacts.current[kind];
   if(!p||p.id!==e.pointerId)return;
   buttonContacts.current[kind]=null;
   if(kind==="run"){movement.current.run=false;return;}
   if(p.dragged)skipInteractClick.current=true;
   if(e.type==="pointerup"&&!p.dragged&&e.pointerType==="touch"){
     lastTouchActivation.current=performance.now();
     // Primary one-finger touches can generate a browser click after pointerup,
     // unlike secondary touches while walking. Open only after that click has
     // passed so it cannot immediately select or dismiss the new console.
     postClickInteract.current.commit(()=>setSeq(n=>n+1));
   }
 }
 if(!session)return <div className="j3-root">
   <section className="j3-select">
     <span className="j3-kicker">NASA SPACE APPS CHALLENGE THEME · INDEPENDENT EDUCATIONAL GAME</span>
     <h1>WALK ON ANOTHER WORLD.<br/><em>KEEP YOUR CREW ALIVE.</em></h1>
     <p>Explore a 3D Moon or Mars station as an astronaut. Enter habitats, operate machines, grow food, manage limited resources and survive real engineering trade-offs in a simplified simulation.</p>
     <div className="j3-worlds">{(["moon","mars"] as Destination[]).map(d=>{
       const saved=readSaved(d);
       return <button key={d} className={"j3-world-card "+d} onClick={()=>start(d)}>
         <span className="j3-kicker">{WORLD[d].difficulty.toUpperCase()} / 3D OUTPOST</span>
         <strong>{d==="moon"?"MOON BASE ALPHA":"MARS BASE NOVA"}</strong>
         <small>{d==="moon"?"Survive lunar night, solar storms and life-support failures.":"Keep a Mars base functioning through dust storms and reduced sunlight."}</small>
         <b>{saved?"CONTINUE DAY "+Math.min(10,saved.sol)+" →":"PLAY 3D MISSION →"}</b>
       </button>;
     })}</div>
     <div className="j3-row"><button onClick={onExit} className="j3-info">← ALL GAME MODES</button></div>
     <label className="j3-graphics">GRAPHICS <select aria-label="Outpost graphics quality" value={graphics} onChange={e=>{const value=e.target.value as PlayerPreferences["graphics"];setGraphics(value);settings.save({...settings.value,graphics:value});}}><option value="battery">Battery · lower GPU load</option><option value="balanced">Balanced · recommended for iPad</option><option value="quality">Quality · detailed shadows</option></select></label>
     <p className="j3-settings">3D scene rendered locally on your device · Touch joystick + drag to look · Keyboard WASD/E · Fictional resource values, not real mission engineering predictions</p>
   </section>
 </div>;
 const brief=dayBrief(session),incident=currentIncident(session);
 const required=incident?locationForEvent(incident.id):null;
 const pending=Boolean(incident&&session.incidentSol!==session.sol);
 const complete=session.phase!=="active";
 const selected=session.selected;
 const power=projectPower(session);
 const greenhouseTemperature=room==="greenhouse"?greenhouseClimate(session):null;
 const currentFacility=room?focusAction(room):null;
 const localEmergency=room!==null&&room===required&&pending;
 const canAdvance=crewSleepStatus(session).ok;
 const needs=missionCriteria(session);
 const mustBreakfast=session.breakfastSol!==session.sol;
 const mustDinner=Boolean(selected)&&!pending&&session.dinnerSol!==session.sol;
 const readyForBed=crewSleepStatus(session).ok;
 const goal=mustBreakfast||mustDinner||readyForBed?"habitat":missionDestination(session);
 const guidance=destinationGuide(playerPosition,room,goal);
 const nav=mustBreakfast?
   {title:"EAT BREAKFAST",description:"In Crew Habitat, walk to the illuminated dining table on the right and press INTERACT."}:
   mustDinner?
   {title:room==="habitat"?"EAT DINNER":"RETURN TO CREW HABITAT FOR DINNER",
     description:room==="habitat"?"Find the lit dining table on the right and press INTERACT.":"Follow the Crew Habitat marker, enter, and eat dinner."}:
   readyForBed?
   {title:room==="habitat"?"SLEEP IN YOUR BUNK":"RETURN TO CREW HABITAT TO SLEEP",
     description:room==="habitat"?"Find the illuminated bunk on the left and press INTERACT.":"Head to Crew Habitat, enter, and use the sleeping bunk."}:
   guidance;
 return <div className="j3-root">
   <div className="j3-world">
     <World3D key={session.sol+"-"+(room??"surface")} room={room} session={session} graphics={graphics} blocked={Boolean(panel)} movement={movement} lookDelta={cameraDelta} spawn={spawn}
       target={goal} interactSeq={seq} onPosition={positionCallback}
       onEnter={enter} onConsole={openConsole} onRoutine={routineInteraction} onNear={nearCallback} onError={setError}/>
   </div>
   <div className="j3-vignette"/>
   <div className="j3-hud">
     <div className="j3-top">
       <div className="j3-brand"><b>✦ {session.destination==="moon"?"MOON BASE ALPHA":"MARS BASE NOVA"}</b>
         <span>DAY {Math.min(10,session.sol)}/10 · {room?"INSIDE "+currentFacility?.title.toUpperCase():"SURFACE OPERATIONS"} · {forecast(session.destination,session.sol).title}</span></div>
       <div className="j3-meters">{meters.map(m=>{
         const v=session[m.key];
         return <div key={m.key} className={"j3-meter "+(v<=20?"critical":v<=42?"caution":"")}>
           <span>{m.icon} {m.label}</span><strong>{Math.round(v)}<small>%</small></strong>
           <div className="j3-track"><i style={{width:Math.max(0,Math.min(100,v))+"%"}}/></div>
         </div>;
       })}</div>
       <div className="j3-quick">
         <button onClick={()=>setPanel("map")}>MAP</button>
         <button onClick={()=>setPanel("mission")}>MISSION</button>
         <button onClick={()=>setPanel("help")}>?</button>
         <button onClick={()=>{setSession(null);setPanel(null);setRoom(null);}}>EXIT</button>
       </div>
     </div>
     <div className="j3-middle"><span className="j3-reticle"/></div>
     <div className="j3-bottom">
       <div className="j3-objective">
         <span className="j3-kicker">TODAY'S OBJECTIVE · DAY {Math.min(10,session.sol)}</span>
         <strong>{brief.title}</strong><p>{brief.description}</p>
         <div className="j3-direction"><b>★ {nav.title}</b><span>{nav.description}</span>
           <button onClick={()=>setPanel("map")}>OPEN MAP ↗</button></div>
         <div className="j3-crew-routine"><b>{session.breakfastSol===session.sol?"✓":"○"} Breakfast</b><b>{selected?"✓":"○"} Mission</b><b>{session.dinnerSol===session.sol?"✓":"○"} Dinner</b><b>○ Sleep</b></div>
          <small>{selected?"✓ Action completed: "+ACTIONS.find(x=>x.id===selected)?.title:
            session.breakfastSol!==session.sol?"Start with breakfast in Crew Habitat.":"Find a facility and perform one task."}
           {pending?" · ⚠ Emergency response required":""}</small>
       </div>
       <div className="j3-helptext">BOTTOM-LEFT: TOUCH TO WALK · DRAG TO LOOK · RUN / INTERACT SUPPORT CAMERA DRAG</div>
     </div>
   </div>
   {!panel&&<div className="j3-controls">
     <Stick move={movement}/>
     <div className="j3-buttons">
       <button className="j3-run" onPointerDown={e=>actionDown("run",e)}
         onPointerMove={e=>actionMove("run",e)} onPointerUp={e=>actionEnd("run",e)}
         onPointerCancel={e=>actionEnd("run",e)} onLostPointerCapture={e=>actionEnd("run",e)}>RUN</button>
       <button aria-label="Interact or drag to turn the camera" title={near?.title??"Drag to look; approach an airlock or console to interact"} onPointerDown={e=>actionDown("interact",e)}
         onPointerMove={e=>actionMove("interact",e)} onPointerUp={e=>actionEnd("interact",e)}
         onPointerCancel={e=>actionEnd("interact",e)} onLostPointerCapture={e=>actionEnd("interact",e)}
         onClick={()=>{const recent=performance.now()-lastTouchActivation.current<750;
           const drag=skipInteractClick.current;skipInteractClick.current=false;
           if(!recent&&!drag)setSeq(n=>n+1);
         }}>INTERACT</button>
       
     </div>
     {near&&<div className="j3-prompt">{near.title} · PRESS INTERACT</div>}
   </div>}
   {notice&&!panel&&<div className="j3-status" role="status">{notice}</div>}
   {error&&<div className="j3-fallback"><div><p>{error}</p><button onClick={()=>setSession(null)}>BACK TO OUTPOSTS</button></div></div>}
   {panel&&<div className="j3-overlay">
     {panel==="map"&&<OutpostMap session={session} position={playerPosition} room={room} onClose={()=>setPanel(null)}/>}
     {panel==="console"&&currentFacility&&<section className="j3-panel j3-panel-console" role="dialog" aria-modal="true" aria-label={currentFacility.title+" controls"}>
       <div className="j3-panel-content" tabIndex={0} aria-label={currentFacility.title+" scrollable options"}>
       <span className="j3-kicker">3D FACILITY CONTROL · {currentFacility.title.toUpperCase()}</span>
       <h2>{currentFacility.title}</h2>
       <p>{currentFacility.description}</p>
       <div className="j3-info" role="status">DAY {session.sol} · Credits {session.credits} · {selected
         ?"TODAY'S TASK COMPLETE: "+ACTIONS.find(x=>x.id===selected)?.title+". You can scroll through all options, but another engineering operation unlocks on the next day after dinner and sleep."
         :"Choose one engineering operation today. Scroll down to see every option."}</div>
       {localEmergency&&incident&&<><span className="j3-kicker">⚠ URGENT CREW DECISION</span><h2>{incident.title}</h2><p>{incident.detail}</p>
         <div className="j3-choices">{incident.options.map(o=><button key={o.id} className="j3-choice"
           disabled={(o.id==="patch"&&session.credits<12)||(o.id==="sweep"&&session.credits<8)}
           onClick={()=>chooseResponse(o.id)}><b>{o.title}</b><small>{o.detail}</small></button>)}</div>
       </>}
       {room==="greenhouse"&&<><div className="j3-greenhouse-climate" aria-label="Simulated greenhouse air temperature">
           <div><span className="j3-kicker">GREENHOUSE CLIMATE · SIMULATED</span><strong>{greenhouseTemperature?.temperatureC}°C</strong></div>
           <span className="j3-climate-state">{greenhouseTemperature?.status==="COOL"?"COOL":"NOMINAL"}</span>
           <small>{greenhouseTemperature?.note}</small>
         </div>
         <span className="j3-kicker">HYDROPONICS · CURRENT CROP {CROPS[session.cropType].label.toUpperCase()}</span>
         <div className="j3-choices">{(Object.keys(CROPS) as CropType[]).map(c=><button key={c}
           disabled={Boolean(session.selected)} onClick={()=>setSession(s=>s?setCropPlan(s,c):s)}
           className="j3-choice"><b>{session.plannedCrop===c?"✓ ":""}{CROPS[c].label}</b>
             <small>Harvest {CROPS[c].harvest} food units · Water demand {CROPS[c].water} · Electrical load {CROPS[c].power}</small></button>)}</div>
       </>}
       {room==="battery"&&<><span className="j3-kicker">BATTERY BANK · ENERGY ALLOCATION</span>
         <div className="j3-choices">{priorityChoices.map(v=><button key={v.id} onClick={()=>setSession(s=>s?setPriority(s,v.id):s)}>
           <b>{session.priority===v.id?"✓ ":""}{v.title}</b><small>{v.why}</small></button>)}</div>
         <div className="j3-info">Expected battery after today: {Math.round(power.projectedBattery)}% · Solar +{power.generation} · Demand −{power.demand}</div>
       </>}
       <span className="j3-kicker">OPERATE REAL EQUIPMENT</span>
       <div className="j3-choices">{currentFacility.operations.map(a=>{
         const id=a as Action,v=ACTIONS.find(x=>x.id===id)!,avail=availableAction(session,id);
         return <button key={id} className="j3-choice" disabled={!avail.ok} onClick={()=>operate(id)}>
           <span><b>{v.title}</b><em>{v.cost?v.cost+" CREDITS":"FREE"}</em></span>
           <small>{avail.ok?v.note:avail.reason}</small></button>;
       })}</div>
       <div className="j3-choices"><button className="j3-choice" disabled={!availableAction(session,"monitor").ok}
         onClick={()=>operate("monitor")}><b>Check equipment without upgrading</b><small>{availableAction(session,"monitor").ok?"Free operation. Advance today without a construction purchase.":availableAction(session,"monitor").reason}</small></button></div>
       {notice&&<div className="j3-info" role="status">{notice}</div>}
       </div>
       <div className="j3-panel-footer"><button className="j3-primary" onClick={event=>{
         // A trailing synthetic click from INTERACT can hit this button before
         // the finger initiates a new press. Keep the console open.
         if(event.detail>0&&performance.now()-consoleOpenedAt.current<450){event.preventDefault();return;}
         setPanel(null);setNotice("");
       }}>RETURN TO 3D ROOM</button></div>
     </section>}
     {panel==="event"&&<section className="j3-panel" role="dialog" aria-modal="true" aria-label="Emergency briefing">
       <span className="j3-kicker">⚠ MISSION CONTROL</span><h2>{incident?.title||"Mission Status"}</h2>
       <p>{incident?.detail||"There is currently no unresolved emergency."}</p>
       <p>Go to the <b>{required?focusAction(required).title:"nearest facility"}</b>, walk through its airlock, and use its control panel to respond. Your actions have real consequences.</p>
       <button className="j3-primary" onClick={()=>setPanel(null)}>FIND THE FACILITY IN 3D →</button>
     </section>}
     {panel==="mission"&&<section className="j3-panel" role="dialog" aria-modal="true" aria-label="Mission Objectives">
       <span className="j3-kicker">MISSION CONTROL / DAY {session.sol}</span><h2>{brief.title}</h2><p>{brief.description}</p>
       <div className="j3-map-direction"><b>★ {nav.title}</b><span>{nav.description}</span></div>
       <button onClick={()=>setPanel("map")}>VIEW BASE MAP AND BUILDING GUIDE ↗</button>
       <div className="j3-info">{brief.tip}</div>
       <div className="j3-split"><div className="j3-info">CREW SAFETY<br/><b>{Math.round(session.safety)}%</b></div>
         <div className="j3-info">RADIATION<br/><b>{Math.round(session.radiation)} INDEX</b></div></div>
       <div className="j3-info">CROP GROWTH {Math.round(session.crop)}/100 · FOOD PRODUCED {session.foodProduced} · CREDITS {session.credits} · SHIELD LEVEL {session.shielding}</div>
       <div className="j3-checks">{needs.map((v,i)=><span key={i}>{v.met?"✓":"○"} {v.title}</span>)}</div>
       {pending&&<button onClick={()=>setPanel("event")}>⚠ VIEW EMERGENCY BRIEFING</button>}
       <div className="j3-row"><button onClick={()=>setPanel(null)} className="j3-primary">BACK TO 3D GAME</button>
         
         <button onClick={restart}>RESTART RUN</button></div>
     </section>}
     {panel==="help"&&<section className="j3-panel" role="dialog" aria-modal="true" aria-label="3D astronaut controls">
       <span className="j3-kicker">WELCOME TO THE 3D MISSION</span><h2>YOU ARE THE ASTRONAUT.</h2>
       <p>This is a walkable Moon/Mars base. The equipment you operate changes your mission resources and the world you see.</p>
       <div className="j3-tutorial-steps">
         <div><b>1. WALK</b><br/>Touch anywhere in the bottom-left movement zone to make a joystick appear. Move your finger to walk (or use WASD).</div>
         <div><b>2. FIND YOUR WAY</b><br/>Open MAP to see yourself, your mission target and what every building does. Follow the highlighted building.</div>
         <div><b>3. OPEN AND OPERATE</b><br/>Approach the door, press INTERACT, walk inside and operate the glowing console. Drag from RUN or INTERACT to turn the camera.</div>
         <div><b>4. CREW'S DAILY ROUTINE</b><br/>In Crew Habitat, INTERACT at the dining table for breakfast. Complete your engineering task, return for dinner, then INTERACT at the bed to sleep. Each new day begins here.</div>
       </div>
       <p className="j3-small">The visual environment and resource calculations are stylized educational simulations, not photorealistic NASA engineering predictions. Your mission is saved on this device.</p>
       <button className="j3-primary" onClick={()=>setPanel(null)}>ENTER 3D WORLD →</button>
     </section>}
     {panel==="outcome"&&<section className="j3-panel" role="dialog" aria-modal="true" aria-label="Mission results">
       <span className="j3-kicker">{complete?"FINAL MISSION RESULTS":"MISSION CONTROL · DAY "+lastResult?.before.sol+" COMPLETE"}</span>
       <h2>{complete?session.phase==="won"?"OUTPOST SURVIVED!":"MISSION FAILED — LEARN AND RETRY":"WHAT CHANGED IN YOUR OUTPOST?"}</h2>
       <p>{lastResult&&lastResult.before!==lastResult.after?dayLesson(lastResult.before,lastResult.after):"Review the actual mission results and engineering choices."}</p>
       {lastResult&&lastResult.before!==lastResult.after&&<div className="j3-result">{dailyChanges(lastResult.before,lastResult.after).filter(x=>x.key!=="crop").map(x=><div key={x.key}>
         <span>{x.label.toUpperCase()}</span><strong>{Math.round(x.after)}{x.key==="radiation"?"":"%"}</strong><small>{x.delta>0?"+":""}{x.delta} TODAY</small>
       </div>)}</div>}
       {complete&&<><div className="j3-score">{missionScore(session)}<small>/100 · {session.phase==="won"?"SUCCESS":"FAILED RUN (CAPPED AT 39)"}</small></div>
         <div className="j3-checks">{needs.map((v,i)=><span key={i}>{v.met?"✓":"✕"} {v.title}</span>)}</div>
         <p>{session.phase==="lost"?"A high score cannot be earned from random upgrades when an outpost fails. Crew survival, sufficient supplies and the full objectives determine success.":"Your score rewards protecting the crew, keeping supplies healthy and using resources efficiently."}</p></>}
       <details><summary>ENGINEERING REPORT — WHY?</summary>{session.lastReport.map((s,i)=><p key={i}>{s}</p>)}</details>
       <div className="j3-row">{complete?<><button className="j3-primary" onClick={restart}>TRY AGAIN ↻</button>
           <button onClick={()=>{setSession(null);setRoom(null);setPanel(null);}}>CHOOSE ANOTHER PLANET</button></>:
           <button className="j3-primary" onClick={()=>{setPanel(null);setNotice("");}}>WAKE IN CREW HABITAT · DAY {session.sol} →</button>}
       </div>
     </section>}
   </div>}
   {!panel&&pending&&<button className="j3-status" style={{cursor:"pointer"}} onClick={()=>setPanel("event")}>⚠ EMERGENCY! GO TO {required?focusAction(required).title.toUpperCase():"FACILITY"} · TAP FOR DETAILS</button>}
   {!panel&&canAdvance&&<div className="j3-status" style={{top:145}}>✓ BREAKFAST · MISSION · DINNER COMPLETE — GO TO YOUR BUNK AND PRESS INTERACT TO SLEEP</div>}
   {!saveOk&&!panel&&<div className="j3-status" style={{top:185}}>⚠ Browser cannot save progress. Do not close the tab.</div>}
 </div>;
}

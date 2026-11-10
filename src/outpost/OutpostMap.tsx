import {useState} from "react";
import {BASE_FACILITIES,doorPosition,type Point2} from "./worldLogic";
import {FACILITY_GUIDE,missionDestination,destinationGuide} from "./navigation";
import type {FacilityId} from "./FacilityScene";
import type {Outpost} from "./engine";

/** A real plan-view of the six playable buildings; north is at the top. */
export default function OutpostMap({session,position,room,onClose}:{session:Outpost;position:Point2;room:FacilityId|null;onClose:()=>void}){
 const target=missionDestination(session);
 const [selected,setSelected]=useState<FacilityId>(target);
 const place=BASE_FACILITIES.find(f=>f.id===selected)!;
 const direction=destinationGuide(position,room,target);
 const percent=(n:number)=>((n+25)/50)*100;
 return <section className="j3-panel j3-map-panel" role="dialog" aria-modal="true" aria-label="Outpost map and facility guide">
   <div className="j3-map-header">
     <div><span className="j3-kicker">MISSION NAVIGATION / NORTH ↑</span>
       <h2>WHERE SHOULD I GO?</h2></div>
     <button onClick={onClose}>BACK TO GAME ✕</button>
   </div>
   <div className="j3-map-direction"><b>★ {direction.title}</b><span>{direction.description}</span></div>
   <div className="j3-map-content">
     <div className="j3-map-ground" role="group" aria-label="Map of the Moon or Mars outpost">
       <span className="j3-map-north">N ↑</span>
       <svg className="j3-map-paths" viewBox="0 0 500 500" aria-hidden="true">
         {BASE_FACILITIES.map(f=><line key={f.id} x1="250" y1="250" x2={(f.x+25)*10} y2={(f.z+25)*10} stroke="#78b0ae" strokeWidth="3" strokeDasharray="10 10" opacity=".5"/>)}
       </svg>
       <span className="j3-map-centre">BASE CENTRE</span>
       {BASE_FACILITIES.map(f=><button key={f.id}
         className={"j3-map-pin"+(target===f.id?" target":"")+(selected===f.id?" selected":"")}
         style={{left:percent(f.x)+"%",top:percent(f.z)+"%"}}
         onClick={()=>setSelected(f.id)}
         aria-label={f.title+(target===f.id?" — mission destination":"")}>
         <b>{target===f.id?"★ ":""}{f.title}</b>
       </button>)}
       {!room&&<span className="j3-map-player" title="Your astronaut's position"
         style={{left:percent(position.x)+"%",top:percent(position.z)+"%"}}>YOU</span>}
       {room&&<span className="j3-map-indoor">YOU ARE INSIDE {BASE_FACILITIES.find(f=>f.id===room)?.title.toUpperCase()}</span>}
     </div>
     <div className="j3-map-details">
       <span className="j3-kicker">SELECT A BUILDING TO LEARN MORE</span>
       <h3>{place.title} {place.id===target?"★":""}</h3>
       <p>{FACILITY_GUIDE[place.id].purpose}</p>
       <strong>WHAT YOU CAN DO HERE</strong>
       <p>{FACILITY_GUIDE[place.id].task}</p>
       <p className="j3-map-entrance">The entrance faces the central base paths. Approach the front airlock, press INTERACT, and walk inside to reach the control console.</p>
       <div className="j3-map-legend"><span><i className="target"/> ★ Your mission destination</span><span><i className="player"/> YOU Your current position</span></div>
     </div>
   </div>
   <div className="j3-map-shortlist">
     {BASE_FACILITIES.map(f=><button key={f.id} onClick={()=>setSelected(f.id)}
       className={selected===f.id?"selected":""}>{target===f.id?"★ ":""}{f.title}<small>{FACILITY_GUIDE[f.id].purpose}</small></button>)}
   </div>
   <button className="j3-primary" onClick={onClose}>RETURN TO THE 3D WORLD →</button>
 </section>;
}

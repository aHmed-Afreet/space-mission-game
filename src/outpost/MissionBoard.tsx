import {useState} from "react";
import {allMainMissions,currentMainMission,sideQuests} from "./questBoard";
import type {Outpost} from "./engine";

/** Complete ten-sol plan plus optional resource objectives. This board does
 * not skip missions or modify scoring; it only reflects live mission state. */
export default function MissionBoard({session,onClose}:{session:Outpost;onClose:()=>void}){
 const [tab,setTab]=useState<"main"|"side">("main");
 const missions=allMainMissions(session),quests=sideQuests(session);
 const complete=quests.filter(q=>q.done).length;
 return <section className="j3-panel j3-panel-console j3-board-panel" role="dialog" aria-modal="true" aria-label="Complete Outpost Mission Board">
   <div className="j3-panel-content" tabIndex={0} aria-label="Scroll all mission and side quest objectives">
     <span className="j3-kicker">MISSION BOARD · {session.destination.toUpperCase()} · DAY {Math.min(session.sol,10)}/10</span>
     <h2>MISSION CONTROL</h2>
     <p>Every planned day and optional side quest. The current emergency or low-resource priority can temporarily override today's planned assignment.</p>
     <div className="j3-board-tabs" role="group" aria-label="Mission board categories">
       <button type="button" aria-pressed={tab==="main"} onClick={()=>setTab("main")}>MAIN MISSIONS · 10</button>
       <button type="button" aria-pressed={tab==="side"} onClick={()=>setTab("side")}>SIDE QUESTS · {complete}/{quests.length}</button>
     </div>
     {tab==="main"?<>
       <div className="j3-info">ACTIVE OBJECTIVE: <b>{currentMainMission(session).title}</b></div>
       <div className="j3-board-list">{missions.map(item=><article key={item.day}
         className={"j3-board-quest"+(item.current?" current":item.done?" done":"")}>
         <div className="j3-board-head"><strong>DAY {String(item.day).padStart(2,"0")} · {item.planned.title}</strong><span>{item.status}</span></div>
         <p>{item.planned.description}</p>
         <small>FACILITY: {item.planned.focus.toUpperCase()} · {item.planned.tip}</small>
       </article>)}</div>
     </>:<>
       <div className="j3-info">OPTIONAL GOALS: {complete} OF {quests.length} CURRENTLY MET. These are challenge milestones, not extra credits. Resource thresholds can change as supplies are used.</div>
       <div className="j3-board-list">{quests.map(q=><article key={q.id} className={"j3-board-quest"+(q.done?" done":"")}>
         <div className="j3-board-head"><strong>{q.done?"✓ ":"○ "}{q.title}</strong><span>{q.done?"MET":"OPTIONAL"}</span></div>
         <p>{q.detail}</p>
         <div className="j3-board-progress" aria-label={q.title+" progress"}><i style={{width:Math.min(100,q.progress/q.goal*100)+"%"}}/></div>
         <small>{Math.round(q.progress)}/{q.goal} {q.unit}</small>
       </article>)}</div>
     </>}
   </div>
   <div className="j3-panel-footer"><button className="j3-primary" type="button" onClick={onClose}>RETURN TO 3D WORLD</button></div>
 </section>;
}

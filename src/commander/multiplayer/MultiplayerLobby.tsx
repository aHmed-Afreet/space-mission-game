import {useState} from "react";
import {normalizeCrewCode,roomCapacity,type CrewMember,type RoomRole} from "./protocol";

export default function MultiplayerLobby({role,code,maxPlayers,members,message,connecting,
 onCreate,onJoin,onLeave}:{
 role:RoomRole|null;code:string;maxPlayers:2|3|4;members:CrewMember[];message:string;connecting:boolean;
 onCreate:(capacity:2|3|4)=>void;onJoin:(code:string)=>void;onLeave:()=>void;
}){
 const [choice,setChoice]=useState<"create"|"join"|null>(null);
 const [join,setJoin]=useState(()=>{try{return normalizeCrewCode(new URLSearchParams(window.location.search).get("commanderRoom")??"");}catch{return "";}});
 const parsed=roomCapacity(normalizeCrewCode(join));
 return <section className="cmd-coop-lobby" aria-label="Commander online co-op multiplayer">
  <div className="cmd-coop-header">
   <div><small>COMMANDER ONLY · ONLINE CO-OP</small>
    <h2>Your crew. Different objectives.</h2>
    <p>Connect up to four astronauts. Each objective is assigned to one teammate, with shared progress.</p></div>
   <strong className="cmd-coop-count">{Math.max(1,members.length)} / {role?maxPlayers:4} CREW</strong>
  </div>
  {!role?<>
   {!choice?<div className="cmd-coop-choice">
    <button type="button" onClick={()=>setChoice("create")}>CREATE ROOM</button>
    <button type="button" onClick={()=>setChoice("join")}>JOIN ROOM</button>
   </div>:<div className="cmd-coop-choice">
    {choice==="create"?<div className="cmd-coop-form">
      <label htmlFor="coop-seat-limit">CREATE A PRIVATE ROOM</label>
      <p>Room capacity: up to 4 players. No player-count selection needed.</p>
      <button type="button" disabled={connecting} onClick={()=>onCreate(4)}>GENERATE ROOM CODE</button>
    </div>:<div className="cmd-coop-form">
      <label htmlFor="coop-room-code">JOIN A FRIEND'S ROOM</label>
      <input id="coop-room-code" value={join} placeholder="XXXXXXXXX-4" autoComplete="off"
       spellCheck={false} maxLength={11}
       onChange={e=>setJoin(normalizeCrewCode(e.target.value))}
       aria-describedby="coop-room-hint"/>
      <button type="button" disabled={connecting||!parsed} onClick={()=>onJoin(normalizeCrewCode(join))}>JOIN ROOM</button>
      <small id="coop-room-hint">Enter the code shared by the host. No login or personal details needed.</small>
    </div>}
    <button type="button" onClick={()=>setChoice(null)}>← BACK</button>
   </div>}
   <div className="cmd-coop-note">Some restricted school networks may prevent peer-to-peer connections.</div>
  </>:<>
   <div className="cmd-coop-room">
    <div className="cmd-coop-invite">
      <div><small>PRIVATE MISSION CODE</small><strong>{code}</strong></div>
      <button type="button" onClick={()=>{void navigator.clipboard?.writeText(code);}}>COPY CODE</button>
      <button type="button" onClick={()=>{void navigator.clipboard?.writeText(
        location.origin+location.pathname+"?commanderRoom="+encodeURIComponent(code));}}>COPY INVITE LINK</button>
    </div>
    <p className="cmd-coop-status" role="status">{message}</p>
    <div className="cmd-coop-roster" aria-label="Connected astronaut roster">
      {Array.from({length:maxPlayers},(_,i)=>{
       const peer=members.find(m=>["Commander","Engineer","Scientist","Communications"][i]===m.role);
       return <div key={i} className={"cmd-coop-seat"+(peer?" connected":"")}>
         <span>{peer?"●":"○"}</span><b>{["Commander","Engineer","Scientist","Communications"][i]}</b>
         <small>{peer?(peer.isHost?"HOST":"CONNECTED"):"OPEN SEAT"}</small>
       </div>;
      })}
    </div>
    {role==="host"?<p className="cmd-coop-next">Select a Commander campaign below, prepare the spacecraft and launch.
      Connected astronauts automatically enter your mission when you launch.</p>:
      <p className="cmd-coop-next">You're connected as crew. The host selects and launches the mission.
       Wait here; the spacecraft loads automatically when the host starts.</p>}
    <button type="button" className="cmd-coop-leave" onClick={onLeave}>LEAVE ONLINE ROOM</button>
   </div>
  </>}
 </section>;
}
export function FlightCrewHud({members,ownId,code,onLeave}:{
 members:CrewMember[];ownId:string;code:string;onLeave:()=>void;
}){
 const [expanded,setExpanded]=useState(false);
 return <aside className={"cmd-coop-flight-hud"+(expanded?" expanded":"")}
  aria-label="Online Commander crew and multiplayer status">
  <button type="button" onClick={()=>setExpanded(x=>!x)}
   aria-expanded={expanded}>◉ LIVE CREW {members.length}/4 <span>{expanded?"−":"+"}</span></button>
  {expanded&&<div>
    <p>ROOM {code}</p>
    {members.map(m=><p key={m.id}><span aria-hidden="true">●</span> {m.role}
      {m.id===ownId?" (YOU)":m.isHost?" (HOST)":""}
     </p>)}
    <button type="button" onClick={onLeave}>LEAVE CO-OP</button>
   </div>}
 </aside>;
}

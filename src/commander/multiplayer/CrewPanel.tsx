import {useState} from "react";
import {CREW_MAX_PLAYERS,type CrewRoomState} from "./protocol";
import "./crew.css";

export default function CrewPanel({room,connecting,error,inFlight,onCreate,onJoin,onLeave}:{
 room:CrewRoomState|null;connecting:boolean;error:string;inFlight:boolean;
 onCreate:()=>Promise<void>;onJoin:(code:string)=>Promise<void>;onLeave:()=>void;
}){
 const [open,setOpen]=useState(false);
 const [code,setCode]=useState("");
 const [copied,setCopied]=useState(false);
 return <div className={"commander-crew-ui"+(inFlight?" in-flight":"")} role="region" aria-label="Commander online cooperative crew">
  <button type="button" className="commander-crew-toggle"
   aria-expanded={open} onClick={()=>setOpen(x=>!x)}>
   <span aria-hidden="true">◉</span> ONLINE CREW
   <strong>{room?room.members.length+"/"+CREW_MAX_PLAYERS:"1–4"}</strong>
  </button>
  {open&&<section className="commander-crew-panel" role="dialog" aria-label="Online crew room">
    <header><div><small>COMMANDER · REAL ONLINE CO-OP</small>
     <h2>{room?"CREW CONNECTED":"CREATE OR JOIN A MISSION"}</h2></div>
     <button type="button" onClick={()=>setOpen(false)} aria-label="Close crew panel">✕</button></header>
    {room?<>
     <div className="commander-crew-status" role="status">
      <b>{room.status==="connected"?"● CONNECTED":"● DISCONNECTED"}</b>
      <span>{room.mode==="host"?"You are the mission host.":"You joined another astronaut's live mission."}</span>
     </div>
     <div className="commander-crew-code"><span>PRIVATE ROOM CODE</span>
      <strong>{room.code.slice(0,4)} {room.code.slice(4,8)} {room.code.slice(8)}</strong>
      <button type="button" onClick={()=>{
       void navigator.clipboard?.writeText(room.code).then(()=>{setCopied(true);}).catch(()=>{setCopied(false);});
      }}>{copied?"COPIED ✓":"COPY CODE"}</button>
     </div>
     <ol className="commander-crew-roster">
      {room.members.map(member=><li key={member.id}>
       <span className="commander-crew-number">✦</span>
       <b>{member.role}</b>
       <small>{member.id===room.myId?"YOU":"ONLINE"}</small>
      </li>)}
      {Array.from({length:CREW_MAX_PLAYERS-room.members.length},(_,i)=>
       <li className="waiting" key={"empty-"+i}><span className="commander-crew-number">○</span>
        <b>Open seat</b><small>AWAITING PLAYER</small></li>)}
     </ol>
     <p>{room.mode==="host"?"Start or resume a Commander mission. Everyone joins your shared 3D world.":
       "Your host controls the mission selection. All astronauts can move independently and help operate equipment."}</p>
     <button type="button" className="commander-crew-leave" onClick={()=>{onLeave();setCopied(false);}}>LEAVE ONLINE CREW</button>
    </>:<>
     <p>Invite up to three other players using a private room code. You will see their astronaut suits moving inside Commander in real time.</p>
     <button type="button" className="commander-crew-create" disabled={connecting}
      onClick={()=>{setCopied(false);void onCreate();}}>{connecting?"CONNECTING…":"CREATE PRIVATE ROOM"}</button>
     <div className="commander-crew-divider">OR JOIN YOUR FRIEND'S ROOM</div>
     <label htmlFor="commander-room-code">12-CHARACTER CREW CODE</label>
     <input id="commander-room-code" type="text" autoComplete="off" autoCapitalize="characters"
      value={code} onChange={e=>setCode(e.target.value.slice(0,22))}
      placeholder="ABCD EFGH JKLM" spellCheck={false}/>
     <button type="button" disabled={connecting||code.replace(/[\s-]/g,"").length!==12}
      onClick={()=>void onJoin(code)}>{connecting?"CONNECTING…":"JOIN CREW ONLINE"}</button>
     <p className="commander-crew-small">No account, chat, microphone or location sharing. Codes are private: only share yours with trusted teammates.</p>
    </>}
    {error&&<div className="commander-crew-error" role="alert">{error}</div>}
    <p className="commander-crew-small">Powered by browser WebRTC and a shared signaling service. Some school or mobile networks can block peer connections; a connection is only confirmed when the roster shows the player.</p>
   </section>}
 </div>;
}

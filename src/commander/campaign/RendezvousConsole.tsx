import {useEffect,useMemo,useState} from "react";
import {rendezvousBlocker,type Session} from "./engine";

export default function RendezvousConsole({
 session,onComplete,onClose,onResume
}:{
 session:Session; onComplete:()=>void; onClose:()=>void; onResume:()=>void;
}){
 // Deliberately simplified training procedure, not full orbital mechanics.
 const [bearing,setBearing]=useState(24);
 const [closing,setClosing]=useState(1.6);
 const [range,setRange]=useState(240);
 const [autopilot,setAutopilot]=useState(false);
 const [attemptedSession,setAttemptedSession]=useState<Session|null>(null);
 const [error,setError]=useState("");
 const blocker=rendezvousBlocker(session);
 // A rejected action leaves the panel open and displays the actual engine response.
 useEffect(()=>{
  if(attemptedSession && attemptedSession !== session){
   if(session.objective===attemptedSession.objective)
    setError(session.notice || "Mission control did not accept the approach.");
   setAttemptedSession(null);
  }
 },[attemptedSession,session]);
 const confirm=()=>{
  if(blocker){setError(blocker);return;}
  setError("");
  setAttemptedSession(session);
  onComplete();
 };
 const within=Math.abs(bearing)<=3&&closing<=.25&&range<=30;
 const ready=autopilot||within;
 const values=useMemo(()=>[
  {label:"Bearing error",value:`${Math.abs(bearing).toFixed(0)}°`,safe:Math.abs(bearing)<=3},
  {label:"Closing speed",value:`${closing.toFixed(2)} m/s`,safe:closing<=.25},
  {label:"Target separation",value:`${range.toFixed(0)} m`,safe:range<=30},
 ],[bearing,closing,range]);
 return <div className="rendezvous-backdrop" role="presentation">
  <section className="rendezvous-console" role="dialog" aria-modal="true"
   aria-label="Satellite rendezvous navigation computer">
   <header className="rendezvous-head">
    <div><small>ORBITAL / FLIGHT NAVIGATION / MISSION 02</small>
     <h2>Satellite Rendezvous Computer</h2>
     <p>Match the target's approach corridor before performing the proximity manoeuvre.</p>
    </div>
    <button type="button" onClick={onClose} aria-label="Close navigation computer">×</button>
   </header>
   <div className="rendezvous-main">
    <div className="rendezvous-scope" aria-label="Approach geometry illustration">
     <svg viewBox="0 0 350 250" role="img" aria-label="Relative flight path and target satellite">
      <defs><radialGradient id="navGlow"><stop stopColor="#13616e" stopOpacity=".45"/><stop offset="1" stopColor="#060e19" stopOpacity="0"/></radialGradient></defs>
      <rect width="350" height="250" rx="12" fill="#07131d"/>
      <ellipse cx="175" cy="125" rx="146" ry="98" fill="url(#navGlow)" stroke="#2c515d" strokeWidth="1"/>
      {[38,76,112].map(r=><circle key={r} cx="175" cy="125" r={r} fill="none" stroke="#295360" strokeDasharray="3 7"/>)}
      <path d="M175 12V238M18 125H332" stroke="#315363" strokeDasharray="4 6"/>
      <path d="M175 211L175 52" stroke="#72b8c8" strokeWidth="3" strokeDasharray="8 8" opacity=".8"/>
      <g transform={`translate(${175+Math.sin(bearing*Math.PI/180)*90} ${125-Math.cos(bearing*Math.PI/180)*90})`}>
       <path d="M-38 -5H38M0 -23V23" stroke="#e1c48b" strokeWidth="5"/>
       <rect x="-15" y="-14" width="30" height="28" rx="3" fill="#b7c3c8"/>
       <rect x="-52" y="-10" width="22" height="20" fill="#294c74" stroke="#8facc6"/>
       <rect x="30" y="-10" width="22" height="20" fill="#294c74" stroke="#8facc6"/>
      </g>
      <path d="M165 136L175 122L185 136L175 132Z" fill="#8df2da"/>
      <text x="20" y="27" fill="#bcd0d5" fontSize="10" fontFamily="monospace">RELATIVE MOTION TRACKER</text>
      <text x="20" y="230" fill="#9bc3bf" fontSize="10" fontFamily="monospace">SIMULATED ORBITAL ALIGNMENT</text>
     </svg>
     <div className="rendezvous-readings">
      {values.map(v=><div key={v.label}><small>{v.label}</small><strong className={v.safe||autopilot?"good":""}>{autopilot?(v.label==="Bearing error"?"0°":v.label==="Closing speed"?"0.10 m/s":"25 m"):v.value}</strong></div>)}
     </div>
    </div>
    <div className="rendezvous-procedure">
      <h3>Guidance controls</h3>
      <p>Adjust all three values into the green docking corridor. You can also use the onboard guidance computer to solve the approach automatically.</p>
      <label>Bearing alignment <b>{autopilot?"0°":bearing+"°"}</b>
       <input type="range" min="-25" max="25" step="1" value={autopilot?0:bearing}
        onChange={e=>{setAutopilot(false);setBearing(Number(e.target.value))}}/>
      </label>
      <label>Relative closing speed <b>{autopilot?"0.10":closing.toFixed(2)} m/s</b>
       <input type="range" min="0.05" max="2" step=".05" value={autopilot ? .1 : closing}
        onChange={e=>{setAutopilot(false);setClosing(Number(e.target.value))}}/>
      </label>
      <label>Separation distance <b>{autopilot?"25":range} m</b>
       <input type="range" min="20" max="240" step="5" value={autopilot?25:range}
        onChange={e=>{setAutopilot(false);setRange(Number(e.target.value))}}/>
      </label>
      <div className={ready?"rendezvous-result ready":"rendezvous-result"}>
       {ready?"< APPROACH CORRIDOR VERIFIED >":"ALIGN BEARING ≤ 3° · SPEED ≤ 0.25 m/s · DISTANCE ≤ 30 m"}
      </div>
      <div className="rendezvous-buttons">
       <button type="button" onClick={()=>{setBearing(0);setClosing(.1);setRange(25);setAutopilot(true)}}>Run auto-guidance</button>
       <button type="button" disabled={!ready||!!attemptedSession} className="rendezvous-confirm" onClick={confirm}>
        Confirm approach manoeuvre →
       </button>
      </div>
      {blocker&&<p className="rendezvous-paused-warning" role="alert">{blocker}</p>}
      {error&&!blocker&&<p className="rendezvous-paused-warning" role="alert">{error}</p>}
      {attemptedSession&&<p role="status">Confirming objective completion with mission control…</p>}
      {session.state.paused&&<button type="button" className="rendezvous-resume" onClick={onResume}>▶ Resume mission</button>
      <small className="rendezvous-disclaimer">Simplified educational navigation exercise; target vehicle and separation values are simulated, not live flight telemetry.</small>
    </div>
   </div>
  </section>
 </div>
}

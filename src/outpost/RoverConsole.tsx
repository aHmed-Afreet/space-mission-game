import {useEffect} from "react";
import type {RefObject} from "react";
import {BASE_FACILITIES} from "./worldLogic";
import {roverDisplaySpeed,type RoverPose,type RoverDrive} from "./roverPhysics";

/** Remote surface camera/telemetry controller for the Storm Shelter.
 * The surface 3D model shares this position and visibly moves when driven. */
export default function RoverConsole({pose,drive,onClose}:{
 pose:RoverPose;drive:RefObject<RoverDrive>;onClose:()=>void;
}){
 useEffect(()=>{
  const keys=new Set<string>();
  const apply=()=>{
   drive.current.throttle=Number(keys.has("arrowup")||keys.has("w"))-Number(keys.has("arrowdown")||keys.has("s"));
   drive.current.steer=Number(keys.has("arrowright")||keys.has("d"))-Number(keys.has("arrowleft")||keys.has("a"));
  };
  const down=(e:KeyboardEvent)=>{
   const key=e.key.toLowerCase();
   if(["arrowup","arrowdown","arrowleft","arrowright","w","a","s","d"].includes(key)){e.preventDefault();keys.add(key);apply();}
  };
  const up=(e:KeyboardEvent)=>{keys.delete(e.key.toLowerCase());apply();};
  const blur=()=>{keys.clear();apply();};
  window.addEventListener("keydown",down);window.addEventListener("keyup",up);window.addEventListener("blur",blur);
  return ()=>{window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);window.removeEventListener("blur",blur);blur();};
 },[drive]);
 const hold=(axis:keyof RoverDrive,value:number)=>({
  onPointerDown:(e:React.PointerEvent<HTMLButtonElement>)=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);drive.current[axis]=value;},
  onPointerUp:()=>{drive.current[axis]=0;},
  onPointerCancel:()=>{drive.current[axis]=0;},
  onLostPointerCapture:()=>{drive.current[axis]=0;}
 });
 return <section className="j3-panel j3-panel-console j3-rover-panel" role="dialog" aria-modal="true" aria-label="Storm Shelter Rover Remote Control">
  <div className="j3-panel-content" tabIndex={0}>
   <span className="j3-kicker">STORM SHELTER · ROVER REMOTE DRIVE</span>
   <h2>SURFACE ROVER CONTROL</h2>
   <p>Operate the actual rover outside the shelter. Hold a direction to accelerate and steer; release to slow down. The rover cannot drive through buildings.</p>
   <div className="j3-rover-readouts" role="status"><b>SPEED {roverDisplaySpeed(pose)}</b><b>X {pose.x.toFixed(1)} m</b><b>Z {pose.z.toFixed(1)} m</b></div>
   <div className="j3-rover-radar" role="img" aria-label="Top-down rover location and surface buildings">
    {BASE_FACILITIES.map(f=><span key={f.id} className="j3-rover-map-building"
     style={{left:(f.x+29)/58*100+"%",top:(f.z+29)/58*100+"%"}} title={f.title}>{f.title}</span>)}
    <div className="j3-rover-map-car" style={{left:(pose.x+29)/58*100+"%",top:(pose.z+29)/58*100+"%",transform:"translate(-50%,-50%) rotate("+(-pose.heading*180/Math.PI)+"deg)"}}>▲</div>
   </div>
   <div className="j3-rover-controls" aria-label="Drive rover">
    <button type="button" {...hold("throttle",1)} aria-label="Drive forward">▲ FORWARD</button>
    <div><button type="button" {...hold("steer",-1)} aria-label="Steer left">◀ LEFT</button>
         <button type="button" onClick={()=>{drive.current.throttle=0;drive.current.steer=0;}} aria-label="Release rover controls">■ STOP</button>
         <button type="button" {...hold("steer",1)} aria-label="Steer right">RIGHT ▶</button></div>
    <button type="button" {...hold("throttle",-1)} aria-label="Reverse rover">▼ REVERSE</button>
   </div>
   <div className="j3-info">Keyboard: W/S or ↑/↓ to drive; A/D or ←/→ to steer. This is a game-scale driving simulation, not a real rover control interface. Daily challenge time continues while driving.</div>
  </div>
  <div className="j3-panel-footer"><button type="button" className="j3-primary" onClick={onClose}>LEAVE ROVER CONTROLS</button></div>
 </section>;
}

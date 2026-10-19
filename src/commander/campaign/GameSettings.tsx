import type { PlayerPreferences } from "./preferences";
import { sound } from "./audio";
import { useEffect, useRef, useState } from "react";
import Icon from "../Icons";

export default function GameSettings({
  value, onChange, onClose, onReset, onDevice, device, readonly=false,
}: {
  value: PlayerPreferences;
  onChange: (value:PlayerPreferences)=>void;
  onClose:()=>void;
  onReset:()=>void;
  onDevice:(value:"ipad"|"iphone"|"laptop")=>void;
  device:"ipad"|"iphone"|"laptop";
  readonly?:boolean;
}) {
  const [muted,setMuted]=useState(sound.settings().mute);
  const [fullscreen,setFullscreen]=useState(!!document.fullscreenElement);
  const [screenError,setScreenError]=useState("");
  const close=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement | null;
    close.current?.focus();
    const key=(e:KeyboardEvent)=>{if(e.key==="Escape"){e.preventDefault();onClose();}};
    const changed=()=>setFullscreen(!!document.fullscreenElement);
    window.addEventListener("keydown",key);
    document.addEventListener("fullscreenchange",changed);
    return ()=>{window.removeEventListener("keydown",key);document.removeEventListener("fullscreenchange",changed);previous?.focus()};
  },[onClose]);
  const reset=()=>{
    if(readonly)return;
    if(window.confirm("RESET COMMANDER CAMPAIGN? This deletes all completed missions, agency budget, mission reports and the current checkpoint on this device. It cannot be undone.")) onReset();
  };
  const toggleFullscreen=async()=>{
    try {
      if(document.fullscreenElement) await document.exitFullscreen();
      else if(document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else setScreenError("Fullscreen is not available in this browser. Use the browser's full-screen or Add to Home Screen option.");
    } catch {setScreenError("Fullscreen was blocked by the browser. Continue in the normal view.");}
  };
  return <div className="game-settings-overlay" role="presentation">
    <button type="button" className="game-settings-shade" onClick={onClose} aria-label="Close settings"/>
    <section className="game-settings-dialog" role="dialog" aria-modal="true" aria-label="Game settings">
      <header><div><small>ORBITAL / PLAYER CONTROLS</small><h2>Settings</h2></div>
        <button ref={close} type="button" onClick={onClose} aria-label="Close settings"><Icon name="close"/> Close</button>
      </header>
      <div className="game-settings-body">
        <label htmlFor="settings-device">Device & controls</label>
        <select id="settings-device" value={device} onChange={e=>onDevice(e.target.value as "ipad"|"iphone"|"laptop")}>
          <option value="ipad">iPad · floating joystick, sprint and interact</option>
          <option value="iphone">iPhone · compact mobile controls</option>
          <option value="laptop">Laptop · WASD, Shift, E, drag to look</option>
        </select>
        <p>You can keep moving while holding Sprint. On touch devices, swipe on Sprint to turn, or use another finger to look.</p>
        <label htmlFor="settings-graphics">Graphics performance</label>
        <select id="settings-graphics" value={value.graphics} onChange={e=>onChange({...value,graphics:e.target.value as PlayerPreferences["graphics"]})}>
          <option value="quality">Quality · improved detail (powerful devices)</option>
          <option value="balanced">Balanced · recommended</option>
          <option value="battery">Battery saver · lower rendering demand</option>
        </select>
        <p>Graphics quality is fully applied the next time you enter a mission.</p>
        <label htmlFor="settings-look">Look sensitivity · {Math.round(value.lookSensitivity*100)}%</label>
        <input id="settings-look" type="range" min=".4" max="1.8" step=".1" value={value.lookSensitivity}
          onChange={e=>onChange({...value,lookSensitivity:Number(e.target.value)})}/>
        <label className="game-settings-toggle"><input type="checkbox" checked={value.showHints}
          onChange={e=>onChange({...value,showHints:e.target.checked})}/> Show control hints</label>
        <label className="game-settings-toggle"><input type="checkbox" checked={!muted}
          onChange={e=>{const isMuted=!e.target.checked; sound.configure({mute:isMuted});setMuted(isMuted)}}/> Sound effects & atmosphere</label>
        <button type="button" className="game-settings-fullscreen" onClick={toggleFullscreen}>
          {fullscreen?"Exit fullscreen":"Enter fullscreen"}
        </button>
        {screenError&&<p role="status">{screenError}</p>}
        <hr/>
        <h3>Campaign save</h3>
        <p>Progress saves locally in this browser. Reset deletes Commander mission unlocks, checkpoints, agency money and reports from this device.</p>
        <button type="button" className="game-settings-reset" disabled={readonly} onClick={reset}>Reset campaign progress…</button>
        {readonly&&<p>Reset is unavailable because the current save is protected as read-only.</p>}
        <p><a href="/privacy.html" target="_blank" rel="noopener noreferrer">Privacy & local saves</a> · Historical missions are educational simulations, not official NASA training.</p>
      </div>
    </section>
  </div>;
}

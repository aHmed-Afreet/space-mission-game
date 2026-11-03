import TouchActionButton from "../../TouchActionButton";
import type { PlayerPreferences } from "./preferences";
import { sound } from "./audio";
import { useEffect, useRef, useState } from "react";
import Icon from "../Icons";
import { useModalFocus } from "../modalFocus";

export default function GameSettings({
  value, onChange, onClose, onReset, onDevice, device, readonly=false, saveWarning="",
}: {
  value: PlayerPreferences;
  onChange: (value:PlayerPreferences)=>void;
  onClose:()=>void;
  onReset:()=>void;
  onDevice:(value:"ipad"|"iphone"|"laptop")=>void;
  device:"ipad"|"iphone"|"laptop";
  readonly?:boolean;
  saveWarning?:string;
}) {
  const [muted,setMuted]=useState(sound.settings().mute);
  const [fullscreen,setFullscreen]=useState(!!document.fullscreenElement);
  const [screenError,setScreenError]=useState("");
  const close=useRef<HTMLButtonElement>(null);
  const dialog=useRef<HTMLElement>(null);
  const overlay=useRef<HTMLDivElement>(null);
  useModalFocus({ dialog, boundary:overlay, initialFocus:close, onClose });
  useEffect(()=>{
    const changed=()=>setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange",changed);
    return ()=>document.removeEventListener("fullscreenchange",changed);
  },[]);
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
  return <div ref={overlay} className="game-settings-overlay" role="presentation">
    <TouchActionButton type="button" className="game-settings-shade" onActivate={onClose} aria-label="Close settings"/>
    <section ref={dialog} className="game-settings-dialog" role="dialog" aria-modal="true" aria-label="Game settings">
      <header><div><small>ORBITAL / PLAYER CONTROLS</small><h2>Settings</h2></div>
        <TouchActionButton ref={close} type="button" onActivate={onClose} aria-label="Close settings"><Icon name="close"/> Close</TouchActionButton>
      </header>
      <div className="game-settings-body">
        {saveWarning&&<p role="status">{saveWarning}</p>}
        <label htmlFor="settings-device">Device & controls</label>
        <select id="settings-device" value={device} onChange={e=>onDevice(e.target.value as "ipad"|"iphone"|"laptop")}>
          <option value="ipad">iPad · floating joystick, sprint and interact</option>
          <option value="iphone">iPhone · compact mobile controls</option>
          <option value="laptop">Laptop · WASD, Shift, E, drag to look</option>
        </select>
        <p>You can keep moving while holding Sprint. On touch devices, swipe on Sprint to turn, or use another finger to look.</p>
        <p>Commander uses compressed mission time: at 1×, one real second advances 30 mission seconds. Time warp also scales resource use.</p>
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
        <TouchActionButton type="button" className="game-settings-fullscreen" onActivate={toggleFullscreen}>
          {fullscreen?"Exit fullscreen":"Enter fullscreen"}
        </TouchActionButton>
        {screenError&&<p role="status">{screenError}</p>}
        <hr/>
        <h3>Campaign save</h3>
        <p>Progress saves locally in this browser. Reset deletes Commander mission unlocks, checkpoints, agency money and reports from this device.</p>
        <TouchActionButton type="button" className="game-settings-reset" disabled={readonly} onActivate={reset}>Reset campaign progress…</TouchActionButton>
        {readonly&&<p>Reset is unavailable because the current save is protected as read-only.</p>}
        <p><a href="/privacy.html" target="_blank" rel="noopener noreferrer">Privacy & local saves</a> · Historical missions are educational simulations, not official NASA training.</p>
      </div>
    </section>
  </div>;
}

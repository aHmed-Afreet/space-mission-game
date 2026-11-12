import {useMemo,useState} from "react";
import type {Action} from "./engine";
import type {FacilityId} from "./FacilityScene";

/** Real, completable game interaction: task only executes after puzzle success.
 * Puzzles are deterministic within a day and grant no extra credits/resources.
 * One operation per sol and all existing mission conditions still apply. */
export type MiniGameKind="signal"|"circuit";
export const chooseMiniGame=(room:FacilityId):MiniGameKind=>
 room==="greenhouse"||room==="shield"||room==="recycle"?"signal":"circuit";
export function targetRelays(sol:number,action:Action):boolean[]{
 const hash=action.split("").reduce((n,c)=>n*17+c.charCodeAt(0),sol*31);
 return [0,1,2,3].map(i=>Boolean((hash>>i)&1));
}
export function signalSequence(sol:number,action:Action):number[]{
 const hash=action.split("").reduce((n,c)=>n+c.charCodeAt(0),sol*19);
 return [0,1,2,3].map(i=>(hash+i*7+(i*i))%4);
}

export default function EngineeringMiniGame({action,room,sol,onComplete,onBack}:{
 action:Action;room:FacilityId;sol:number;onComplete:()=>void;onBack:()=>void;
}){
 const kind=chooseMiniGame(room),relays=useMemo(()=>targetRelays(sol,action),[sol,action]),
  sequence=useMemo(()=>signalSequence(sol,action),[sol,action]);
 const [switches,setSwitches]=useState<boolean[]>([false,false,false,false]);
 const [matched,setMatched]=useState(0),[misses,setMisses]=useState(0);
 const [solved,setSolved]=useState(false);
 const isCircuitComplete=switches.every((v,i)=>v===relays[i]);
 const tapSignal=(i:number)=>{
  if(solved)return;
  if(sequence[matched]===i){
   if(matched===sequence.length-1){setSolved(true);setMatched(sequence.length);}
   else setMatched(m=>m+1);
  }else{setMatched(0);setMisses(v=>v+1);}
 };
 return <section className="j3-panel j3-panel-console j3-minigame-panel" role="dialog" aria-modal="true" aria-label="Engineering training mini-game">
  <div className="j3-panel-content">
   <span className="j3-kicker">ENGINEERING PRACTICAL · DAY {sol} · {room.toUpperCase()}</span>
   <h2>{kind==="circuit"?"POWER RELAY CHALLENGE":"SIGNAL SEQUENCE CHALLENGE"}</h2>
   <p>{kind==="circuit"?"Match the required ON/OFF pattern to establish a safe circuit before performing the operation.":"Transmit the four-step diagnostic code in order. Wrong input restarts the sequence; the daily clock keeps running."}</p>
   <div className="j3-info">PENDING OPERATION: <b>{action.toUpperCase()}</b> · Complete this interactive challenge to authorize the normal engineering action. No extra credits are awarded.</div>
   {kind==="circuit"?<>
    <span className="j3-kicker">TARGET RELAY PATTERN</span>
    <div className="j3-minigame-target">{relays.map((on,i)=><b key={i}>R{i+1}: {on?"ON":"OFF"}</b>)}</div>
    <div className="j3-minigame-buttons">{switches.map((on,i)=><button type="button" key={i}
      aria-label={"Relay "+(i+1)+" "+(on?"on":"off")} aria-pressed={on}
      onClick={()=>setSwitches(old=>old.map((v,j)=>j===i?!v:v))}>
      <small>RELAY {i+1}</small><strong>{on?"● ON":"○ OFF"}</strong></button>)}</div>
    <div className="j3-info" role="status">{isCircuitComplete?"✓ Circuit ready. Authorize the operation.":"Adjust the four physical switches to match the target."}</div>
   </>:<>
    <span className="j3-kicker">CODE TO TRANSMIT (READ LEFT TO RIGHT)</span>
    <div className="j3-minigame-target">{sequence.map((n,i)=><b key={i}>{["◆","■","●","▲"][n]}</b>)}</div>
    <div className="j3-minigame-buttons">{["◆","■","●","▲"].map((glyph,i)=><button type="button" key={glyph}
     disabled={solved} onClick={()=>tapSignal(i)} aria-label={"Transmit symbol "+glyph}>
     <small>CHANNEL {i+1}</small><strong>{glyph}</strong></button>)}</div>
    <div className="j3-info" role="status">{solved?"✓ SIGNAL VERIFIED":"Correct signals: "+matched+"/"+sequence.length+" · Retries: "+misses}</div>
   </>}
  </div>
  <div className="j3-panel-footer j3-minigame-actions">
    <button type="button" onClick={onBack}>BACK TO EQUIPMENT</button>
    <button type="button" className="j3-primary" disabled={kind==="circuit"?!isCircuitComplete:!solved}
      onClick={onComplete}>AUTHORIZE ENGINEERING OPERATION</button>
  </div>
 </section>;
}

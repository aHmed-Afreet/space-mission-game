/**
 * Four active-play minutes to finish each simulated Outpost sol.
 * This is a gameplay deadline, not the length of a lunar/Martian day.
 * Time is accounted for separately from the v2 survival save format.
 */
import {GAME_KEY,type Destination,type Outpost} from "./engine";

export const DAY_TIME_LIMIT_MS=4*60*1000;
export const DAY_WARNING_MS=60*1000;
export const DAY_URGENT_MS=20*1000;
export type TimerPausePanel=null|"console"|"event"|"help"|"outcome"|"mission"|"map"|"board"|"timeout";

export function dayTimerKey(destination:Destination):string {
  return GAME_KEY+"-"+destination+"-day-clock";
}

export function normalizeSavedDayTime(raw:string|null,sol:number):number {
  if(!raw)return DAY_TIME_LIMIT_MS;
  try{
    const record=JSON.parse(raw) as {sol?:unknown;remainingMs?:unknown};
    if(record.sol!==sol||typeof record.remainingMs!=="number"||!Number.isFinite(record.remainingMs))return DAY_TIME_LIMIT_MS;
    return Math.max(0,Math.min(DAY_TIME_LIMIT_MS,Math.floor(record.remainingMs)));
  }catch{return DAY_TIME_LIMIT_MS;}
}

export function formatDayTime(ms:number):string {
  const secs=Math.ceil(Math.max(0,ms)/1000);
  return String(Math.floor(secs/60)).padStart(2,"0")+":"+String(secs%60).padStart(2,"0");
}

/** Intro/help, maps, mission details and between-sol reports are free to read.
 * Engineering consoles and ordinary exploration count against the deadline. */
export function dayTimerRuns(phase:Outpost["phase"],panel:TimerPausePanel,visible:boolean):boolean {
  return phase==="active"&&visible&&
    !["help","map","mission","board","event","outcome","timeout"].includes(panel??"");
}

/** Pure transition: a missed day is a failed timed challenge, never a win.
 * Existing mission score already caps failed games at 39. */
export function failDayDeadline(s:Outpost):Outpost {
  if(s.phase!=="active")return s;
  const reason="DAY "+s.sol+" FAILED: the 04:00 active-play deadline expired before the crew completed breakfast, engineering, dinner and sleep.";
  return {...s,phase:"lost",
    log:[...s.log,reason].slice(-35),
    lastReport:[reason,"The time limit is a game challenge, not actual lunar or Martian day length. Restart the mission to try again."]};
}

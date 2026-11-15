import {campaignWalkable, command, currentObjective, moveSession, optionalCommand, type Session} from "../campaign/engine";
import {worldAction, doors, lockers, type WorldAction} from "../campaign/ship";
import {equipment} from "../campaign/equipment";
import {objectiveOwner} from "./assignments";
import {validCrewAction, type CrewAction, type CrewMember} from "./protocol";
import type {CampaignAction} from "../campaign/definitions";

/** Limit one operation to its owner's current objective. Strip the transient
 * boundary before returning a session to storage or the network. */
export function withObjectiveTurn(s:Session,allowed:boolean,step:(s:Session)=>Session):Session{
 const current=currentObjective(s)?.id;
 const keep=(id:string)=>id===current||s.completed.includes(id);
 const scoped={...s,observations:{...s.observations,
  achieved:s.observations.achieved.filter(keep),pending:s.observations.pending.filter(keep)},
  objectiveTurn:{index:s.objective,allowed}};
 const next=step(scoped);
 if(next===scoped && scoped.observations.achieved.length===s.observations.achieved.length &&
    scoped.observations.pending.length===s.observations.pending.length)return s;
 const {objectiveTurn:_,...result}=next;
 return result;
}
export function crewTick(s:Session,step:(s:Session)=>Session):Session{
 const type=currentObjective(s)?.type;
 return withObjectiveTurn(s,type==="WAIT"||type==="TRANSMIT",step);
}
export function validWorldAction(value:unknown):value is WorldAction{
 if(!value||typeof value!=="object")return false;
 const a=value as Record<string,unknown>;
 const id=typeof a.id==="string"&&a.id.length>0&&a.id.length<=128;
 switch(a.kind){
  case "door":return !!id&&Object.hasOwn(doors,a.id as string);
  case "locker":return !!id&&Object.hasOwn(lockers,a.id as string);
  case "take":case "store":return !!id&&Object.hasOwn(equipment,a.id as string);
  case "switch":case "retrieveSample":case "diagnose":case "repairFault":case "verifyFault":return !!id;
  case "returnMeal":case "takeParts":case "storeParts":case "storeSamples":case "stowSuit":return true;
  case "target":return a.value==="earth"||a.value==="moon";
  case "antenna":return Number.isSafeInteger(a.value)&&Number(a.value)>=1;
  case "temperature":return typeof a.value==="number"&&Number.isFinite(a.value)&&a.value>=18&&a.value<=26;
  default:return false;
 }
}
export function applyCrewAction(s:Session,actor:string,members:readonly CrewMember[],task:CrewAction):Session{
 if(!validCrewAction(task)||task.sessionId!==s.id||s.report||s.state.ended||s.state.paused||!members.some(member=>member.id===actor)||
    !campaignWalkable(task.position.x,task.position.z,s))return s;
 const allowed=objectiveOwner(s.objective,members)===actor;
 const projected={...s,position:task.position};
 let next:Session;
 try{
  next=withObjectiveTurn(projected,allowed,session=>{
   if(task.type==="move")return moveSession(session,task.position);
   if(task.type==="command"&&typeof task.value==="string"&&/^[a-zA-Z]{1,32}$/.test(task.value))
    return command(session,task.value as CampaignAction);
   if(task.type==="optional"&&typeof task.value==="string"&&/^[a-zA-Z0-9_-]{1,64}$/.test(task.value))
    return optionalCommand(session,task.value);
   if(task.type==="world"&&validWorldAction(task.value))return worldAction(session,task.value);
   return session;
  });
 }catch{return s;}
 if(next===projected)return s;
 return {...next,position:s.position};
}

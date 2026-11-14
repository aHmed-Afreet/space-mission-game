import type {Position} from "../layout";
import type {Session} from "../campaign/engine";

/** Commander multiplayer is optional, and intentionally separate from local
 * progress saves. Room codes are invitation secrets, not player identities. */
export const CREW_LIMIT=4,ROOM_CODE_CHARS="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_APP_ID="space-mission-game.vercel.app/commander-coop-v1";
export type CrewRole="Commander"|"Engineer"|"Scientist"|"Communications";
export const CREW_ROLES:CrewRole[]=["Commander","Engineer","Scientist","Communications"];
export type RoomRole="host"|"guest";
export type RoomStatus="idle"|"connecting"|"waiting"|"connected"|"error";
export type CrewMember={id:string;name:string;role:CrewRole;position:Position|null;sessionId:string|null;isHost:boolean};
export type MissionPacket={session:Session|null;active:boolean;seq:number;sentAt:number};
export type CrewAction={type:"command"|"world"|"optional";value:unknown;position:Position;sessionId:string};
export function generateCrewCode(maxPlayers:2|3|4,cryptoSource:Pick<Crypto,"getRandomValues">=crypto):string{
 const data=new Uint8Array(9);cryptoSource.getRandomValues(data);
 return Array.from(data,n=>ROOM_CODE_CHARS[n%ROOM_CODE_CHARS.length]).join("")+"-"+maxPlayers;
}
export function normalizeCrewCode(raw:string):string{
 return raw.toUpperCase().replace(/[^A-Z0-9-]/g,"").slice(0,11);
}
export function roomCapacity(code:string):2|3|4|null{
 const found=code.match(/^[A-HJ-NP-Z2-9]{9}-([234])$/);
 return found?Number(found[1]) as 2|3|4:null;
}
export function validCrewPosition(value:unknown):value is Position{
 if(!value||typeof value!=="object")return false;
 const p=value as Record<string,unknown>;
 return ["x","z","heading"].every(key=>typeof p[key]==="number"&&Number.isFinite(p[key]))
   &&Math.abs(p.x as number)<=250&&Math.abs(p.z as number)<=250
   &&Math.abs(p.heading as number)<1000;
}
export function safeCrewLabel(index:number):string{return "CREW "+Math.max(1,Math.min(4,Math.trunc(index)));}
export function crewRole(index:number):CrewRole{return CREW_ROLES[Math.max(0,Math.min(index,3))];}
export function validMissionPacket(value:unknown):value is MissionPacket{
 if(!value||typeof value!=="object")return false;
 const p=value as Partial<MissionPacket>;
 return Number.isInteger(p.seq)&&Number(p.seq)>=0&&
  typeof p.active==="boolean"&&typeof p.sentAt==="number"&&Number.isFinite(p.sentAt)&&
  (p.session===null||(Boolean(p.session)&&typeof p.session?.id==="string"&&
   typeof p.session?.missionId==="string"&&
   typeof p.session?.objective==="number"&&validCrewPosition(p.session?.position)));
}
export function validCrewAction(value:unknown):value is CrewAction{
 if(!value||typeof value!=="object")return false;
 const a=value as Partial<CrewAction>;
 return ["command","world","optional"].includes(a.type??"") &&
  typeof a.sessionId==="string"&&a.sessionId.length<128&&validCrewPosition(a.position);
}
export function initialCrewPose(index:number,host:Position):Position{
 const offset=[[0,0],[.75,1.15],[-.75,1.15],[.65,2.0]][Math.max(0,Math.min(index,3))];
 return {x:host.x+offset[0],z:host.z+offset[1],heading:host.heading};
}

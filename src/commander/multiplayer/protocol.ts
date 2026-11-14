import type {Position} from "../layout";
import type {Session} from "../campaign/engine";

export const CREW_PROTOCOL=1 as const;
export const CREW_MAX_PLAYERS=4;
export const CREW_ROLES=["Commander","Engineer","Scientist","Communications"] as const;
export type CrewRole=(typeof CREW_ROLES)[number];
export type CrewPose=Position;
export type CrewMember={id:string;role:CrewRole;pose:CrewPose;missionId:string};
export type CrewStatus="connecting"|"connected"|"disconnected";
export type CrewRoomState={mode:"host"|"guest";code:string;myId:string;status:CrewStatus;members:CrewMember[]};
export type CrewAction={type:"command"|"world"|"optional"|"pause"|"rate"|"controls";value:unknown;position:CrewPose};
export type CrewViewMode="home"|"flight";
export type CrewPacket=
 |{v:1;t:"welcome";members:CrewMember[];session:Session|null;view:CrewViewMode}
 |{v:1;t:"roster";members:CrewMember[]}
 |{v:1;t:"pose";id:string;pose:CrewPose;missionId:string}
 |{v:1;t:"state";session:Session|null;view:CrewViewMode}
 |{v:1;t:"action";action:CrewAction}
 |{v:1;t:"error";message:string}
 |{v:1;t:"hello"};

const ALPHABET="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CREW_CODE_LENGTH=12;
export function generateCrewCode(random:(bytes:Uint8Array)=>Uint8Array=(bytes)=>{
 if(!globalThis.crypto?.getRandomValues)throw Error("Secure random codes require HTTPS.");
 return globalThis.crypto.getRandomValues(bytes);
}):string{
 const bytes=random(new Uint8Array(CREW_CODE_LENGTH));
 return Array.from(bytes,n=>ALPHABET[n%ALPHABET.length]).join("");
}
export function normalizeCrewCode(text:string):string|null{
 const code=text.toUpperCase().replace(/[\s-]/g,"");
 return code.length===CREW_CODE_LENGTH&&[...code].every(c=>ALPHABET.includes(c))?code:null;
}
export function crewPeerId(code:string):string{
 const valid=normalizeCrewCode(code);
 if(!valid)throw Error("Enter a valid 12-character crew code.");
 return "orbital-commander-"+valid.toLowerCase();
}
export function validatePose(value:unknown):CrewPose|null{
 if(!value||typeof value!=="object")return null;
 const p=value as Partial<CrewPose>;
 if(![p.x,p.z,p.heading].every(x=>typeof x==="number"&&Number.isFinite(x)))return null;
 if(Math.abs(p.x!)>300||Math.abs(p.z!)>300||Math.abs(p.heading!)>100000)return null;
 return {x:p.x!,z:p.z!,heading:p.heading!};
}
export function safeCrewAction(value:unknown):CrewAction|null{
 if(!value||typeof value!=="object")return null;
 const data=value as Partial<CrewAction>;
 if(!["command","world","optional","pause","rate","controls"].includes(data.type??""))return null;
 const position=validatePose(data.position);
 if(!position)return null;
 if(data.type==="command"||data.type==="optional"){
  if(typeof data.value!=="string"||data.value.length>60)return null;
 } else if(data.type==="world"){
  const x=data.value as Record<string,unknown>|null;
  if(!x||typeof x!=="object")return null;
  const withId=["door","locker","take","store","retrieveSample","switch","diagnose","repairFault","verifyFault"];
  const noParam=["returnMeal","takeParts","storeParts","storeSamples","stowSuit"];
  const withValue=["antenna","target","temperature"];
  if(withId.includes(String(x.kind))){
   if(typeof x.id!=="string"||x.id.length>80)return null;
  }else if(noParam.includes(String(x.kind))){/* no untrusted payload */}
  else if(withValue.includes(String(x.kind))){
   if(x.kind==="target"?!["earth","moon"].includes(String(x.value)):typeof x.value!=="number"||!Number.isFinite(x.value)||Math.abs(x.value)>1000)return null;
  }else return null;
 }else if(data.type==="pause"){
  if(typeof data.value!=="boolean")return null;
 }else if(data.type==="rate"){
  if(typeof data.value!=="number"||![1,5,20,100].includes(data.value))return null;
 }else if(data.type==="controls"){
  if(!Array.isArray(data.value)||data.value.length!==2||!data.value.every(x=>typeof x==="number"&&Number.isFinite(x)))return null;
  if(data.value[0]<0||data.value[0]>1||data.value[1]<0||data.value[1]>90)return null;
 }
 return {...data,position} as CrewAction;
}
export function isCrewSession(s:unknown):s is Session{
 if(!s||typeof s!=="object")return false;
 const x=s as Partial<Session>;
 return typeof x.id==="string"&&x.id.length<150&&typeof x.missionId==="string"&&
  typeof x.objective==="number"&&Number.isFinite(x.objective)&&
  Boolean(x.state&&typeof x.state==="object"&&x.world&&typeof x.world==="object")&&
  !!validatePose(x.position);
}
export function safeCrewPacket(x:unknown):CrewPacket|null{
 if(!x||typeof x!=="object")return null;
 const p=x as Partial<CrewPacket>;
 if(p.v!==CREW_PROTOCOL||typeof p.t!=="string")return null;
 if(p.t==="action")return safeCrewAction(p.action)?p as CrewPacket:null;
 if(p.t==="pose")return typeof p.id==="string"&&p.id.length<120&&Boolean(validatePose(p.pose))&&
  typeof p.missionId==="string"&&p.missionId.length<150?p as CrewPacket:null;
 if(p.t==="state")return (p.view==="home"||p.view==="flight")&&
  (p.session===null||isCrewSession(p.session))?p as CrewPacket:null;
 if(p.t==="welcome")return (p.view==="home"||p.view==="flight")&&
  (p.session===null||isCrewSession(p.session))&&Array.isArray(p.members)&&p.members.length<=CREW_MAX_PLAYERS?p as CrewPacket:null;
 if(p.t==="roster")return Array.isArray(p.members)&&p.members.length<=CREW_MAX_PLAYERS?p as CrewPacket:null;
 if(p.t==="error")return typeof p.message==="string"&&p.message.length<240?p as CrewPacket:null;
 return p.t==="hello"?p as CrewPacket:null;
}

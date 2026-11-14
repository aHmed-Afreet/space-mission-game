import type {Session} from "../campaign/engine";
import {CREW_MAX_PLAYERS,CREW_PROTOCOL,CREW_ROLES,crewPeerId,normalizeCrewCode,
 safeCrewPacket,safeCrewAction,validatePose,type CrewRoomState,type CrewMember,type CrewAction,
 type CrewPacket,type CrewPose,type CrewViewMode} from "./protocol";

/** Uses PeerJS cloud ONLY for anonymous WebRTC signaling. Game-state packets
 * travel over peer-to-peer RTCDataChannel. No accounts, chat or microphones.
 * This service is best-effort: restrictive NAT/firewalls may require TURN. */
const PEERJS_URL="https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js";
type Listener=(...args:any[])=>void;
interface PeerConnection{
 peer:string;open:boolean;on(name:string,listener:Listener):void;
 send(data:CrewPacket):void;close():void;
}
interface PeerClient{
 id:string;on(name:string,listener:Listener):void;
 connect(id:string,options?:{reliable?:boolean;serialization?:"json"}):PeerConnection;
 reconnect():void;destroy():void;
}
type PeerConstructor=new(id?:string)=>PeerClient;
declare global{interface Window{Peer?:PeerConstructor;peerjs?:{Peer?:PeerConstructor}}}
let loader:Promise<PeerConstructor>|null=null;
export function loadPeerJS():Promise<PeerConstructor>{
 if(typeof window==="undefined")return Promise.reject(Error("Multiplayer needs a browser."));
 if(window.Peer||window.peerjs?.Peer)return Promise.resolve((window.Peer??window.peerjs!.Peer)!);
 if(loader)return loader;
 loader=new Promise<PeerConstructor>((resolve,reject)=>{
  const el=document.createElement("script");
  el.src=PEERJS_URL;el.async=true;el.crossOrigin="anonymous";
  const timer=window.setTimeout(()=>{el.remove();reject(Error("Unable to load multiplayer networking. Check your internet connection."));},12000);
  el.onload=()=>{
   window.clearTimeout(timer);
   const ctor=window.Peer??window.peerjs?.Peer;
   if(ctor)resolve(ctor);
   else reject(Error("The multiplayer library did not initialize."));
  };
  el.onerror=()=>{window.clearTimeout(timer);reject(Error("Unable to load multiplayer networking. Try another network."));};
  document.head.appendChild(el);
 }).catch(e=>{loader=null;throw e;});
 return loader;
}

export type RoomCallbacks={
 onState:(state:CrewRoomState|null)=>void;
 onSession:(session:Session|null,view:CrewViewMode)=>void;
 onAction:(action:CrewAction,senderId:string)=>void;
 onLost:(message:string)=>void;
};
const emptyPosition:CrewPose={x:0,z:0,heading:0};
const userMessage=(error:unknown)=>{
 const message=error instanceof Error?error.message:String(error);
 return /peer-unavailable|Could not connect to peer|unavailable/i.test(message)
  ?"That crew room was not found or its host is offline. Check the code."
  :/network|server|socket|websocket|disconnected/i.test(message)
   ?"The connection was lost. Check your internet connection and try joining again."
   :"Unable to connect players: "+message.slice(0,140);
};
export class CommanderRoomNetwork{
 private peer:PeerClient|null=null;
 private connections=new Map<string,PeerConnection>();
 private members=new Map<string,CrewMember>();
 private state:CrewRoomState|null=null;
 private latestSession:Session|null=null;
 private latestView:CrewViewMode="home";
 private closed=false;
 private lastPoseSent=0;
 constructor(private readonly callbacks:RoomCallbacks){}
 get room(){return this.state;}
 private publish(){
  if(!this.state)return;
  this.state={...this.state,members:[...this.members.values()]};
  this.callbacks.onState(this.state);
 }
 private send(conn:PeerConnection,packet:CrewPacket){
  if(conn.open)try{conn.send(packet);}catch{/* retry when next state update arrives */}
 }
 private broadcast(packet:CrewPacket,omit?:string){
  for(const [id,conn] of this.connections)if(id!==omit)this.send(conn,packet);
 }
 private roster(){
  this.publish();
  if(this.state?.mode==="host")this.broadcast({v:CREW_PROTOCOL,t:"roster",members:this.state.members});
 }
 private removePeer(id:string){
  this.connections.delete(id);this.members.delete(id);this.roster();
 }
 async create(code:string,session:Session|null,view:CrewViewMode){
  const normalized=normalizeCrewCode(code);if(!normalized)throw Error("Invalid room code.");
  if(this.peer)throw Error("Leave your current crew before starting another.");
  this.closed=false;this.latestSession=session;this.latestView=view;
  const Peer=await loadPeerJS();
  if(this.closed)return;
  const peer=new Peer(crewPeerId(normalized));this.peer=peer;
  await new Promise<void>((resolve,reject)=>{
   const timeout=window.setTimeout(()=>reject(Error("Crew room creation timed out.")),17000);
   peer.on("open",()=>{window.clearTimeout(timeout);resolve();});
   peer.on("error",(err:unknown)=>{window.clearTimeout(timeout);reject(err);});
  }).catch(e=>{peer.destroy();this.peer=null;throw Error(userMessage(e));});
  if(this.closed){peer.destroy();return;}
  const id=peer.id;
  this.members.set(id,{id,role:"Commander",pose:session?.position??emptyPosition,missionId:session?.missionId??""});
  this.state={mode:"host",code:normalized,myId:id,status:"connected",members:[]};
  this.publish();
  peer.on("connection",(conn:PeerConnection)=>{
   if(this.closed){conn.close();return;}
   const id=conn.peer;
   conn.on("open",()=>{
    if(this.closed){conn.close();return;}
    if(this.members.size>=CREW_MAX_PLAYERS||this.connections.has(id)){
     this.send(conn,{v:CREW_PROTOCOL,t:"error",message:"This mission is full (maximum four astronauts)."});
     window.setTimeout(()=>conn.close(),300);
     return;
    }
    const role=CREW_ROLES[this.members.size];
    this.connections.set(id,conn);
    const host=this.members.get(peer.id);
    this.members.set(id,{id,role,pose:host?.pose??emptyPosition,missionId:this.latestSession?.missionId??""});
    this.roster();
    this.send(conn,{v:CREW_PROTOCOL,t:"welcome",members:[...this.members.values()],
      session:this.latestSession,view:this.latestView});
   });
   conn.on("data",(raw:unknown)=>{
    if(!this.connections.has(id))return;
    const packet=safeCrewPacket(raw);
    if(!packet)return;
    if(packet.t==="pose"){
     const pose=validatePose(packet.pose);if(!pose)return;
     const old=this.members.get(id);if(!old)return;
     this.members.set(id,{...old,pose,missionId:this.latestSession?.missionId??""});
     this.publish();
     this.broadcast({v:CREW_PROTOCOL,t:"pose",id,pose,missionId:this.latestSession?.missionId??""},id);
    }else if(packet.t==="action"){
     const action=safeCrewAction(packet.action);
     if(action&&this.latestSession)this.callbacks.onAction(action,id);
    }
   });
   conn.on("close",()=>this.removePeer(id));
   conn.on("error",()=>this.removePeer(id));
  });
  peer.on("disconnected",()=>{
   if(this.closed)return;
   this.callbacks.onLost("The signaling service disconnected. Existing players may remain linked, but new joins could fail.");
   try{peer.reconnect();}catch{/* User may retry hosting. */}
  });
 }
 async join(code:string){
  const normalized=normalizeCrewCode(code);if(!normalized)throw Error("Enter a valid 12-character crew code.");
  if(this.peer)throw Error("Leave your current crew before joining another.");
  this.closed=false;
  const Peer=await loadPeerJS();if(this.closed)return;
  const peer=new Peer();this.peer=peer;
  const waitForId=()=>new Promise<void>((resolve,reject)=>{
   const timer=window.setTimeout(()=>reject(Error("Connection service timed out.")),16000);
   peer.on("open",()=>{window.clearTimeout(timer);resolve();});
   peer.on("error",(e:unknown)=>{window.clearTimeout(timer);reject(e);});
  });
  try{await waitForId();}catch(e){peer.destroy();this.peer=null;throw Error(userMessage(e));}
  if(this.closed){peer.destroy();return;}
  const conn=peer.connect(crewPeerId(normalized),{reliable:true,serialization:"json"});
  await new Promise<void>((resolve,reject)=>{
   let welcomed=false;
   const timeout=window.setTimeout(()=>reject(Error("Could not connect to host. Check the code or network.")),20000);
   conn.on("data",(raw:unknown)=>{
    const packet=safeCrewPacket(raw);
    if(!packet)return;
    if(packet.t==="error"){window.clearTimeout(timeout);reject(Error(packet.message));return;}
    if(packet.t==="welcome"){
     welcomed=true;window.clearTimeout(timeout);
     this.connections.set(conn.peer,conn);
     this.members=new Map(packet.members.map(m=>[m.id,m]));
     this.state={mode:"guest",code:normalized,myId:peer.id,status:"connected",members:[]};
     this.publish();this.callbacks.onSession(packet.session,packet.view);
     resolve();return;
    }
    if(!welcomed||this.closed)return;
    if(packet.t==="roster"){
     this.members=new Map(packet.members.map(m=>[m.id,m]));
     this.publish();
    }else if(packet.t==="pose"){
     const current=this.members.get(packet.id);
     const pose=validatePose(packet.pose);
     if(current&&pose){
      this.members.set(packet.id,{...current,pose,missionId:packet.missionId});this.publish();
     }
    }else if(packet.t==="state")this.callbacks.onSession(packet.session,packet.view);
   });
   conn.on("open",()=>this.send(conn,{v:CREW_PROTOCOL,t:"hello"}));
   conn.on("error",(e:unknown)=>{if(!welcomed){window.clearTimeout(timeout);reject(Error(userMessage(e)));}});
   conn.on("close",()=>{
    if(!welcomed){window.clearTimeout(timeout);reject(Error("Host connection closed."));}
    else if(!this.closed){
     this.state=this.state?{...this.state,status:"disconnected"}:null;
     this.publish();
     this.callbacks.onLost("Host disconnected. Your personal saved campaign is unchanged. Leave and rejoin when the host returns.");
    }
   });
   peer.on("error",(e:unknown)=>{if(!welcomed){window.clearTimeout(timeout);reject(Error(userMessage(e)));}});
  }).catch(e=>{conn.close();peer.destroy();this.peer=null;throw e;});
 }
 publishSession(session:Session|null,view:CrewViewMode){
  if(this.state?.mode!=="host"||this.closed)return;
  this.latestSession=session;this.latestView=view;
  this.broadcast({v:CREW_PROTOCOL,t:"state",session,view});
 }
 publishPose(pose:CrewPose,missionId:string){
  if(this.closed||!this.state||!validatePose(pose))return;
  const now=performance.now();
  if(now-this.lastPoseSent<95)return;
  this.lastPoseSent=now;
  const id=this.state.myId,old=this.members.get(id);
  if(!old)return;
  this.members.set(id,{...old,pose,missionId});
  if(this.state.mode==="host"){
   this.publish();
   this.broadcast({v:CREW_PROTOCOL,t:"pose",id,pose,missionId});
  }else{
   const host=this.connections.values().next().value as PeerConnection|undefined;
   if(host)this.send(host,{v:CREW_PROTOCOL,t:"pose",id,pose,missionId});
  }
 }
 requestAction(action:CrewAction){
  if(this.state?.mode!=="guest"||!safeCrewAction(action))return;
  const host=this.connections.values().next().value as PeerConnection|undefined;
  if(host)this.send(host,{v:CREW_PROTOCOL,t:"action",action});
 }
 close(){
  this.closed=true;
  for(const conn of this.connections.values())try{conn.close();}catch{}
  this.connections.clear();this.members.clear();
  try{this.peer?.destroy();}catch{}
  this.peer=null;this.state=null;this.callbacks.onState(null);
 }
}

import type {Position} from "../layout";
import type {Session} from "../campaign/engine";
import {CREW_LIMIT,CREW_ROLES,ROOM_APP_ID,roomCapacity,safeCrewLabel,
 validCrewAction,validCrewPosition,validMissionPacket,type CrewAction,type CrewMember,
 type MissionPacket,type RoomRole} from "./protocol";

/** Browser-to-browser encrypted WebRTC, using redundant public Nostr discovery
 * relays. No personal account/chat and no server-side database. The host runs
 * the existing Commander simulation, guests share its mission snapshot.
 *
 * This is intentionally a lazy download only when ONLINE CO-OP is selected.
 * Bundling npm would require a regenerated package lock, and would load the
 * signaling library even for all single-player/Outpost/Planner users.
 * A deployment using a custom TURN service can replace this transport without
 * touching Commander mission mechanics.
 */
const SIGNAL_CLIENTS=[
 "https://esm.run/trystero@0.27.0",
 "https://esm.sh/trystero@0.27.0?bundle"
] as const;
type PeerContext={userId:string;peerId?:string};
type MessageAction<T>={
 send(data:T):void|Promise<unknown>;
 onMessage(handler:(value:T,peer:PeerContext)=>void):()=>void;
};
type P2PRoom={
 getSelf():Promise<{userId:string}>;
 makeAction<T>(name:string):MessageAction<T>;
 onUserJoin(handler:(peer:PeerContext)=>void,opts?:{replay:boolean}):()=>void;
 onUserLeave(handler:(peer:PeerContext)=>void):()=>void;
 onError(handler:(err:{code:string;message:string})=>void):()=>void;
 leave():void;
};
type ClientModule={joinRoom:(config:{appId:string;password:string;maxUsers:number;identity:string},roomId:string)=>P2PRoom};
async function loadClient():Promise<ClientModule>{
 let lastError:unknown;
 for(const endpoint of SIGNAL_CLIENTS){
  try{
   const module=await import(/* @vite-ignore */ endpoint) as unknown as ClientModule;
   if(typeof module.joinRoom==="function")return module;
  }catch(error){lastError=error;}
 }
 throw lastError??Error("Unable to load the encrypted WebRTC network library");
}
type Hello={type:"hello"|"host";hostId?:string;seats?:Array<{id:string;seat:number}>};
type Pose={position:Position;sessionId:string|null};
export type CommanderNetworkCallbacks={
 onRoster:(members:CrewMember[],selfSeat:number,hostId:string|null)=>void;
 onStatus:(message:string)=>void;
 onSnapshot:(snapshot:MissionPacket)=>void;
 onAction:(peerId:string,payload:CrewAction)=>void;
 onHostLost:()=>void;
};
export class CommanderNetwork{
 private room:P2PRoom|null=null;
 private id="";
 private hostId:string|null=null;
 private readonly connected=new Set<string>();
 private readonly seats=new Map<string,number>();
 private readonly poses=new Map<string,Pose>();
 private activeSessionId:string|null=null;
 private cachedSnapshot:MissionPacket={session:null,active:false,seq:0,sentAt:0};
 private lastReceivedSequence=-1;
 private notices:ReturnType<typeof setInterval>|null=null;
 private unsubscribers:Array<()=>void>=[];
 private stopped=false;
 private hello!:MessageAction<Hello>;
 private pose!:MessageAction<Pose>;
 private mission!:MessageAction<MissionPacket>;
 private action!:MessageAction<CrewAction>;
 private sendSafe<T>(action:MessageAction<T>,value:T):void{
  try{void Promise.resolve(action.send(value)).catch(()=>this.cb.onStatus("Network message not delivered; check other players' connection."));}
  catch{this.cb.onStatus("Peer connection interrupted. Try reconnecting.");}
 }
 constructor(
  readonly role:RoomRole,readonly code:string,readonly capacity:2|3|4,
  private readonly cb:CommanderNetworkCallbacks
 ){}
 get selfId(){return this.id;}
 get isHost(){return this.role==="host";}
 async connect():Promise<void>{
  if(roomCapacity(this.code)!==this.capacity)throw Error("Invalid multiplayer room code");
  const client=await loadClient();
  if(this.stopped)return;
  const room=client.joinRoom({
   appId:ROOM_APP_ID,password:this.code,maxUsers:this.capacity,identity:"none"
  },this.code);
  this.room=room;
  this.hello=room.makeAction<Hello>("crew-hi");
  this.pose=room.makeAction<Pose>("crew-pose");
  this.mission=room.makeAction<MissionPacket>("crew-state");
  this.action=room.makeAction<CrewAction>("crew-task");
  const self=await room.getSelf();
  if(this.stopped){room.leave();return;}
  this.id=self.userId;
  if(this.isHost){this.hostId=this.id;this.seats.set(this.id,0);}
  this.unsubscribers.push(
   room.onUserJoin(({userId})=>{
    if(userId===this.id)return;
    this.connected.add(userId);
    if(this.isHost){this.assignSeat(userId);this.sendRoster();this.publishCached();}
    else this.sendSafe(this.hello,{type:"hello"});
    this.notifyRoster();
   },{replay:true}),
   room.onUserLeave(({userId})=>{
    this.connected.delete(userId);this.poses.delete(userId);this.seats.delete(userId);
    if(this.role==="guest"&&this.hostId===userId){
      this.hostId=null;this.cb.onHostLost();
      this.cb.onStatus("Host disconnected. Shared flight has stopped; rejoin with a new room code.");
    }else if(this.isHost)this.sendRoster();
    this.notifyRoster();
   }),
   room.onError(err=>{
    this.cb.onStatus(err.code==="room-full"?
     "Room full — this mission already has its maximum number of players.":
     "Peer-to-peer connection problem: "+err.message);
   }),
   this.hello.onMessage((message,peer)=>{
    const id=peer.userId;
    if(!this.connected.has(id)&&id!==this.id)this.connected.add(id);
    if(this.isHost){
     if(message.type==="hello"||message.type==="host"){
      this.assignSeat(id);this.sendRoster();this.publishCached();this.notifyRoster();
     }
    }else if(message.type==="host"&&typeof message.hostId==="string"&&message.hostId===id){
     this.hostId=id;
     if(Array.isArray(message.seats)){
      this.seats.clear();
      for(const s of message.seats){
       if(s&&typeof s.id==="string"&&Number.isInteger(s.seat)&&s.seat>=0&&s.seat<this.capacity)
        this.seats.set(s.id,s.seat);
      }
     }
     this.cb.onStatus("Connected to Commander. Your team shares the host's active mission.");
     this.notifyRoster();
    }
   }),
   this.pose.onMessage((msg,peer)=>{
    if(!validCrewPosition(msg?.position)||typeof msg?.sessionId!=="string"&&msg?.sessionId!==null)return;
    if(peer.userId===this.id)return;
    this.poses.set(peer.userId,{position:msg.position,sessionId:msg.sessionId});
    this.notifyRoster();
   }),
   this.mission.onMessage((snapshot,peer)=>{
    if(this.isHost||!validMissionPacket(snapshot)||peer.userId!==this.hostId||
      snapshot.seq<=this.lastReceivedSequence)return;
    this.lastReceivedSequence=snapshot.seq;
    this.activeSessionId=snapshot.session?.id??null;
    this.cb.onSnapshot(snapshot);
   }),
   this.action.onMessage((req,peer)=>{
    if(!this.isHost||!this.seats.has(peer.userId)||peer.userId===this.id||!validCrewAction(req))return;
    this.cb.onAction(peer.userId,req);
   })
  );
  this.cb.onStatus(this.isHost?"Room created. Share the code; start any Commander mission.":"Searching for the room host over secure WebRTC…");
  if(this.isHost)this.sendRoster();
  else this.sendSafe(this.hello,{type:"hello"});
  this.notices=setInterval(()=>{
   if(this.stopped)return;
   if(this.isHost){this.sendRoster();this.publishCached();}
   else if(!this.hostId)this.sendSafe(this.hello,{type:"hello"});
  },3000);
  this.notifyRoster();
 }
 private assignSeat(id:string):void{
  if(this.seats.has(id))return;
  const taken=new Set(this.seats.values());
  for(let i=1;i<this.capacity;i++)if(!taken.has(i)){this.seats.set(id,i);break;}
 }
 private sendRoster():void{
  if(!this.isHost)return;
  this.sendSafe(this.hello,{type:"host",hostId:this.id,
   seats:[...this.seats.entries()].map(([id,seat])=>({id,seat}))});
 }
 private publishCached():void{
  if(this.isHost)this.sendSafe(this.mission,this.cachedSnapshot);
 }
 publishMission(session:Session|null,active:boolean):void{
  if(!this.isHost||!this.room)return;
  this.activeSessionId=session?.id??null;
  this.cachedSnapshot={session,active,seq:this.cachedSnapshot.seq+1,sentAt:Date.now()};
  this.publishCached();
  this.notifyRoster();
 }
 sendPose(position:Position,sessionId:string|null):void{
  if(!this.room||!validCrewPosition(position))return;
  this.poses.set(this.id,{position,sessionId});
  this.activeSessionId=sessionId;
  this.sendSafe(this.pose,{position,sessionId});
 }
 sendTask(value:CrewAction):void{
  if(this.role==="guest"&&this.hostId&&this.room&&validCrewAction(value))
   this.sendSafe(this.action,value);
 }
 private notifyRoster():void{
  const ids=[...this.seats.keys()];
  if(this.id&&!ids.includes(this.id))ids.push(this.id);
  const members=ids.filter(id=>id===this.id||this.connected.has(id))
   .slice(0,CREW_LIMIT).map(id=>{
    const seat=this.seats.get(id)??Math.min(ids.indexOf(id),3);
    const position=this.poses.get(id)??null;
    return {id,name:safeCrewLabel(seat+1),role:CREW_ROLES[seat],
     position:position?.position??null,sessionId:position?.sessionId??null,
     isHost:id===this.hostId} as CrewMember;
   }).sort((a,b)=>CREW_ROLES.indexOf(a.role)-CREW_ROLES.indexOf(b.role));
  this.cb.onRoster(members,Math.max(0,this.seats.get(this.id)??0),this.hostId);
 }
 leave():void{
  this.stopped=true;
  if(this.notices)clearInterval(this.notices);
  this.unsubscribers.forEach(unsub=>{try{unsub();}catch{/* Safe cleanup */}});
  this.unsubscribers=[];
  this.room?.leave();this.room=null;this.connected.clear();
 }
}

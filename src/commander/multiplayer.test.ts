import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {CREW_MAX_PLAYERS,CREW_ROLES,crewPeerId,generateCrewCode,normalizeCrewCode,
 safeCrewAction,safeCrewPacket,validatePose,type CrewPacket,type CrewRoomState} from "./multiplayer/protocol";
import {CommanderRoomNetwork} from "./multiplayer/network";
import type {Session} from "./campaign/engine";

type Listener=(...args:unknown[])=>void;
class Emitter{
 private events=new Map<string,Listener[]>();
 on(name:string,cb:Listener){const list=this.events.get(name)??[];list.push(cb);this.events.set(name,list);}
 fire(name:string,...args:unknown[]){for(const fn of this.events.get(name)??[])fn(...args);}
}
class FakeConnection extends Emitter{
 peer:string;open=false;other:FakeConnection|null=null;
 constructor(peer:string){super();this.peer=peer;}
 send(data:CrewPacket){if(!this.open||!this.other)return;const other=this.other;
  queueMicrotask(()=>other.fire("data",structuredClone(data)));
 }
 close(){
  if(!this.open)return;
  this.open=false;this.fire("close");
  if(this.other?.open){this.other.open=false;this.other.fire("close");}
 }
}
class FakePeer extends Emitter{
 static registry=new Map<string,FakePeer>();
 static number=0;
 id:string;
 constructor(id?:string){super();this.id=id??"anonymous-"+(++FakePeer.number);
  FakePeer.registry.set(this.id,this);
  queueMicrotask(()=>this.fire("open",this.id));
 }
 connect(target:string){
  const guest=new FakeConnection(target);
  const remote=FakePeer.registry.get(target);
  if(!remote){queueMicrotask(()=>this.fire("error",new Error("peer-unavailable")));return guest;}
  const host=new FakeConnection(this.id);
  guest.other=host;host.other=guest;
  queueMicrotask(()=>{
   remote.fire("connection",host);
   guest.open=true;host.open=true;
   host.fire("open");guest.fire("open");
  });
  return guest;
 }
 reconnect(){}
 destroy(){FakePeer.registry.delete(this.id);}
}
const tick=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
const sampleSession={
 id:"flight-crew-001",missionId:"mission-1",objective:0,position:{x:0,z:0,heading:0},
 state:{paused:false},world:{doors:{}}
} as unknown as Session;

test("room codes are secure-format, 12 characters and accept readable pasted groups",()=>{
 const code=generateCrewCode(bytes=>new Uint8Array(bytes.length).fill(0));
 assert.equal(code.length,12);
 assert.equal(code,"AAAAAAAAAAAA");
 assert.equal(normalizeCrewCode("aaaa aaaa aaaa"),code);
 assert.equal(crewPeerId(code),"orbital-commander-aaaaaaaaaaaa");
 assert.equal(normalizeCrewCode("AAAA"),null);
 assert.equal(normalizeCrewCode("000000000000"),null);
 assert.equal(CREW_MAX_PLAYERS,4);
});
test("incoming room payloads reject bogus positions and actions",()=>{
 assert.equal(validatePose({x:10000,z:0,heading:0}),null);
 assert.equal(validatePose({x:1,z:2,heading:Infinity}),null);
 assert.equal(safeCrewAction({type:"rate",value:42,position:{x:0,z:0,heading:0}}),null);
 assert.ok(safeCrewAction({type:"command",value:"repair",position:{x:0,z:0,heading:0}}));
 assert.ok(safeCrewAction({type:"world",value:{kind:"door",id:"engineering"},position:{x:0,z:0,heading:0}}));
 assert.ok(safeCrewAction({type:"world",value:{kind:"take",id:"oxygen"},position:{x:0,z:0,heading:0}}));
 assert.equal(safeCrewPacket({v:3,t:"hello"}),null);
 assert.ok(safeCrewPacket({v:1,t:"state",session:sampleSession,view:"flight"}));
 assert.equal(safeCrewPacket({v:1,t:"state",session:{id:"bad"},view:"flight"}),null);
});
test("true host/guest channel semantics: 1, 2, 3, 4 participants, movement, snapshots and cap",async()=>{
 const original=(globalThis as {window?:unknown}).window;
 (globalThis as {window?:unknown}).window={Peer:FakePeer,setTimeout,clearTimeout};
 FakePeer.registry.clear();
 const latest=new Map<string,CrewRoomState|null>();
 const sessions=new Map<string,string[]>();
 const receivedActions:string[]=[];
 const host=new CommanderRoomNetwork({
  onState:s=>{latest.set("captain",s);},
  onSession:()=>{},onAction:(a,id)=>receivedActions.push(a.type+":"+id),onLost:()=>{}
 });
 const code="ABCDEF234567";
 const guests:CommanderRoomNetwork[]=[];
 try{
  await host.create(code,null,"home");
  assert.equal(latest.get("captain")?.members.length,1);
  assert.equal(latest.get("captain")?.members[0].role,CREW_ROLES[0]);
  for(let number=1;number<=3;number++){
   const key="guest"+number;sessions.set(key,[]);
   const network=new CommanderRoomNetwork({
    onState:s=>latest.set(key,s),
    onSession:(s,v)=>sessions.get(key)!.push(v+":"+(s?.id??"none")),
    onAction:()=>{},onLost:()=>{}
   });
   guests.push(network);
   await network.join(code);
   await tick();
   assert.equal(latest.get("captain")?.members.length,number+1);
   assert.equal(latest.get(key)?.members.length,number+1);
   assert.equal(latest.get(key)?.mode,"guest");
   assert.equal(latest.get("captain")?.members[number].role,CREW_ROLES[number]);
  }
  host.publishSession(sampleSession,"flight");
  await tick();
  for(let n=1;n<=3;n++)assert.ok(sessions.get("guest"+n)?.includes("flight:flight-crew-001"));
  const id=latest.get("guest1")!.myId;
  guests[0].publishPose({x:3,z:1,heading:.4},"mission-1");
  await tick();
  assert.equal(latest.get("captain")?.members.find(m=>m.id===id)?.pose.x,3);
  assert.equal(latest.get("guest2")?.members.find(m=>m.id===id)?.pose.x,3);
  guests[0].requestAction({type:"command",value:"repair",position:{x:3,z:1,heading:.4}});
  await tick();
  assert.ok(receivedActions.includes("command:"+id));
  const extra=new CommanderRoomNetwork({onState:()=>{},onSession:()=>{},onAction:()=>{},onLost:()=>{}});
  await assert.rejects(()=>extra.join(code),/full/i);
  extra.close();
 }finally{for(const guest of guests)guest.close();host.close();(globalThis as {window?:unknown}).window=original;}
});
test("Commander co-op uses independent guest camera, protected saves and real 3D player suits",()=>{
 const commander=readFileSync("src/commander/Commander.tsx","utf8");
 const flight=readFileSync("src/commander/campaign/Flight.tsx","utf8");
 const cabin=readFileSync("src/commander/Cabin.tsx","utf8");
 const actors=readFileSync("src/commander/multiplayer/crewAvatars.ts","utf8");
 const panel=readFileSync("src/commander/multiplayer/CrewPanel.tsx","utf8");
 assert.match(commander,/if \(isGuest\.current \|\| loaded\.readOnly\) return/);
 assert.match(commander,/onRemoteCrewAction/);
 assert.match(commander,/savedBeforeJoin\.current/);
 assert.match(commander,/session=\{crewRoom\?\.mode==="guest"&&guestPosition/);
 assert.match(commander,/onCrewWorld/);
 assert.match(flight,/crewMembers=\{crewMembers\}/);
 assert.match(cabin,/onlineCrew\.update\(/);
 assert.match(actors,/T\.CapsuleGeometry/);
 assert.match(actors,/missionId!==missionId/);
 assert.match(panel,/CREATE PRIVATE ROOM/);
 assert.match(panel,/JOIN CREW ONLINE/);
 assert.match(panel,/COPY CODE/);
});

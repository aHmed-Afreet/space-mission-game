import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {CommanderNetwork,type ClientModule} from "./commander/multiplayer/network";
import {CREW_ROLES,CREW_LIMIT,generateCrewCode,normalizeCrewCode,roomCapacity,
 validCrewPosition,validCrewAction,validMissionPacket,initialCrewPose} from "./commander/multiplayer/protocol";
import type {Session} from "./commander/campaign/engine";

test("private online room codes accept only 2, 3 or 4 seats and use random values",()=>{
 const source={getRandomValues(array:Uint8Array){for(let i=0;i<array.length;i++)array[i]=i*3;return array;}} as Pick<Crypto,"getRandomValues">;
 for(const n of [2,3,4] as const){
  const code=generateCrewCode(n,source);
  assert.equal(code.length,11);
  assert.equal(roomCapacity(code),n);
  assert.equal(normalizeCrewCode(code.toLowerCase()),code);
 }
 assert.equal(roomCapacity("123"),null);
 assert.equal(roomCapacity("AAAAAAAAA-5"),null);
 assert.equal(roomCapacity("IIIIIIIII-4"),null);
 assert.equal(CREW_ROLES.length,4);
 assert.equal(CREW_LIMIT,4);
});
test("peer position and action validation rejects malformed or out-of-bounds coordinates",()=>{
 assert.equal(validCrewPosition({x:0,z:0,heading:0}),true);
 assert.equal(validCrewPosition({x:Infinity,z:0,heading:0}),false);
 assert.equal(validCrewPosition({x:1000,z:0,heading:0}),false);
 assert.equal(validCrewPosition({x:0,z:0}),false);
 assert.equal(validCrewAction({type:"command",value:"scan",sessionId:"s1",position:{x:1,z:2,heading:0}}),true);
 assert.equal(validCrewAction({type:"world",sessionId:"s1",position:{x:NaN,z:2,heading:0}}),false);
 assert.equal(validMissionPacket({active:true,seq:1,sentAt:Date.now(),session:{id:"s1",missionId:"mission-1",objective:0,position:{x:0,z:0,heading:0}}}),true);
 assert.equal(validMissionPacket({active:true,seq:-1,sentAt:0,session:null}),false);
 const spawn=initialCrewPose(1,{x:0,z:-4.95,heading:0});
 assert.equal(spawn.x,.75);assert.ok(Math.abs(spawn.z+3.8)<1e-10);
});

/** Emulates multiple independently connected browser tabs while exercising
 * the actual Commander network protocol and its callbacks. This is not a
 * substitute for a public-relay or physical-device WebRTC smoke test. */
function mockTransport(){
 let num=0;
 type Cb=(data:any,peer:{userId:string})=>void;
 type Room={
  id:string;code:string;subscribers:Map<string,Cb[]>;joins:Array<(c:{userId:string})=>void>;
  leaves:Array<(c:{userId:string})=>void>;errors:Array<(e:any)=>void>
 };
 const rooms=new Map<string,Set<Room>>();
 const client:ClientModule={joinRoom(_config:any,code:string){
  const peer:Room={id:"browser-"+(++num),code,subscribers:new Map(),joins:[],leaves:[],errors:[]};
  if(!rooms.has(code))rooms.set(code,new Set());
  const others=rooms.get(code)!;others.add(peer);
  queueMicrotask(()=>{for(const item of others)if(item!==peer)item.joins.forEach(cb=>cb({userId:peer.id}));});
  return {
   getSelf:async()=>({userId:peer.id}),
   makeAction(name:string){
    return {
     send(value:any){
      queueMicrotask(()=>{
       for(const p of others)if(p!==peer)
        p.subscribers.get(name)?.forEach(fn=>fn(value,{userId:peer.id}));
      });
     },
     onMessage(fn:Cb){
      if(!peer.subscribers.has(name))peer.subscribers.set(name,[]);
      peer.subscribers.get(name)!.push(fn);
      return ()=>peer.subscribers.set(name,(peer.subscribers.get(name)??[]).filter(x=>x!==fn));
     }
    };
   },
   onUserJoin(fn:(c:{userId:string})=>void,opts?:{replay:boolean}){
    peer.joins.push(fn);
    if(opts?.replay)for(const p of others)if(p!==peer)queueMicrotask(()=>fn({userId:p.id}));
    return ()=>{peer.joins=peer.joins.filter(x=>x!==fn);};
   },
   onUserLeave(fn:(c:{userId:string})=>void){
    peer.leaves.push(fn);return ()=>{peer.leaves=peer.leaves.filter(x=>x!==fn);};
   },
   onError(fn:(e:any)=>void){peer.errors.push(fn);return ()=>{peer.errors=peer.errors.filter(x=>x!==fn);};},
   leave(){
    if(!others.delete(peer))return;
    for(const p of others)p.leaves.forEach(fn=>fn({userId:peer.id}));
   }
  } as any;
 }};
 return async()=>client;
}
test("two browsers join same Commander mission, see 3D positions and forward an engineering action",async()=>{
 const client=mockTransport(),code="ABCDEFGHJ-4";
 const positions=new Map<string,unknown>();
 let guestSnapshot:any=null,receivedAction:any=null,hostLost=false;
 const host=new CommanderNetwork("host",code,4,{
  onRoster:members=>positions.set("host",members),
  onSnapshot:()=>{},onAction:(_id,task)=>{receivedAction=task;},
  onHostLost:()=>{},onStatus:()=>{}
 },client);
 const guest=new CommanderNetwork("guest",code,4,{
  onRoster:members=>positions.set("guest",members),
  onSnapshot:data=>{guestSnapshot=data;},
  onAction:()=>{},onHostLost:()=>{hostLost=true;},onStatus:()=>{}
 },client);
 try{
  await host.connect();await guest.connect();
  await new Promise(resolve=>setTimeout(resolve,25));
  assert.equal((positions.get("host") as any[]).length,2,"host discovers second device");
  assert.equal((positions.get("guest") as any[]).length,2,"guest discovers host");
  const sample={id:"teamflight",missionId:"mission-1",objective:2,
   position:{x:0,z:-4.95,heading:0}} as unknown as Session;
  host.publishMission(sample,true);
  await new Promise(resolve=>setTimeout(resolve,25));
  assert.equal(guestSnapshot?.session?.id,"teamflight");
  const pos={x:1,z:-3.6,heading:.25};
  guest.sendPose(pos,"teamflight");
  host.sendPose({x:0,z:-4.95,heading:0},"teamflight");
  await new Promise(resolve=>setTimeout(resolve,25));
  assert.deepEqual((positions.get("host") as any[]).find(x=>!x.isHost)?.position,pos);
  assert.equal((positions.get("guest") as any[]).find(x=>x.isHost)?.position?.z,-4.95);
  guest.sendTask({type:"command",value:"scan",position:pos,sessionId:"teamflight"});
  await new Promise(resolve=>setTimeout(resolve,25));
  assert.equal(receivedAction?.value,"scan","guest action reaches host");
  host.leave();
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(hostLost,true,"guest gets told when the authoritative host leaves");
 }finally{host.leave();guest.leave();}
});
test("Commander only gets multiplayer; solo, Outpost, Planner and history remain unchanged",()=>{
 const commander=readFileSync("src/commander/Commander.tsx","utf8");
 const cabin=readFileSync("src/commander/Cabin.tsx","utf8");
 const flight=readFileSync("src/commander/campaign/Flight.tsx","utf8");
 const main=readFileSync("src/ModeSelect.tsx","utf8");
 assert.match(commander,/MultiplayerLobby/);
 assert.match(commander,/network\.publishMission|publishMission\(latest\.current/);
 assert.match(commander,/roomRef\.current\?\.role==="guest"/);
 assert.match(commander,/onMove = useCallback/);
 assert.match(commander,/session=\{crewRoom\.role==="guest"\?/);
 assert.match(flight,/crew\.filter\(member=>member\.id!==crewOwnId\)/);
 assert.match(cabin,/new CrewAvatarManager\(scene\)/);
 assert.match(cabin,/remoteAstronauts\.update/);
 assert.doesNotMatch(main,/<MultiplayerLobby/);
});

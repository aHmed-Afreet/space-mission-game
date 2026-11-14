import * as T from "three";
import type {CrewRole,CrewMember} from "./protocol";
import {terrainRelief} from "../campaign/surfaceScenery";

/** Low draw-call astronauts visible to other players in the same Commander
 * mission, including orbital cabins and EVA surfaces. No asset downloads. */
const ROLE_COLORS:Record<CrewRole,number>={
 Commander:0xe0e8ed,Engineer:0x98b8dd,Scientist:0xb5d1aa,Communications:0xe2ba89
};
export class CrewAvatarField{
 private avatars=new Map<string,{group:T.Group;left:T.Group;right:T.Group}>();
 private meshes=new Set<T.BufferGeometry>();
 private materials=new Set<T.Material>();
 constructor(private readonly scene:T.Scene){}
 private material(color:number,metalness=0.1):T.MeshStandardMaterial{
  const m=new T.MeshStandardMaterial({color,roughness:.67,metalness});
  this.materials.add(m);return m;
 }
 private mesh(parent:T.Group,geometry:T.BufferGeometry,finish:T.Material,x:number,y:number,z:number){
  this.meshes.add(geometry);
  const m=new T.Mesh(geometry,finish);
  m.position.set(x,y,z);m.castShadow=false;m.receiveShadow=true;parent.add(m);
  return m;
 }
 private create(id:string,role:CrewRole){
  const group=new T.Group();group.name="Online astronaut "+role;this.scene.add(group);
  const suit=this.material(ROLE_COLORS[role]),dark=this.material(0x313c4b),
   visor=this.material(0x5a92aa,.65),stripe=this.material(0xd1a866);
  this.mesh(group,new T.CapsuleGeometry(.3,.54,3,8),suit,0,1.05,0);
  this.mesh(group,new T.BoxGeometry(.58,.49,.26),suit,0,1.08,.23);
  this.mesh(group,new T.BoxGeometry(.52,.56,.21),dark,0,1.10,-.31);
  this.mesh(group,new T.SphereGeometry(.285,12,9),suit,0,1.72,0);
  this.mesh(group,new T.SphereGeometry(.235,12,8),visor,0,1.72,.135);
  this.mesh(group,new T.BoxGeometry(.53,.055,.10),stripe,0,1.35,.29);
  const left=new T.Group(),right=new T.Group();
  group.add(left,right);left.position.set(-.39,1.25,0);right.position.set(.39,1.25,0);
  this.mesh(left,new T.CapsuleGeometry(.105,.40,2,7),suit,0,-.26,0);
  this.mesh(right,new T.CapsuleGeometry(.105,.40,2,7),suit,0,-.26,0);
  for(const x of [-.18,.18]){
   this.mesh(group,new T.CapsuleGeometry(.13,.43,2,7),suit,x,.45,0);
   this.mesh(group,new T.BoxGeometry(.25,.14,.36),dark,x,.13,.07);
  }
  // Suit colors represent roles; no usernames or identity data are rendered.
  this.avatars.set(id,{group,left,right});
 }
 update(members:readonly CrewMember[],mine:string|undefined,missionId:string|undefined,time:number){
  const valid=new Set<string>();
  for(const member of members){
   if(member.id===mine||!missionId||member.missionId!==missionId)continue;
   valid.add(member.id);
   if(!this.avatars.has(member.id))this.create(member.id,member.role);
   const avatar=this.avatars.get(member.id)!;
   const p=member.pose;
   if(![p.x,p.z,p.heading].every(Number.isFinite))continue;
   const y=p.z>10.4?terrainRelief(p.x,p.z):0;
   const destination=new T.Vector3(p.x,y,p.z);
   const distance=avatar.group.position.distanceTo(destination);
   if(distance>25)avatar.group.position.copy(destination);
   else avatar.group.position.lerp(destination,.23);
   avatar.group.rotation.y=p.heading;
   const gait=Math.sin(time*.008)*Math.min(1,distance/.15)*.17;
   avatar.left.rotation.x=gait;avatar.right.rotation.x=-gait;
  }
  for(const [id,actor] of this.avatars){
   if(valid.has(id))continue;
   this.scene.remove(actor.group);this.avatars.delete(id);
  }
 }
 dispose(){
  for(const a of this.avatars.values())this.scene.remove(a.group);
  this.avatars.clear();
  for(const g of this.meshes)g.dispose();
  for(const m of this.materials)m.dispose();
 }
}

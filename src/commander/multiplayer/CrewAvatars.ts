import * as THREE from "three";
import type {CrewMember} from "./protocol";

const ROLE_COLORS:Record<CrewMember["role"],number>={
 Commander:0x86e9c9,Engineer:0xf6c778,Scientist:0x8cbffc,Communications:0xdc9af0
};
type Avatar={group:THREE.Group;materials:THREE.Material[];geometries:THREE.BufferGeometry[];
 texture:THREE.Texture;target:THREE.Vector3;heading:number};
function astronaut(peer:CrewMember):Avatar{
 const group=new THREE.Group(),materials:THREE.Material[]=[],geometries:THREE.BufferGeometry[]=[];
 const suit=new THREE.MeshStandardMaterial({color:0xe3e5e5,roughness:.62,metalness:.15});
 const trim=new THREE.MeshStandardMaterial({color:ROLE_COLORS[peer.role],roughness:.32,metalness:.3});
 const dark=new THREE.MeshStandardMaterial({color:0x263e51,roughness:.35,metalness:.65});
 const glass=new THREE.MeshPhysicalMaterial({color:0x89b5ca,metalness:.5,roughness:.17,
  transparent:true,opacity:.82});
 materials.push(suit,trim,dark,glass);
 const box=(w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.Material)=>{
  const geo=new THREE.BoxGeometry(w,h,d),obj=new THREE.Mesh(geo,mat);
  geometries.push(geo);obj.position.set(x,y,z);group.add(obj);return obj;
 };
 box(.48,.55,.25,0,1.04,0,suit);
 box(.40,.35,.24,0,1.31,.065,trim);
 box(.31,.39,.22,0,1.02,.29,dark); // life support pack
 for(const s of [-1,1]){
  box(.22,.53,.23,s*.36,1.07,0,suit); // arm
  box(.23,.19,.25,s*.36,.76,-.02,trim); // glove
  box(.23,.58,.25,s*.15,.48,0,suit); // leg
  box(.26,.17,.39,s*.15,.13,-.065,dark); // boot
 }
 const helmetGeo=new THREE.SphereGeometry(.30,14,10),helmet=new THREE.Mesh(helmetGeo,suit);
 helmet.position.set(0,1.63,0);group.add(helmet);geometries.push(helmetGeo);
 const visorGeo=new THREE.SphereGeometry(.242,14,10,0,Math.PI),visor=new THREE.Mesh(visorGeo,glass);
 visor.rotation.y=Math.PI;visor.scale.set(.89,.78,.52);visor.position.set(0,1.63,-.18);
 group.add(visor);geometries.push(visorGeo);
 box(.24,.12,.08,0,1.12,-.14,trim); // role identifier
 const canvas=document.createElement("canvas");canvas.width=256;canvas.height=68;
 const ctx=canvas.getContext("2d");
 if(ctx){
  ctx.fillStyle="rgba(6,32,43,.9)";ctx.fillRect(0,0,256,68);
  ctx.strokeStyle="#bbf9d5";ctx.lineWidth=3;ctx.strokeRect(2,2,252,64);
  ctx.font="bold 24px system-ui, sans-serif";ctx.fillStyle="#e4fff0";
  ctx.textAlign="center";ctx.fillText(peer.role.toUpperCase(),128,44);
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const labelMat=new THREE.SpriteMaterial({map:texture,depthTest:false,transparent:true});
 materials.push(labelMat);
 const tag=new THREE.Sprite(labelMat);tag.position.set(0,2.15,0);tag.scale.set(1.25,.33,1);
 group.add(tag);group.visible=false;
 return {group,materials,geometries,texture,target:new THREE.Vector3(),heading:0};
}
/** Draw each other browser's independently walking astronaut in the same cabin
 * or on the same EVA world, without duplicating the local player's camera. */
export class CrewAvatarManager{
 private actors=new Map<string,Avatar>();
 constructor(private readonly scene:THREE.Scene){}
 update(peers:readonly CrewMember[],sessionId:string|null,delta=1/60):void{
  const visible=new Set<string>();
  for(const peer of peers){
   if(!peer.position||peer.sessionId!==sessionId)continue;
   visible.add(peer.id);
   let item=this.actors.get(peer.id);
   if(!item){
    item=astronaut(peer);
    this.scene.add(item.group);this.actors.set(peer.id,item);
    item.group.position.set(peer.position.x,0,peer.position.z);
   }
   item.group.visible=true;
   item.target.set(peer.position.x,0,peer.position.z);
   item.heading=peer.position.heading;
   const alpha=1-Math.exp(-12*Math.min(delta,.1));
   item.group.position.lerp(item.target,alpha);
   item.group.rotation.y+=Math.atan2(Math.sin(item.heading-item.group.rotation.y),
    Math.cos(item.heading-item.group.rotation.y))*alpha;
  }
  for(const [id,item] of this.actors)if(!visible.has(id))item.group.visible=false;
 }
 get visibleCount():number{return [...this.actors.values()].filter(a=>a.group.visible).length;}
 dispose():void{
  for(const item of this.actors.values()){
   this.scene.remove(item.group);
   item.geometries.forEach(g=>g.dispose());item.materials.forEach(m=>m.dispose());
   item.texture.dispose();
  }
  this.actors.clear();
 }
}

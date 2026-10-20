import * as THREE from "three";
import type {StoryScenario} from "./storyScenarios";

/** Low-poly, vehicle-specific silhouettes based on recorded mission hardware.
 * These are educational replicas, not dimensionally accurate spacecraft models. */
const mat=(color:number,metalness=.52)=>new THREE.MeshStandardMaterial({color,metalness,roughness:.46});
function add(g:THREE.Group,geo:THREE.BufferGeometry,m:THREE.Material,x=0,y=0,z=0){
 const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);g.add(o);return o;
}
const block=(g:THREE.Group,x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material)=>
 add(g,new THREE.BoxGeometry(w,h,d),m,x,y,z);
const cylinder=(g:THREE.Group,x:number,y:number,z:number,rt:number,rb:number,h:number,m:THREE.Material,sides=16)=>
 add(g,new THREE.CylinderGeometry(rt,rb,h,sides),m,x,y,z);
function tube(g:THREE.Group,a:[number,number,number],b:[number,number,number],r:number,m:THREE.Material){
 const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),v=end.clone().sub(start);
 const o=cylinder(g,...(start.clone().add(end).multiplyScalar(.5).toArray() as [number,number,number]),r,r,v.length(),m,10);
 o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return o;
}
function antenna(g:THREE.Group,y=1.35){tube(g,[0,.4,0],[0,y,0],.035,metal);add(g,new THREE.SphereGeometry(.11,12,8),gold,0,y,0);}
const metal=mat(0xb3b8b3,.79),white=mat(0xe5e2d8,.24),gold=mat(0xcaa052,.66),dark=mat(0x1d303b,.32),solar=mat(0x214879,.25),glass=mat(0x2b6f8d,.16);
function wing(g:THREE.Group,sign:number,dist=2.1,length=3.4,z=0){
 tube(g,[sign*.65,0,z],[sign*dist,0,z],.055,metal);
 block(g,sign*(dist+length/2),0,z,length,.08,1.25,solar);
 for(let i=0;i<4;i++)block(g,sign*(dist+.25+i*(length-.5)/3),.053,z,.026,.013,1.22,metal);
}
function dish(g:THREE.Group,x=0,y=1,z=0,r=1){
 const p=cylinder(g,x,y,z,r,r*.18,.18,white,28);p.rotation.x=Math.PI/2;
 const rim=new THREE.Mesh(new THREE.TorusGeometry(r,.036,8,36),metal);
 rim.position.set(x,y,z-.14);g.add(rim);
 tube(g,[x,y,z],[x,y,z-1],.04,metal);
}
function capsule(g:THREE.Group,variant:"mercury"|"gemini"|"apollo"|"vostok"|"orion"){
 if(variant==="vostok"){
  add(g,new THREE.SphereGeometry(1.3,22,14),white,0,.25,0);
  cylinder(g,0,-1.43,0,.97,.99,1.25,metal);
  block(g,0,.48,-1.21,.55,.36,.07,glass);
  antenna(g,2.1);return;
 }
 const h=variant==="mercury"?1.8:variant==="gemini"?2.2:2.15;
 cylinder(g,0,.3,0,.54,1.24,h,white);
 cylinder(g,0,.3+h*.5,0,.04,.52,.72,metal);
 cylinder(g,0,-h*.5+.27,0,1.2,1.2,.17,gold);
 for(let i=0;i<(variant==="mercury"?1:variant==="gemini"?2:3);i++)
  block(g,(i-1)*.47,.95,-.85,.31,.25,.06,glass);
 if(variant==="apollo"||variant==="orion"){
  cylinder(g,0,-1.57,0,1.13,1.13,1.85,metal);
  cylinder(g,0,-2.53,0,.54,.73,.35,dark);
  if(variant==="orion")for(let i=0;i<4;i++){
   const a=i*Math.PI/2,arm=new THREE.Group();arm.rotation.y=a;g.add(arm);
   block(arm,0,-1.4,-2.45,1.15,.06,2.65,solar);
   tube(arm,[0,-1.4,-.7],[0,-1.4,-1.7],.045,metal);
  }
 }
}
function lander(g:THREE.Group,variant:"apollo"|"luna9"|"luna16"|"viking"|"generic"){
 if(variant==="luna9"){
  add(g,new THREE.SphereGeometry(.85,18,12),white,0,.36,0);
  for(let k=0;k<4;k++){
   const a=k*Math.PI/2,petal=block(g,Math.cos(a)*1.2,-.14,Math.sin(a)*1.2,.95,.1,.75,gold);
   petal.rotation.y=a;
  }
  antenna(g,1.92);return;
 }
 const legCount=variant==="viking"?3:4;
 cylinder(g,0,-.68,0,1.35,1.35,1,gold,8);
 if(variant==="apollo"){
  cylinder(g,0,.56,0,1.08,.9,1.45,white,8);
  for(const x of [-.56,.56]){const v=block(g,x,.89,-.88,.35,.3,.07,glass);v.rotation.z=x*.45;}
  block(g,0,.2,-1.1,.48,.56,.07,dark);
  for(let i=0;i<6;i++)block(g,1.05,-1.15+i*.19,-1.19,.065,.044,.6,metal);
 }else if(variant==="luna16"){
  cylinder(g,0,.62,0,.75,.75,1.65,white);
  cylinder(g,0,1.72,0,.28,.48,1,metal);
  antenna(g,2.4);
 }else{
  block(g,0,.3,0,1.3,1.1,1.25,white);
  dish(g,.1,1.25,.2,.44);
 }
 for(let i=0;i<legCount;i++){
  const a=i*Math.PI*2/legCount+.35,x=Math.cos(a)*2.2,z=Math.sin(a)*2.2;
  tube(g,[Math.cos(a)*1,-.6,Math.sin(a)], [x,-2,z],.08,metal);
  cylinder(g,x,-2,z,.45,.45,.08,gold);
 }
}
function rover(g:THREE.Group,mini=false){
 block(g,0,.2,0,mini?1.6:2.7,.48,mini?1.15:1.6,white);
 block(g,0,.58,0,mini?1.15:2.1,.13,mini?1.05:1.4,gold);
 for(const x of [-1,1])for(const z of [-.8,0,.8]){
  const wx=x*(mini?.77:1.35),wz=z*(mini?.63:1);
  const w=cylinder(g,wx,-.53,wz,mini?.21:.33,mini?.21:.33,.18,dark);
  w.rotation.z=Math.PI/2;
  tube(g,[x*.62,0,z*.55],[wx,-.53,wz],.055,metal);
 }
 tube(g,[.45,.68,-.12],[.7,1.85,-.4],.06,metal);
 block(g,.7,1.86,-.45,.75,.35,.14,glass);
 dish(g,-.45,1.17,.15,.32);
}
function helicopter(g:THREE.Group){
 block(g,0,-.18,0,1.2,.5,.75,white);
 block(g,0,.12,0,1,.07,.75,solar);
 for(const x of [-1,1])for(const z of [-1,1])
 tube(g,[x*.34,-.38,z*.25],[x*1.05,-1.3,z*.68],.034,metal);
 tube(g,[0,.15,0],[0,1.7,0],.045,metal);
 const a=block(g,0,1.28,0,3.7,.035,.14,dark);a.rotation.y=.25;
 const b=block(g,0,1.58,0,3.7,.035,.14,white);b.rotation.y=-.3;
}
function station(g:THREE.Group,title:string){
 const iss=/ISS/.test(title),mir=/Mir/.test(title),skylab=/Skylab/.test(title),salyut=/Salyut/.test(title);
 const size=skylab?4.5:iss?5.7:mir?4.8:3.8;
 const body=cylinder(g,0,0,0,.8,.8,size,white);body.rotation.x=Math.PI/2;
 for(const z of [-size/3,0,size/3]){
 const ring=cylinder(g,0,0,z,.92,.92,.22,metal);ring.rotation.x=Math.PI/2;
 }
 if(mir)for(let k=0;k<4;k++){
  const a=k*Math.PI/2,arm=new THREE.Group();arm.rotation.z=a;g.add(arm);
  const module=cylinder(arm,0,2,0,.55,.55,2.5,white);
  module.rotation.x=0;
 }
 for(const side of [-1,1])for(let k=0;k<(iss?4:2);k++)
  block(g,side*(2+k*1.1),.15,0,1.02,2.15,.06,solar);
 if(iss){tube(g,[-6,0,0],[6,0,0],.13,metal);
   for(const z of [-1.15,1.15]){const mod=cylinder(g,0,0,z,.67,.67,2.2,white);mod.rotation.x=Math.PI/2;}}
 dish(g,0,1.15,-1.5,.44);
}
function shuttle(g:THREE.Group){
 const fuselage=cylinder(g,0,0,0,.67,.74,5.5,white);fuselage.rotation.x=Math.PI/2;
 const nose=cylinder(g,0,.08,-3.2,.08,.7,1.3,white);nose.rotation.x=Math.PI/2;
 const wing=add(g,new THREE.ConeGeometry(4.2,.15,3),white,0,-.35,.3);
 wing.rotation.x=Math.PI/2;wing.rotation.y=Math.PI/2;wing.scale.z=.6;
 block(g,0,.98,2,.25,1.9,.72,white);
 for(const x of [-.45,.45]){
 const engine=cylinder(g,x,-.3,2.9,.25,.43,.93,dark);engine.rotation.x=Math.PI/2;
 }
 block(g,0,.45,-2.02,1,.36,.08,glass);
}
function telescope(g:THREE.Group,title:string){
 if(/Webb/.test(title)){
  // Eighteen iconic gold primary segments, simplified sunshield layers and boom.
  for(let l=0;l<4;l++){
   const shield=block(g,0,-1.45-l*.13,0,5.1,.04,2.7,white);
   shield.rotation.y=l%2?.05:-.05;
  }
  const rows=[3,4,5,4,2];let c=0;
  for(let r=0;r<rows.length;r++)for(let k=0;k<rows[r];k++){
   const n=rows[r],x=(k-(n-1)/2)*.73,y=(2-r)*.64;
   const hex=cylinder(g,x,y+.7,.02,.41,.41,.08,gold,6);hex.rotation.x=Math.PI/2;
   c++;
  }
  tube(g,[0,-1.4,0],[0,-.4,0],.08,metal);
  return;
 }
 const body=cylinder(g,0,0,0,1.02,1.02,3.6,metal);body.rotation.x=Math.PI/2;
 const aperture=cylinder(g,0,0,-1.82,1.12,1.12,.28,dark);aperture.rotation.x=Math.PI/2;
 for(const sign of [-1,1])wing(g,sign,1.9,2.5);
}
function probe(g:THREE.Group,title:string){
 if(title==="Explorer 1"){
  cylinder(g,0,0,0,.2,.22,3.35,white);
  for(const y of [-1.1,.2,1.2])cylinder(g,0,y,0,.28,.28,.11,metal);
  antenna(g,2.2);return;
 }
 if(title==="Luna 2"){
  add(g,new THREE.SphereGeometry(.94,20,16),metal);
  for(let k=0;k<4;k++){const a=k*Math.PI/2;
   tube(g,[Math.cos(a)*.5,Math.sin(a)*.5,.3],[Math.cos(a)*2.2,Math.sin(a)*2.2,1.4],.02,metal);}
  return;
 }
 block(g,0,0,0,1.65,1.08,1.4,gold);
 const rtg=/Voyager|Pioneer|Galileo|Cassini|New Horizons/.test(title);
 if(title==="Juno Jupiter arrival"){
   for(let k=0;k<3;k++){
    const a=k*2*Math.PI/3,arm=new THREE.Group();arm.rotation.y=a;g.add(arm);
    for(let n=0;n<4;n++)block(arm,0,0,-1.9-n*1.16,2.05,.07,1.13,solar);
   }
 }else if(rtg){
   for(const sign of [-1,1]){
    tube(g,[sign*.5,-.1,0],[sign*3.3,-.2,.2],.055,metal);
    const pod=cylinder(g,sign*3.3,-.2,.2,.25,.25,.75,dark);pod.rotation.z=Math.PI/2;
   }
 }else if(/Rosetta/.test(title)){for(const sign of [-1,1])wing(g,sign,2,4.7);}
 else {for(const sign of [-1,1])wing(g,sign,1.9,/Mariner|Europa|JUICE/.test(title)?4.7:2.85);}
 dish(g,0,1.3,-.25, /Voyager|Pioneer|Cassini/.test(title)?1.75:.9);
 if(/OSIRIS/.test(title)){
   tube(g,[.4,-.3,0],[1.8,-2.6,-.8],.055,metal);
   cylinder(g,1.8,-2.6,-.8,.31,.31,.22,white);
 }
 if(/Rosetta|Cassini/.test(title)){const pod=add(g,new THREE.SphereGeometry(.45,14,10),white,0,-1.4,1);pod.scale.y=.65;}
}
export function createHistoricVehicle(scenario:StoryScenario):THREE.Group {
 const g=new THREE.Group(),title=scenario.title;
 if(/Sputnik/.test(title)){
  add(g,new THREE.SphereGeometry(1,20,15),metal);
  for(let k=0;k<4;k++){
   const a=k*Math.PI/2+.25;
   tube(g,[Math.cos(a)*.5,Math.sin(a)*.5,.55],
     [Math.cos(a)*2.8,Math.sin(a)*2.8,2.1],.018,metal);
  }
 } else if(scenario.family==="helicopter")helicopter(g);
 else if(scenario.family==="rover")rover(g,/Pathfinder/.test(title));
 else if(scenario.family==="lunar"){
  lander(g,"apollo");
  if(title==="Apollo 13"){const second=new THREE.Group();second.position.set(3.5,1.2,0);g.add(second);capsule(second,"apollo");second.scale.setScalar(.55);}
 }else if(scenario.family==="lander"){
  lander(g,/Luna 9/.test(title)?"luna9":/Luna 16/.test(title)?"luna16":/Viking/.test(title)?"viking":"generic");
 }else if(scenario.family==="station")station(g,title);
 else if(scenario.family==="shuttle")shuttle(g);
 else if(scenario.family==="telescope"||scenario.family==="observatory")telescope(g,title);
 else if(scenario.family==="capsule"||scenario.family==="gemini"||scenario.family==="apollo"||scenario.family==="sphere"){
  capsule(g,/Vostok|Voskhod/.test(title)?"vostok":/Mercury|Freedom 7|Friendship 7/.test(title)?"mercury":/Gemini/.test(title)?"gemini":/Artemis/.test(title)?"orion":"apollo");
 }else probe(g,title);
 return g;
}

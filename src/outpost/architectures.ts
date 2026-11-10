import * as T from "three";
import type {FacilityId} from "./FacilityScene";
import type {Place} from "./worldLogic";

/**
 * Six purpose-built facilities. All are actual, shaded three-dimensional
 * geometry, not cards, photographs, or interchangeable domes. Keep the
 * physical airlock on each building's local +Z face unobstructed.
 */
export type StructureKit={
 box:(parent:T.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,mat:T.Material)=>T.Mesh;
 cylinder:(parent:T.Object3D,r:number,h:number,x:number,y:number,z:number,mat:T.Material,sides?:number)=>T.Mesh;
 dome:(parent:T.Object3D,r:number,x:number,y:number,z:number,mat:T.Material,opacity?:number)=>T.Mesh;
 mesh:(geom:T.BufferGeometry,mat:T.Material,parent:T.Object3D)=>T.Mesh;
 mat:(color:number,metal?:number,rough?:number,emissive?:number,intensity?:number)=>T.MeshStandardMaterial;
 light:(parent:T.Object3D,x:number,y:number,z:number,color:number,intensity:number,range:number)=>T.PointLight;
 glass:T.MeshStandardMaterial;hull:T.MeshStandardMaterial;trim:T.MeshStandardMaterial;
 darkSteel:T.MeshStandardMaterial;gold:T.MeshStandardMaterial;glow:T.MeshStandardMaterial;
 solarMat:T.MeshStandardMaterial;green:T.MeshStandardMaterial;soil:T.MeshStandardMaterial;
 solarPanels:T.Group[];foliage:T.Object3D[];batteryLights:T.MeshStandardMaterial[];
 lamps:T.PointLight[];
};
const v3=(x:number,y:number,z:number)=>new T.Vector3(x,y,z);
function pipe(k:StructureKit,g:T.Object3D,a:T.Vector3,b:T.Vector3,r:number,m:T.Material){
 const d=b.clone().sub(a),o=k.cylinder(g,r,d.length(),(a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2,m,10);
 o.quaternion.setFromUnitVectors(v3(0,1,0),d.normalize());return o;
}
function glassMaterial(k:StructureKit,color:number,alpha=.35){
 const m=k.mat(color,.12,.11,0x14332f,.12);
 m.transparent=true;m.opacity=alpha;m.depthWrite=false;m.side=T.DoubleSide;return m;
}
function accent(k:StructureKit,g:T.Object3D,x:number,y:number,z:number,w:number){
 k.box(g,w,.075,.075,x,y,z,k.glow).castShadow=false;
}
function radiator(k:StructureKit,g:T.Object3D,x:number,y:number,z:number,w=1.1){
 k.box(g,w,1.2,.18,x,y,z,k.darkSteel);
 for(let j=0;j<6;j++)k.box(g,.04,1.03,.22,x-w/2+.15+j*(w-.3)/5,y,z+.01,k.hull).castShadow=false;
}
function plant(k:StructureKit,g:T.Object3D,x:number,y:number,z:number,scale=1){
 const p=new T.Group();p.position.set(x,y,z);g.add(p);
 k.cylinder(p,.04,.52,0,.24,0,k.green,8);
 for(let j=0;j<5;j++){
  const leaf=k.mesh(new T.SphereGeometry(.19,8,6),k.green,p);
  leaf.position.set(Math.sin(j*2.51)*.22,.30+j*.075,Math.cos(j*2.51)*.22);
  leaf.scale.set(1.1,.38,.72);
 }
 p.scale.setScalar(scale);k.foliage.push(p);
 return p;
}
function labelLamp(k:StructureKit,g:T.Object3D,x:number,y:number,z:number){
 k.box(g,.42,.12,.16,x,y,z,k.glow).castShadow=false;
}
function panelRack(k:StructureKit,g:T.Object3D,x:number,z:number,wide=2.8){
 const rack=new T.Group();g.add(rack);rack.position.set(x,1.40,z);
 pipe(k,rack,v3(-wide*.36,-1.2,0),v3(-wide*.36,-.08,0),.075,k.hull);
 pipe(k,rack,v3(wide*.36,-1.2,0),v3(wide*.36,-.08,0),.075,k.hull);
 const p=k.box(rack,wide,.10,1.72,0,0,0,k.solarMat);
 p.rotation.x=-.36;
 k.box(rack,wide+.1,.09,.09,0,0,-.9,k.hull).rotation.x=-.36;
 k.box(rack,wide+.1,.09,.09,0,0,.9,k.hull).rotation.x=-.36;
 for(let a=1;a<4;a++)k.box(rack,.038,.13,1.72,-wide/2+a*wide/4,.05,0,k.hull).rotation.x=-.36;
 for(const q of [-.45,.45])k.box(rack,wide,.04,.045,0,.06,q,k.gold).rotation.x=-.36;
 k.solarPanels.push(rack);
}
function cargo(k:StructureKit,g:T.Object3D,x:number,z:number,w=1.65,shade?:T.Material){
 k.box(g,w,1.43,1.2,x,.78,z,shade??k.darkSteel);
 k.box(g,w+.09,.10,1.31,x,1.52,z,k.hull);
 for(let i=0;i<5;i++)k.box(g,.035,1.2,.035,x-w/2+.1+i*(w-.2)/4,.8,z+.63,k.hull);
 accent(k,g,x,1.34,z+.67,w*.74);
}
function crewHabitat(k:StructureKit,g:T.Object3D){
 const warm=k.mat(0xead4b1,.25,.5,0x8c5733,.28);
 const pod=k.mat(0xbac9ca,.48,.30),ring=k.mat(0x4b6c77,.65,.33);
 // Three pressure vessels, their side airlocks connected by sealed corridors.
 for(const [x,z,r,len] of [[0,-.85,1.6,5.0],[-2.2,-1.35,1.12,2.7],[2.2,-1.35,1.12,2.7]]){
  const body=k.cylinder(g,r,len,x,1.86,z,pod,22);body.rotation.z=Math.PI/2;
  for(const dx of [-len*.36,len*.36]){
   const seam=k.cylinder(g,r*1.04,.16,x+dx,1.86,z,ring,22);seam.rotation.z=Math.PI/2;
  }
  for(const dx of [-len*.25,0,len*.25]){
   const window=k.mesh(new T.SphereGeometry(.34,12,9),k.glass,g);
   window.position.set(x+dx,2.06,z+Math.sqrt(r*r-.13));window.scale.set(1,.65,.18);
   k.box(g,.36,.06,.05,x+dx,1.88,z+r,k.gold);
   // The warm interior glow makes the crew modules readable at night.
   const warmPanel=k.box(g,.26,.18,.075,x+dx,2.04,z+r+.08,warm);warmPanel.castShadow=false;
  }
 }
 // Central pressure walkway from the front hatch to the living vessels.
 k.box(g,2.2,2.35,2.4,0,1.30,.73,ring);
 k.box(g,1.8,.72,1.7,0,2.35,.45,pod);
 radiator(k,g,-1.30,1.40,2.30,.7);radiator(k,g,1.30,1.40,2.30,.7);
 k.light(g,0,2.25,2.55,0xffd3a6,.85,6);
}
function solarField(k:StructureKit,g:T.Object3D){
 // No dome: a low electrical substation surrounded by racked photovoltaics.
 k.box(g,3.3,2.75,3.5,0,1.45,.45,k.darkSteel);
 for(const x of [-1.74,1.74])k.box(g,.20,2.55,3.9,x,1.48,.45,k.hull);
 k.box(g,3.65,.21,4.0,0,2.9,.45,k.hull);
 for(let i=0;i<3;i++){const x=(i-1)*.85;
  k.box(g,.6,.53,.08,x,2.08,2.23,k.glass);
  k.box(g,.42,.08,.1,x,2.58,2.24,k.gold);
 }
 for(const x of [-4.5,4.5])for(const z of [-3.2,-.3])panelRack(k,g,x,z,3.25);
 for(const x of [-2.85,2.85])panelRack(k,g,x,-4.4,2.7);
 // High-voltage transformer and conduits: more recognizable than a pod.
 for(const x of [-1.4,1.4]){
  k.cylinder(g,.36,2.15,x,1.18,-2.8,k.hull,12);
  for(let j=0;j<4;j++)k.cylinder(g,.48,.11,x,.75+j*.37,-2.8,k.trim,12);
  pipe(k,g,v3(x,2.34,-2.8),v3(x,2.34,-1.4),.09,k.gold);
 }
 k.light(g,0,2.7,2.4,0x91eaf4,1.3,8);
}
function stormShelter(k:StructureKit,g:T.Object3D){
 const regolith=k.mat(0x7a766e,.08,.95),armor=k.mat(0x454e5a,.54,.58);
 // Angular, low bunker with a regolith-covered roof and massive buttresses.
 k.box(g,5.9,2.85,5.0,0,1.43,-.5,armor);
 k.box(g,6.35,.67,5.5,0,3.0,-.45,regolith);
 k.box(g,6.7,.30,5.8,0,3.46,-.45,k.hull);
 for(const side of [-1,1]){
  for(let i=0;i<3;i++){
   const buttress=k.box(g,.6,2.5,4.6,side*3.22,1.22,-.5,regolith);
   buttress.rotation.z=side*.14;
  }
  k.box(g,1.0,.70,5.7,side*3.55,.36,-.5,regolith);
  k.box(g,.35,2.3,.18,side*1.35,1.35,2.05,k.gold);
 }
 // Layered external shielding and warning beacons.
 for(let i=0;i<4;i++)k.box(g,5.9+i*.16,.18,4.75+i*.12,0,3.38+i*.15,-.5,i%2?regolith:k.trim);
 for(const x of [-2.45,2.45])labelLamp(k,g,x,2.15,2.18);
 k.light(g,0,2.4,2.36,0xffbc80,1.35,6);
}
function lifeSupport(k:StructureKit,g:T.Object3D){
 const ceramic=k.mat(0xe0e8e3,.48,.33),cool=k.mat(0x558d9e,.50,.35,0x164e5c,.15);
 k.box(g,5.5,3.2,4.6,0,1.66,0,k.darkSteel);
 k.box(g,5.85,.20,4.95,0,3.33,0,ceramic);
 for(const side of [-1,1]){
  k.box(g,.22,3.45,5.0,side*2.86,1.76,0,k.hull);
  for(let n=0;n<3;n++){
   const z=-1.4+n*1.32;
   k.cylinder(g,.52,3.0,side*3.65,1.58,z,ceramic,16);
   k.cylinder(g,.55,.12,side*3.65,3.10,z,k.gold,16);
   k.cylinder(g,.55,.12,side*3.65,.20,z,k.trim,16);
   pipe(k,g,v3(side*3.65,3.10,z),v3(side*3.65,3.63,z),.09,cool);
  }
  pipe(k,g,v3(side*3.65,3.6,-1.4),v3(side*3.65,3.6,1.2),.12,k.gold);
 }
 for(let i=0;i<4;i++){
  const x=-1.9+i*1.28;
  k.box(g,.79,.76,.10,x,2.25,2.4,k.glass);
  accent(k,g,x,2.76,2.47,.6);
 }
 pipe(k,g,v3(-3.65,.8,-2.0),v3(-3.65,.8,2.1),.18,cool);
 pipe(k,g,v3(3.65,1.15,-2.0),v3(3.65,1.15,2.1),.15,k.gold);
 k.light(g,0,2.8,2.43,0x8ccfe7,1.1,7);
}
function greenhouse(k:StructureKit,g:T.Object3D){
 const transparent=glassMaterial(k,0xa4f3d8,.27),frame=k.mat(0xbedad7,.56,.22);
 // Long glass-ended hydroponics tunnel, ribs and lit trays with visible plants.
 const side=k.box(g,5.5,2.0,5.35,0,1.43,-.45,transparent);side.castShadow=false;
 for(const z of [-2.85,-1.75,-.45,.85,2.0]){
  const arch=k.mesh(new T.TorusGeometry(2.65,.11,7,30,Math.PI),frame,g);
  arch.position.set(0,2.0,z);arch.rotation.z=0;
  for(const x of [-2.65,2.65])k.box(g,.13,1.95,.13,x,1.02,z,frame);
 }
 // Translucent curved glass panels form a greenhouse tunnel rather than
 // another opaque dome; growers and pipework remain visible from outside.
 for(let j=0;j<9;j++){
  const angle=(j+.5)*Math.PI/9;
  const x=Math.cos(angle)*2.63,y=2.0+Math.sin(angle)*2.63;
  const pane=k.box(g,.93,.055,5.12,x,y,-.42,transparent);
  pane.rotation.z=angle+Math.PI/2;
  pane.castShadow=false;
 }
 const roof=k.box(g,2.1,.06,5.4,0,4.63,-.42,transparent);roof.castShadow=false;
 k.box(g,5.8,.13,5.5,0,3.98,-.42,frame);
 for(let j=0;j<3;j++){
  k.box(g,1.75,.25,4.25,(j-1)*1.83,1.03,-.53,k.soil);
  for(let n=0;n<6;n++)plant(k,g,(j-1)*1.83+.4*(n%2?1:-1),1.18,-2.2+n*.65,.78);
 }
 for(const x of [-2.48,2.48]){
  pipe(k,g,v3(x,.85,-2.7),v3(x,.85,2.25),.13,k.gold);
  for(let i=0;i<3;i++)pipe(k,g,v3(x,.85,-1.85+i*1.8),v3(x,2.15,-1.85+i*1.8),.05,frame);
 }
 for(const z of [-1.95,0,1.95]){
  const grow=k.box(g,4.2,.12,.25,0,3.35,z,k.glow);grow.castShadow=false;
 }
 k.lamps.push(k.light(g,0,3.3,-.4,0x9be9ad,2.0,7));
}
function battery(k:StructureKit,g:T.Object3D){
 const cerulean=k.mat(0x376076,.70,.38),power=k.mat(0xe0ad53,.50,.38);
 // Stacked rectangular battery storage, transformer units and cabling.
 k.box(g,5.6,2.7,4.4,0,1.35,0,cerulean);
 k.box(g,5.8,.22,4.6,0,2.82,0,k.hull);
 for(const side of [-1,1]){
  for(let col=0;col<4;col++){
   const z=-1.4+col*.93;
   k.box(g,.22,2.1,.11,side*2.85,1.35,z,k.hull);
   k.box(g,.23,.48,.40,side*2.97,1.62,z,k.glow);
  }
  for(const z of [-2.45,2.45])k.cylinder(g,.15,3.35,side*2.58,1.65,z,power,8);
 }
 for(let i=0;i<5;i++){
  const x=(i-2)*1.00;
  cargo(k,g,x,-3.1,.85,cerulean);
  k.box(g,.68,.17,.12,x,1.31,-2.46,k.glow);
 }
 for(let i=0;i<3;i++){
  const x=(i-1)*1.5;
  k.cylinder(g,.30,1.3,x,.78,-3.35,k.hull,12);
  for(let j=0;j<3;j++)k.cylinder(g,.42,.10,x,.52+j*.36,-3.35,power,12);
  pipe(k,g,v3(x,1.58,-3.35),v3(x,1.58,-2.0),.08,k.gold);
 }
 k.batteryLights.push(k.glow);
 k.light(g,0,2.4,2.35,0xa3e4ff,1.2,8);
}
export function buildDistinctExterior(id:FacilityId,kit:StructureKit,group:T.Group,facility:Place){
 // Decorative foundations vary by function; no shared dome shell.
 const pad=kit.cylinder(group,facility.radius+.5,.23,0,.04,0,kit.darkSteel,28);
 pad.receiveShadow=true;
 switch(id){
  case "habitat":crewHabitat(kit,group);break;
  case "solar":solarField(kit,group);break;
  case "shield":stormShelter(kit,group);break;
  case "recycle":lifeSupport(kit,group);break;
  case "greenhouse":greenhouse(kit,group);break;
  case "battery":battery(kit,group);break;
 }
 // A consistent front door is the only shared architectural component.
 const z=facility.radius+.06;
 const portal=kit.mat(0x7a9297,.65,.27),entry=kit.mat(0x0c2833,.42,.31);
 kit.box(group,2.5,2.95,.22,0,1.56,z-.14,entry);
 for(const side of [-1,1]){
  kit.box(group,.33,2.82,.50,side*1.1,1.4,z,portal);
  kit.box(group,.07,2.14,.13,side*.90,1.33,z+.26,kit.glow).castShadow=false;
 }
 kit.box(group,2.54,.33,.48,0,2.79,z,portal);
 kit.box(group,2.35,.17,.40,0,.16,z,kit.gold);
 kit.box(group,.72,.13,.15,0,2.7,z+.32,kit.glow).castShadow=false;
 const leaf=kit.box(group,1.75,2.24,.15,0,1.35,z+.33,kit.glass);
 // Opaque rear panel gives the impression of an airlock vestibule while the
 // actual game transitions into a separately modelled 3D interior.
 return leaf;
}

/** Unique machinery inside every building, with a clear central aisle. */
export function furnishDistinctInterior(id:FacilityId,k:StructureKit,group:T.Group){
 const metal=k.mat(0x93a9aa,.55,.37),warm=k.mat(0xe5d4bb,.36,.44,0x48311d,.15);
 if(id==="habitat"){
  for(const x of [-3.15,3.15])for(const z of [-2.05,.65]){
   k.box(group,1.45,.44,1.9,x,.60,z,metal);
   k.box(group,1.37,.18,1.4,x,.91,z,warm);
   k.box(group,.55,.13,.45,x,1.04,z-.53,k.hull);
   k.box(group,1.5,.12,1.7,x,1.25,z,k.gold);
  }
  for(const z of [-1.7,.4,2.4]){radiator(k,group,-4.08,1.68,z,.5);radiator(k,group,4.08,1.68,z,.5);}
 }else if(id==="solar"){
  for(const x of [-2.8,2.8])for(const z of [-1.55,.45]){
   const desk=k.box(group,1.2,1.3,.7,x,1,z,k.darkSteel);
   k.box(group,.94,.69,.10,x,1.48,z+.43,k.glass);
   for(let j=0;j<3;j++)accent(k,group,x,1.82+j*.13,z+.50,.62);
  }
  for(const x of [-3.0,3.0]){
   k.cylinder(group,.58,1.5,x,.85,2.7,k.hull,14);
   k.cylinder(group,.30,.19,x,1.65,2.7,k.gold);
  }
 }else if(id==="shield"){
  const armor=k.mat(0x495761,.73,.54);
  for(const side of [-1,1]){
   for(let i=0;i<3;i++){
    k.box(group,.75,2.2,1.1,side*3.7,1.4,-2.2+i*1.6,armor);
    k.box(group,.45,.42,.15,side*3.25,1.75,-2.2+i*1.6,k.glow);
   }
   k.box(group,1.32,.72,1.80,side*2.35,.48,.92,k.trim);
  }
  k.box(group,2.4,.16,1.3,0,3.45,.3,k.gold);
 }else if(id==="recycle"){
  for(const x of [-3.2,3.2])for(const z of [-2.2,-.55,1.1]){
   k.cylinder(group,.49,2.45,x,1.35,z,metal,16);
   k.cylinder(group,.5,.16,x,2.60,z,k.gold);
   pipe(k,group,v3(x,2.75,z),v3(x,3.20,z),.08,k.glow);
  }
  for(const x of [-2.55,2.55]){
   pipe(k,group,v3(x,3.2,-2.2),v3(x,3.2,2.2),.14,k.gold);
   for(let i=0;i<4;i++)k.box(group,.38,.06,.08,x,2.38,-1.85+i*1.15,k.glow);
  }
 }else if(id==="greenhouse"){
  for(const x of [-2.95,2.95])for(let j=0;j<4;j++){
   const z=-2.2+j*1.30;
   k.box(group,1.48,.22,.85,x,.58,z,k.soil);
   k.box(group,1.48,.14,.85,x,1.42,z,k.soil);
   for(const h of [.73,1.56])for(let n=0;n<3;n++)plant(k,group,x+(n-1)*.39,h,z,.72);
  }
  for(let z of [-1.75,.0,1.75])k.box(group,6.5,.14,.18,0,3.52,z,k.glow).castShadow=false;
  k.lamps.push(k.light(group,0,3.20,0,0x87ffd0,1.6,8));
 }else if(id==="battery"){
  for(const x of [-2.8,2.8])for(let j=0;j<5;j++){
   const z=-2.5+j*1.2;
   k.box(group,1.2,2.18,1.05,x,1.16,z,k.darkSteel);
   k.box(group,.83,.66,.10,x,1.64,z+.56,k.glass);
   k.box(group,.73,.12,.13,x,2.22,z+.57,k.glow).castShadow=false;
   k.batteryLights.push(k.glow);
  }
  for(const x of [-3.75,3.75])pipe(k,group,v3(x,2.8,-3.05),v3(x,2.8,3.1),.13,k.gold);
 }
}

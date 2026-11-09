import {useEffect,useRef,type RefObject} from "react";
import * as T from "three";
import {BASE_FACILITIES,doorPosition,doorwayCrossed,nearConsole,nearExit,nearestDoor,walkStep,distance,type Point2} from "./worldLogic";
import {CROPS,forecast,type Outpost} from "./engine";
import {dayBrief} from "./missionFlow";
import type {FacilityId} from "./FacilityScene";
import "./world3d.css";
export type Movement={x:number;y:number;run:boolean};
export type Proximity={title:string;kind:"door"|"console"|"exit";id:FacilityId}|null;
type Props={
 session:Outpost;room:FacilityId|null;movement:RefObject<Movement>;interactSeq:number;
 onEnter:(id:FacilityId|null)=>void;onConsole:(id:FacilityId)=>void;
 onNear:(near:Proximity)=>void;onError:(message:string)=>void;
};
function buildingColor(id:FacilityId){return id==="greenhouse"?0x376a60:id==="solar"?0x2f5578:id==="shield"?0x747b86:id==="recycle"?0x2c777f:id==="battery"?0x3c5d76:0x758792;}
function createScene(session:Outpost,room:FacilityId|null){
 const scene=new T.Scene(),dark=session.destination==="moon"&&[5,6].includes(session.sol);
 const dust=session.destination==="mars"&&[4,5,8].includes(session.sol);
 scene.background=new T.Color(dust?0x9a5f49:dark?0x050a14:session.destination==="mars"?0x5c3942:0x060d1a);
 scene.fog=new T.FogExp2(scene.background as T.Color,room?0.022:dust?0.025:0.010);
 const materials:T.Material[]=[],geometries:T.BufferGeometry[]=[],textures:T.Texture[]=[];
 const mat=(color:number,metalness=.22,roughness=.55,emissive=0x000000,emissiveIntensity=0)=> {
   const v=new T.MeshStandardMaterial({color,metalness,roughness,emissive,emissiveIntensity});
   materials.push(v);return v;
 };
 const hull=mat(0xb4bec0,.58,.33),trim=mat(0x273e51,.65,.34),darkSteel=mat(0x1b303f,.65,.34),
  glass=mat(0x316675,.42,.16,0x193e4c,.13),gold=mat(0xd8a55c,.75,.27),
  glow=mat(0x90ebd4,.2,.2,0x4aaf9e,1.5),red=mat(0xcc7151,.24,.4,0x9e4230,.25),
  solarMat=mat(0x17344c,.65,.2,0x0a2332,.24),rubber=mat(0x1b232c,.08,.9),
  green=mat(0x3ca868,.1,.75,0x255e36,.18),soil=mat(0x342d2a,.1,.9);
 const world=new T.Group();scene.add(world);
 const boxGeom=new T.BoxGeometry(1,1,1),sphereGeom=new T.SphereGeometry(1,18,12),cylGeom=new T.CylinderGeometry(1,1,1,16);
 geometries.push(boxGeom,sphereGeom,cylGeom);
 const mesh=(geom:T.BufferGeometry,m:T.Material,parent:T.Object3D=world)=>{
   const o=new T.Mesh(geom,m);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
 };
 function box(parent:T.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material){
   const o=mesh(boxGeom,m,parent);o.position.set(x,y,z);o.scale.set(w,h,d);return o;
 }
 function cylinder(parent:T.Object3D,r:number,h:number,x:number,y:number,z:number,m:T.Material,sides=16){
   const g=new T.CylinderGeometry(r,r,h,sides);geometries.push(g);
   const o=mesh(g,m,parent);o.position.set(x,y,z);return o;
 }
 function dome(parent:T.Object3D,r:number,x:number,y:number,z:number,m:T.Material,opacity?:number){
   const g=new T.SphereGeometry(r,26,14,0,Math.PI*2,0,Math.PI/2);
   geometries.push(g);const o=mesh(g,m,parent);o.position.set(x,y,z);
   if(opacity && m instanceof T.MeshStandardMaterial){m.transparent=true;m.opacity=opacity;m.depthWrite=false;}
   return o;
 }
 function light(parent:T.Object3D,x:number,y:number,z:number,c:number,intensity:number,range:number){
   const o=new T.PointLight(c,intensity,range,2);o.position.set(x,y,z);parent.add(o);return o;
 }
 function textureSurface(){
   const canvas=document.createElement("canvas");canvas.width=256;canvas.height=256;
   const ctx=canvas.getContext("2d");if(!ctx)return null;
   const pixels=ctx.createImageData(256,256);
   for(let y=0;y<256;y++)for(let x=0;x<256;x++){
     const a=Math.sin(x*.44+y*.12)*.24+Math.cos(y*.3+x*.17)*.23+Math.sin(x*2.9+y*3.1)*.12;
     const n=Math.round(145+a*68),i=(y*256+x)*4;
     pixels.data[i]=n;pixels.data[i+1]=n;pixels.data[i+2]=n;pixels.data[i+3]=255;
   }ctx.putImageData(pixels,0,0);
   const t=new T.CanvasTexture(canvas);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(22,22);t.anisotropy=4;textures.push(t);
   return t;
 }
 const sun=new T.DirectionalLight(dark?0x6475a8:dust?0xe8ae8a:0xffedd3,dark?.34:2.45);
 sun.position.set(-27,42,-20);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
 sun.shadow.camera.left=-36;sun.shadow.camera.right=36;sun.shadow.camera.top=36;sun.shadow.camera.bottom=-36;
 sun.shadow.normalBias=.035;scene.add(sun);
 scene.add(new T.HemisphereLight(dark?0x2b395b:dust?0x996d64:0xb0cce2,0x171b27,dark?.34:1.15));
 const foliage: T.Object3D[]=[];
 const batteryLights:T.MeshStandardMaterial[]=[];
 const lamps:T.PointLight[]=[];
 const solarPanels:T.Group[]=[];
 const doors=new Map<FacilityId,{mesh:T.Mesh;open:number}>();
 const markers=new Map<FacilityId,T.Object3D>();
 function nameplate(text:string,parent:T.Object3D,y:number){
   const label=document.createElement("canvas");label.width=512;label.height=128;
   const ctx=label.getContext("2d");if(!ctx)return;
   ctx.fillStyle="#092535d9";ctx.fillRect(0,11,512,96);
   ctx.strokeStyle="#89e4ce";ctx.lineWidth=5;ctx.strokeRect(6,15,500,88);
   ctx.font="bold 35px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";
   ctx.fillStyle="#e8fff5";ctx.fillText(text.toUpperCase(),256,61,470);
   const tex=new T.CanvasTexture(label);textures.push(tex);
   const sm=new T.SpriteMaterial({map:tex,depthTest:false,transparent:true});
   materials.push(sm);const sprite=new T.Sprite(sm);
   sprite.position.set(0,y,0);sprite.scale.set(4.8,1.2,1);parent.add(sprite);
   return sprite;
 }
 if(!room){
   const surface=mat(session.destination==="mars"?0x8e6252:0x686973,.03,.96);
   const tx=textureSurface();if(tx){surface.map=tx;surface.needsUpdate=true;}
   const planeGeo=new T.PlaneGeometry(230,230,1,1);geometries.push(planeGeo);
   const ground=mesh(planeGeo,surface);ground.rotation.x=-Math.PI/2;ground.position.y=-.1;ground.receiveShadow=true;ground.castShadow=false;
   // Repeated rocks use instanced geometry to keep the mobile draw call count low.
   const rockGeo=new T.DodecahedronGeometry(1,0);geometries.push(rockGeo);
   const rocks=new T.InstancedMesh(rockGeo,mat(session.destination==="mars"?0x9c7164:0x81848b,.05,.9),175);
   const dummy=new T.Object3D();
   for(let i=0;i<175;i++){
     const a=i*2.39996,r=7+Math.sqrt(i)*2.9,x=Math.cos(a)*r,z=Math.sin(a)*r;
     // Never skip a matrix in InstancedMesh: uninitialized instances at the
     // origin would appear as a pile of rocks blocking the player's spawn.
     const hidden=Math.abs(x)<21&&Math.abs(z)<23;
     dummy.position.set(hidden?200+i:hidden?200:x,.15,hidden?200+i:z);dummy.rotation.y=a;dummy.scale.set(.24+(i%7)*.12,.12+(i%4)*.12,.3+(i%5)*.1);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);
   }rocks.instanceMatrix.needsUpdate=true;rocks.castShadow=true;rocks.receiveShadow=true;world.add(rocks);
   // Elevated horizon ridges and distant planet give large-scene depth.
   for(let i=0;i<18;i++){
     const angle=i/18*Math.PI*2,rad=56+(i%4)*3;
     const h=4+(i*7%11);const g=new T.ConeGeometry(7+(i%4)*3,h,5);geometries.push(g);
     const o=mesh(g,mat(session.destination==="mars"?0x593e42:0x3c4558,.06,.95));o.position.set(Math.sin(angle)*rad,h*.35-1,Math.cos(angle)*rad);
     o.rotation.y=angle;
   }
   // Scene constellations and distant Earth/Phobos.
   const starPositions=new Float32Array(900*3);
   for(let i=0;i<900;i++){const a=i*2.42,b=.08+(i%91)/100*Math.PI*.43,r=95;
     starPositions[i*3]=Math.cos(a)*Math.sin(b)*r;starPositions[i*3+1]=Math.cos(b)*r;starPositions[i*3+2]=Math.sin(a)*Math.sin(b)*r;
   }
   const starGeo=new T.BufferGeometry();geometries.push(starGeo);
   starGeo.setAttribute("position",new T.BufferAttribute(starPositions,3));
   const starMat=new T.PointsMaterial({color:0xc9e7ef,size:.19,sizeAttenuation:true,transparent:true,opacity:dark?1:.55});materials.push(starMat);
   const stars=new T.Points(starGeo,starMat);scene.add(stars);
   const planet=mesh(sphereGeom,mat(session.destination==="moon"?0x438ca9:0xd8a48e,.05,.85));
   planet.scale.setScalar(session.destination==="moon"?4.7:2.2);planet.position.set(48,35,-85);planet.castShadow=false;
   for(const f of BASE_FACILITIES){
     const group=new T.Group();group.position.set(f.x,0,f.z);
     const facing=Math.atan2(-f.x,-f.z);group.rotation.y=facing;world.add(group);
     const colorMat=mat(buildingColor(f.id),.42,.39);
     nameplate(f.title,group,5.6);
     const goal=new T.Group();goal.position.set(0,.1,0);group.add(goal);
     const circleGeo=new T.RingGeometry(f.radius+.7,f.radius+.83,48);
     geometries.push(circleGeo);
     const ring=mesh(circleGeo,glow,goal);ring.rotation.x=-Math.PI/2;ring.castShadow=false;
     markers.set(f.id,goal);
     const base=cylinder(group,f.radius,1.15,0,.58,0,trim,24);
     const platform=cylinder(group,f.radius+1.0,.16,0,.03,0,darkSteel,24);
     for(let i=0;i<16;i++){
       const a=i*Math.PI/8;box(group,.22,.2,.45,Math.sin(a)*(f.radius+.5),.2,Math.cos(a)*(f.radius+.5),hull);
     }
     dome(group,f.radius*.92,0,1.1,0,colorMat);
     const stripe=cylinder(group,f.radius*.98,.12,0,1.1,0,gold,24);
     stripe.receiveShadow=false;
     for(let i=0;i<4;i++){const a=i*Math.PI/2;
       box(group,.23,1.2,.2,Math.sin(a)*f.radius*.85,1.65,Math.cos(a)*f.radius*.85,hull);
     }
     // Real openable airlock: left/right metal jambs, overhead lintel and
     // recessed dark passage. Never place a solid box behind the door leaf:
     // that made earlier "opening" animations look blocked.
     box(group,.32,2.75,.46,-1.10,1.37,f.radius-.02,hull);
     box(group,.32,2.75,.46,1.10,1.37,f.radius-.02,hull);
     box(group,2.40,.36,.46,0,2.66,f.radius-.02,hull);
     box(group,2.10,.16,.52,0,.16,f.radius-.02,gold);
     box(group,2.00,2.16,.05,0,1.40,f.radius-.48,rubber);
     for(const side of [-1,1]){
       box(group,.09,2.12,.16,side*.93,1.4,f.radius+.10,glow);
     }
     const leaf=box(group,1.72,2.10,.16,0,1.35,f.radius+.10,glass);
     const doorLight=box(group,.16,.17,.17,.79,2.5,f.radius+.25,glow);
     doors.set(f.id,{mesh:leaf,open:0});
     for(let i=0;i<3;i++){
       const a=-.72+i*.72;
       box(group,.15,.09,.25,a,2.65,f.radius+.20,gold);
     }
     const status=box(group,1,.17,.08,0,2.6,f.radius+.34,glow);status.castShadow=false;
     if(f.id==="solar"){
       for(let j=0;j<4;j++){
         const px=(j-1.5)*2.75,pz=-3.5;
         const mount=new T.Group();mount.position.set(px,.75,pz);group.add(mount);
         cylinder(mount,.1,1.5,0,0,0,hull);
         const panel=box(mount,2.4,.08,2.0,0,.65,0,solarMat);
         panel.rotation.x=-.27;solarPanels.push(mount);
         for(let k=-1;k<=1;k++){const rib=box(mount,.07,.13,2.2,k*.7,.69,0,hull);rib.rotation.x=-.27;}
       }
     }else if(f.id==="greenhouse"){
       const shellGlass=mat(0x7aceb9,.1,.19,0x267b58,.08);
       shellGlass.transparent=true;shellGlass.opacity=.31;shellGlass.depthWrite=false;
       dome(group,f.radius*.9,0,1.18,0,shellGlass);
       for(let i=0;i<8;i++){
         const x=(i%4-1.5)*.86,z=Math.floor(i/4)*1.4-1.0;
         cylinder(group,.2,.35,x,1.0,z,soil);
         const plant=new T.Group();plant.position.set(x,1.25,z);group.add(plant);
         cylinder(plant,.04,.33,0,.15,0,green);
         for(let k=0;k<3;k++){const leaf=mesh(sphereGeom,green,plant);
           leaf.position.set(Math.sin(k*2.1)*.18,.35+Math.cos(k)*.05,Math.cos(k*2.1)*.18);leaf.scale.set(.25,.11,.15);
         }foliage.push(plant);
       }
       const greenhouseLight=light(group,0,2.3,0,0x8cf3c3,1.5,7);lamps.push(greenhouseLight);
     }else if(f.id==="shield"){
       for(let i=0;i<4;i++)dome(group,f.radius*(.94+i*.055),0,1.08,0,
         mat(i%2===0?0x666f7e:0x34485b,.34,.52));
       light(group,0,2.6,0,0xefbf88,.7,5);
     }else if(f.id==="battery"){
       for(let i=0;i<6;i++){const x=(i%3-1)*1.55,z=Math.floor(i/3)*1.3-1.2;
         box(group,1.1,.6,.85,x,1.1,z,darkSteel);
         const cell=box(group,.9,.1,.08,x,1.45,z+.48,glow);
         batteryLights.push(cell.material as T.MeshStandardMaterial);
       }
     }else if(f.id==="recycle"){
       for(let i=0;i<3;i++){
         cylinder(group,.5,2.15,(i-1)*1.6,1.7,-1,whiteMaterial(i));
         cylinder(group,.52,.14,(i-1)*1.6,2.84,-1,gold);
       }
     }else{
       for(let i=0;i<5;i++){
         box(group,.7,1.2,.8,(i-2)*1.15,1.3,-1.0,glass);
         box(group,.5,.12,.1,(i-2)*1.15,1.65,-.52,glow);
       }
     }
     function whiteMaterial(i:number){return i===1?glass:hull;}
   }
   // Walkway lights indicate routes to every building.
   for(const f of BASE_FACILITIES){const door=doorPosition(f);
     for(let t=.17;t<1;t+=.19){const x=door.x*t,z=door.z*t;
       for(const side of [-1,1]){
         const a=Math.atan2(door.x,door.z);
         const px=x+Math.cos(a)*side*.95,pz=z-Math.sin(a)*side*.95;
         const bulb=box(world,.22,.08,.22,px,.09,pz,glow);bulb.castShadow=false;
       }
     }
   }
 }else{
   // In-room geometry is actual 3D, navigated by the same avatar and camera.
   const floor=box(world,9,.4,9,0,-.21,0,trim);
   const roof=box(world,9,.35,9,0,4.0,0,hull);
   const wall=mat(0x6d838a,.6,.35);
   box(world,9,4,.3,0,1.95,-4.5,wall);
   box(world,.3,4,9,-4.5,1.95,0,wall);
   box(world,.3,4,9,4.5,1.95,0,wall);
   // Front wall includes a door-sized corridor opening. Door leaf slides.
   box(world,3.5,4,.3,-2.75,1.95,4.5,wall);
   box(world,3.5,4,.3,2.75,1.95,4.5,wall);
   box(world,2.0,1.15,.3,0,3.45,4.5,wall);
   const leaf=box(world,1.96,2.75,.22,0,1.44,4.53,glass);
   doors.set(room,{mesh:leaf,open:0});
   for(let i=0;i<6;i++){
     box(world,.12,.035,8,-4+i*1.55,.016,0,gold);
     box(world,8,.035,.1,0,.015,-4+i*1.55,glow);
   }
   const control=box(world,3.1,1.2,.9,0,.85,-2.85,darkSteel);
   box(world,2.75,.10,.7,0,1.55,-2.85,gold);
   const panel=box(world,2.48,1.2,.08,0,2.25,-3.16,glass);
   // Glowing console status indicators.
   const screen=box(world,2.0,.72,.12,0,2.27,-3.1,glow);
   batteryLights.push(screen.material as T.MeshStandardMaterial);
   for(let i=0;i<8;i++)box(world,.13,.07,.12,(i%4-1.5)*.5,1.61,-2.36,i%3?glow:red);
   for(let i=0;i<4;i++)box(world,.8,2.4,.85,(i%2?1:-1)*3.3,1.45,-2.4+i*1.4,darkSteel);
   for(let i=0;i<6;i++){const x=(i-2.5)*1.15;
     box(world,.08,.12,8,x,3.74,0,glow);
   }
   for(let i=0;i<4;i++){const p=light(world,(i%2?2.5:-2.5),3.45,i<2?-2.6:2.7,0xa6eaff,1.8,7);lamps.push(p);}
   // Physically rendered room-specific machinery.
   if(room==="greenhouse"){
     for(let row=0;row<2;row++)for(let col=0;col<6;col++){
       const x=(col-2.5)*.92,z=row===0?-.5:1.2;
       box(world,.78,.24,1.1,x,.5,z,soil);
       const plant=new T.Group();plant.position.set(x,.72,z);world.add(plant);
       const stem=cylinder(plant,.055,.66,0,.3,0,green,8);
       for(let j=0;j<5;j++){
         const leaf=mesh(sphereGeom,green,plant);leaf.scale.set(.3,.09,.18);leaf.position.set(Math.sin(j*2.3)*.26,.45+j*.052,Math.cos(j*2.3)*.26);
       }foliage.push(plant);
     }
     for(let i=0;i<4;i++){
       box(world,2.5,.10,.24,0,3.35,-1.8+i*1.35,glow);
     }
   }
   if(room==="battery")for(let i=0;i<7;i++){
     box(world,.73,1.25,.64,(i-3)*.9,.87,0,trim);
     box(world,.58,.12,.12,(i-3)*.9,1.32,.34,glow);
   }
   if(room==="solar")for(let i=0;i<3;i++){
     cylinder(world,.35,1.5,(i-1)*2,.9,0,hull);
     const rotator=box(world,1.4,.08,1.8,(i-1)*2,1.7,0,solarMat);
     solarPanels.push(rotator.parent as T.Group);
   }
   if(room==="recycle")for(let i=0;i<3;i++){
     cylinder(world,.65,2.2,(i-1)*2,1.35,-.6,hull);
     cylinder(world,.67,.12,(i-1)*2,2.52,-.6,glow);
   }
   if(room==="shield")for(let i=0;i<4;i++)box(world,1.15,2.2,.7,(i-1.5)*1.65,1.3,.1,trim);
   if(room==="habitat")for(let i=0;i<4;i++){
     box(world,1.6,.6,.85,(i%2?1:-1)*3.1,.52,(i<2?0:1.5),hull);
     box(world,1.5,.14,.8,(i%2?1:-1)*3.1,.88,(i<2?0:1.5),glow);
   }
 }
 const astro=new T.Group();world.add(astro);
 const suit=mat(0xd7e0e2,.22,.64),visor=mat(0x152c40,.7,.10,0x19394d,.35),suitDark=mat(0x344b59,.4,.58);
 const torso=mesh(new T.CapsuleGeometry(.37,.54,5,12),suit,astro);geometries.push(torso.geometry);
 torso.position.y=1.24;
 const helmet=mesh(sphereGeom,suit,astro);helmet.position.y=2.05;helmet.scale.set(.37,.38,.37);
 const shield=mesh(sphereGeom,visor,astro);shield.position.set(0,2.08,-.17);shield.scale.set(.29,.25,.22);
 box(astro,.60,.78,.30,0,1.28,.43,trim);
 const limbs:T.Object3D[]=[];
 for(let side of [-1,1]){
   const arm=new T.Group();arm.position.set(side*.48,1.57,0);astro.add(arm);
   box(arm,.24,.8,.26,side*.035,-.33,0,suit);
   const glove=mesh(sphereGeom,suitDark,arm);glove.scale.set(.14,.15,.16);glove.position.y=-.77;
   limbs.push(arm);
   const leg=new T.Group();leg.position.set(side*.22,.84,0);astro.add(leg);
   box(leg,.26,.68,.27,0,-.29,0,suit);
   box(leg,.32,.18,.45,0,-.69,-.13,suitDark);
   limbs.push(leg);
 }
 // Equipment accent on the astronaut chest.
 box(astro,.42,.16,.09,0,1.43,-.36,glow);
 const camera=new T.PerspectiveCamera(64,1,.12,170);
 const dispose=()=>{
   world.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.InstancedMesh){o.geometry.dispose();}});
   materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());geometries.forEach(g=>g.dispose());
 };
 return {scene,camera,astro,limbs,doors,markers,solarPanels,foliage,lamps,batteryLights,dispose};
}
export default function World3D({session,room,movement,interactSeq,onEnter,onConsole,onNear,onError}:Props){
 const host=useRef<HTMLDivElement>(null);
 const latest=useRef({session,onEnter,onConsole,onNear,onError,interactSeq});
 latest.current={session,onEnter,onConsole,onNear,onError,interactSeq};
 useEffect(()=>{
   const container=host.current;if(!container)return;
   let renderer:T.WebGLRenderer;
   try{renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:"high-performance"});}
   catch{latest.current.onError("3D graphics could not start. Enable WebGL in your browser.");return;}
   const scene=createScene(latest.current.session,room);
   renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
   renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
   renderer.outputColorSpace=T.SRGBColorSpace;
   renderer.toneMapping=T.ACESFilmicToneMapping;
   renderer.toneMappingExposure=1.12;
   container.appendChild(renderer.domElement);
   renderer.domElement.className="jm-world-canvas";
   const player:Point2=room?{x:0,z:2.9}:{x:0,z:0};
   const state={position:player,yaw:room?0:0,pitch:.15,open:null as FacilityId|null,openAt:0};
   const keys=new Set<string>();
   let lookPointer:number|null=null,px=0,py=0;
   let previous=performance.now(),frame=0,alive=true,lastPrompt="",lastInteraction=latest.current.interactSeq;
   let entered=false,lastBattery=-1;
   let interactRequest=false;
   const down=(e:KeyboardEvent)=>{const k=e.key.toLowerCase();
     if(["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright","e","shift"," "].includes(k)){
       if(e.target===document.body)e.preventDefault();
       if(k==="e"&&!e.repeat)interactRequest=true;
       keys.add(k);
     }
   };
   const up=(e:KeyboardEvent)=>keys.delete(e.key.toLowerCase());
   const release=()=>{keys.clear();lookPointer=null;};
   document.addEventListener("keydown",down);document.addEventListener("keyup",up);window.addEventListener("blur",release);
   const pointerDown=(e:PointerEvent)=>{
     if(lookPointer!==null)return;lookPointer=e.pointerId;px=e.clientX;py=e.clientY;
     renderer.domElement.setPointerCapture(e.pointerId);
   };
   const pointerMove=(e:PointerEvent)=>{
     if(lookPointer!==e.pointerId)return;
     const dx=e.clientX-px,dy=e.clientY-py;px=e.clientX;py=e.clientY;
     state.yaw-=dx*.0045;state.pitch=Math.max(-.15,Math.min(.52,state.pitch+dy*.003));
   };
   const pointerEnd=(e:PointerEvent)=>{if(lookPointer===e.pointerId)lookPointer=null;};
   renderer.domElement.addEventListener("pointerdown",pointerDown);
   renderer.domElement.addEventListener("pointermove",pointerMove);
   renderer.domElement.addEventListener("pointerup",pointerEnd);
   renderer.domElement.addEventListener("pointercancel",pointerEnd);
   const resize=()=>{const w=container.clientWidth,h=container.clientHeight;
     renderer.setSize(Math.max(1,w),Math.max(1,h),false);
     scene.camera.aspect=Math.max(1,w)/Math.max(1,h);scene.camera.updateProjectionMatrix();};
   const ro=new ResizeObserver(resize);ro.observe(container);resize();
   const interact=()=>{
     if(room){
       if(nearConsole(state.position)){latest.current.onConsole(room);return;}
       if(nearExit(state.position)){state.open=room;state.openAt=performance.now();return;}
     }else{
       const target=nearestDoor(state.position,2.5);
       if(target){state.open=target.id;state.openAt=performance.now();}
     }
   };
   const animate=(now:number)=>{
     if(!alive)return;
     const dt=Math.min(.05,Math.max(.001,(now-previous)/1000));previous=now;
     const data=latest.current.session;
     const motion=movement.current||{x:0,y:0,run:false};
     const right=Number(keys.has("d")||keys.has("arrowright"))-Number(keys.has("a")||keys.has("arrowleft"));
     const front=Number(keys.has("w")||keys.has("arrowup"))-Number(keys.has("s")||keys.has("arrowdown"));
     const x=Math.max(-1,Math.min(1,motion.x+right)),y=Math.max(-1,Math.min(1,motion.y+front));
     const running=motion.run||keys.has("shift");
     const next=walkStep(state.position,state.yaw,x,y,dt*(running?1.43:1),Boolean(room),state.open);
     state.position.x=next.x;state.position.z=next.z;
     const speed=Math.hypot(x,y);
     const bob=Math.sin(now*.011*(running?1.25:1))*Math.min(.052,speed*.052);
     scene.astro.position.set(state.position.x,bob,state.position.z);
     // The astronaut faces the movement vector, with the camera behind it.
     if(speed>.04){const facing=Math.atan2(-Math.sin(state.yaw)*y+Math.cos(state.yaw)*x,-Math.cos(state.yaw)*y-Math.sin(state.yaw)*x);
       scene.astro.rotation.y=facing-Math.PI;}
     scene.limbs.forEach((limb,i)=>{limb.rotation.x=Math.sin(now*.012+(i%2?Math.PI:0))*.42*speed;});
     // Third person orbit camera, drag right side to rotate camera independently of the left joystick.
     const back=new T.Vector3(Math.sin(state.yaw),0,Math.cos(state.yaw));
     const desired=new T.Vector3(state.position.x+back.x*(room?4.2:6.2),3.4+state.pitch*4,state.position.z+back.z*(room?4.2:6.2));
     scene.camera.position.lerp(desired,Math.min(1,dt*8));
     scene.camera.lookAt(state.position.x,1.43+state.pitch*.2,state.position.z);
     if(latest.current.interactSeq!==lastInteraction || interactRequest){
       lastInteraction=latest.current.interactSeq;interactRequest=false;interact();
     }
     // Render physical airlock slide and require walking across the doorway.
     for(const [id,gate] of scene.doors){
       const shouldOpen=state.open===id;
       const goal=shouldOpen?1:0;
       gate.open+=(goal-gate.open)*(1-Math.exp(-dt*6));
       gate.mesh.position.x=gate.open*1.9;
     }
     if(state.open&&now-state.openAt>350&&!entered){
       if(room){
         if(state.position.z>4.05){entered=true;latest.current.onEnter(null);return;}
       }else if(doorwayCrossed(state.position,state.open)){
         entered=true;latest.current.onEnter(state.open);return;
       }
     }
     const near:Proximity=room?
       nearConsole(state.position)?{kind:"console",id:room,title:"OPERATE "+room.toUpperCase()}:
       nearExit(state.position)?{kind:"exit",id:room,title:state.open?"EXIT THROUGH AIRLOCK":"OPEN EXIT AIRLOCK"}:null
       :(()=>{const f=nearestDoor(state.position,2.5);return f?{kind:"door",id:f.id,title:state.open===f.id?"AIRLOCK OPEN · WALK INSIDE":"OPEN "+f.title.toUpperCase()+" AIRLOCK"}:null;})();
     const label=near?near.title:"";
     if(label!==lastPrompt){lastPrompt=label;latest.current.onNear(near);}
     // Light the current mission target on the actual 3D terrain.
     const target=dayBrief(data).focus;
     scene.markers.forEach((o,id)=>{o.visible=id===target;o.rotation.y+=dt*.18;});
     // Make the environment react immediately to the actual game resources.
     const power=data.battery/100;
     if(Math.round(data.battery)!==lastBattery){
       lastBattery=Math.round(data.battery);
       scene.lamps.forEach(l=>l.intensity=power<.08?.08:power<.22?.4:1.7);
       scene.batteryLights.forEach(m=>m.emissiveIntensity=power<.08?.08:power<.22?.25:1.4);
     }
     scene.foliage.forEach((o,i)=>{const growth=Math.max(.2,.35+data.crop/75);
       o.scale.setScalar(growth*(.93+(i%3)*.05));});
     scene.solarPanels.forEach((o,i)=>o.rotation.y=Math.sin(now*.00012+i*.28)*.14);
     renderer.render(scene.scene,scene.camera);
     frame=requestAnimationFrame(animate);
   };
   frame=requestAnimationFrame(animate);
   return ()=>{alive=false;cancelAnimationFrame(frame);ro.disconnect();release();
     document.removeEventListener("keydown",down);document.removeEventListener("keyup",up);window.removeEventListener("blur",release);
     renderer.domElement.removeEventListener("pointerdown",pointerDown);renderer.domElement.removeEventListener("pointermove",pointerMove);
     renderer.domElement.removeEventListener("pointerup",pointerEnd);renderer.domElement.removeEventListener("pointercancel",pointerEnd);
     scene.dispose();renderer.dispose();renderer.domElement.remove();
   };
 },[room,movement]);
 return <div className="jm-world-host" ref={host} role="img" aria-label={"Walkable three-dimensional "+session.destination+" research outpost. Move with left joystick or WASD, drag to look, and press interact at airlocks and control panels."}/>;
}

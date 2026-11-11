import {useEffect,useRef,type RefObject} from "react";
import * as T from "three";
import {BASE_FACILITIES,doorPosition,doorwayCrossed,nearConsole,nearExit,nearestDoor,walkStep,distance,confinedInteriorCamera,nearHabitatRoutine,CREW_BED,CREW_DINING,type Point2} from "./worldLogic";
import {CROPS,forecast,type Outpost} from "./engine";
import type {FacilityId} from "./FacilityScene";
import {buildDistinctExterior,furnishDistinctInterior,type StructureKit} from "./architectures";
import {attachRealismModel,createRegolithMaterial,createTechnicalMaterial,rigAstronautModel} from "../presentation/realismAssets";
import {RoomEnvironment} from "three/examples/jsm/environments/RoomEnvironment.js";
import {readPreferences,type PlayerPreferences} from "../commander/campaign/preferences";
import {graphicsRatioBounds,adaptiveGraphicsRatio,publishGraphicsTrace} from "../commander/graphicsPolicy";
import {facilityDisplay,batchOutpostStructure,outpostTerrainHeight} from "./visualFinish";
import "./world3d.css";
export type Movement={x:number;y:number;run:boolean};
export type CameraDelta={yaw:number;pitch:number};
export type WorldPose={position:Point2;yaw:number;pitch:number};
export type Proximity={title:string;kind:"door"|"console"|"exit"|"meal"|"sleep";id:FacilityId}|null;
type Props={
 session:Outpost;room:FacilityId|null;graphics:PlayerPreferences["graphics"];blocked:boolean;movement:RefObject<Movement>;lookDelta:RefObject<CameraDelta>;spawn:RefObject<WorldPose>;interactSeq:number;target:FacilityId;
 onEnter:(id:FacilityId|null,pose:WorldPose)=>void;onConsole:(id:FacilityId)=>void;onRoutine:(kind:"meal"|"sleep")=>void;
 onNear:(near:Proximity)=>void;onPosition:(pos:Point2)=>void;onError:(message:string)=>void;
};
function createScene(session:Outpost,room:FacilityId|null){
 const scene=new T.Scene(),dark=session.destination==="moon"&&[5,6].includes(session.sol);
 const dust=session.destination==="mars"&&[4,5,8].includes(session.sol);
 scene.background=new T.Color(room?0x11171c:dust?0x98715a:dark?0x010204:session.destination==="mars"?0xb58d70:0x010204);
 // The Moon has no atmospheric haze; Mars has dust, with reduced visibility
 // during the existing storm sols. Cabin surfaces remain crisp at close range.
 if(!room&&session.destination==="mars")scene.fog=new T.FogExp2(scene.background as T.Color,dust?.024:.0055);
 const materials:T.Material[]=[],geometries:T.BufferGeometry[]=[],textures:T.Texture[]=[];
 const referenceAssets:{dispose:()=>void}[]=[];
 const externalProps:T.Box3[]=[];
 const mat=(color:number,metalness=.22,roughness=.55,emissive=0x000000,emissiveIntensity=0)=> {
   const v=new T.MeshStandardMaterial({color,metalness,roughness,emissive,emissiveIntensity});
   materials.push(v);return v;
 };
 const hull=mat(0xd4d3cb,.32,.56),trim=mat(0x485057,.58,.41),darkSteel=mat(0x283038,.52,.47),
  glass=mat(0x316675,.42,.16,0x193e4c,.13),gold=mat(0xd8a55c,.75,.27),
  glow=mat(0xc6d9d6,.15,.4,0x91bab8,.75),red=mat(0xcc7151,.24,.4,0x9e4230,.25),
  solarMat=mat(0x152333,.58,.31),rubber=mat(0x1b232c,.08,.9),
  green=mat(0x528043,.03,.88),soil=mat(0x342d2a,.1,.9);
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
 // Subtle deterministic panel wear, seams, and rivets make the structural
 // material more convincing than a single flat-colored Three.js primitive.
 function engineeringPanelTexture(){
  const canvas=document.createElement("canvas");canvas.width=256;canvas.height=256;
  const ctx=canvas.getContext("2d");if(!ctx)return null;
  ctx.fillStyle="#d2dbde";ctx.fillRect(0,0,256,256);
  for(let i=0;i<1100;i++){
   const x=(i*71)%256,y=(i*137+(i*i*3)%251)%256;
   const v=155+(i*37)%83;
   ctx.fillStyle="rgba("+v+","+v+","+v+",0.15)";
   ctx.fillRect(x,y,1+(i%3),1);
  }
  ctx.strokeStyle="#84979a";ctx.lineWidth=2;
  ctx.strokeRect(5,5,246,246);
  ctx.beginPath();ctx.moveTo(128,5);ctx.lineTo(128,251);ctx.moveTo(5,128);ctx.lineTo(251,128);ctx.stroke();
  for(const a of [12,118,138,244])for(const b of [12,118,138,244]){
   ctx.fillStyle="#64797f";ctx.beginPath();ctx.arc(a,b,2.5,0,Math.PI*2);ctx.fill();
   ctx.fillStyle="#f0fbfb";ctx.fillRect(a-1,b-1,1,1);
  }
  const tex=new T.CanvasTexture(canvas);tex.wrapS=tex.wrapT=T.RepeatWrapping;
  tex.repeat.set(2,2);tex.anisotropy=4;tex.colorSpace=T.SRGBColorSpace;textures.push(tex);
  return tex;
 }
 const metalDetail=engineeringPanelTexture();
 if(metalDetail){hull.map=metalDetail;hull.needsUpdate=true;}
 const sun=new T.DirectionalLight(dark?0x9ba9bc:dust?0xffd4ad:0xfff1dc,room?.28:dark?.12:dust?1.15:3.1);
 sun.position.set(-31,23,-24);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
 sun.shadow.camera.left=-36;sun.shadow.camera.right=36;sun.shadow.camera.top=36;sun.shadow.camera.bottom=-36;
 sun.shadow.normalBias=.035;scene.add(sun);
 scene.add(new T.HemisphereLight(room?0xf1eee6:dark?0x737f96:dust?0xc5a98a:session.destination==="mars"?0xe0c8a9:0xb5bdcb,room?0x45505a:0x34302b,room?1.45:dark?.18:session.destination==="mars"?.83:.42));
 const foliage: T.Object3D[]=[];
 const batteryLights:T.MeshStandardMaterial[]=[];
 const lamps:T.PointLight[]=[];
 const solarPanels:T.Group[]=[];
 const doors=new Map<FacilityId,{mesh:T.Mesh;open:number}>();
 const markers=new Map<FacilityId,T.Object3D>();
 const kit:StructureKit={box,cylinder,dome,mesh,mat,light,glass,hull,trim,darkSteel,gold,glow,
   solarMat,green,soil,solarPanels,foliage,batteryLights,lamps};
 function nameplate(text:string,parent:T.Object3D,y:number){
   const label=document.createElement("canvas");label.width=512;label.height=128;
   const ctx=label.getContext("2d");if(!ctx)return;
   ctx.fillStyle="#111a1de6";ctx.fillRect(0,11,512,96);
   ctx.strokeStyle="#9caaa7";ctx.lineWidth=2;ctx.strokeRect(6,15,500,88);
   ctx.font="bold 35px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";
   ctx.fillStyle="#e1e7e4";ctx.fillText(text.toUpperCase(),256,61,470);
   const tex=new T.CanvasTexture(label);textures.push(tex);
   const sm=new T.SpriteMaterial({map:tex,depthTest:true,transparent:true});
   materials.push(sm);const sprite=new T.Sprite(sm);
   sprite.position.set(0,y,0);sprite.scale.set(3.6,.9,1);parent.add(sprite);
   return sprite;
 }
 if(!room){
   const surface=createRegolithMaterial(session.destination,55);materials.push(surface);
   // Terrain is level in the playable base; farther away it becomes
   // continuous, shadowed ridges and shallow impact basins.
   const planeGeo=new T.PlaneGeometry(230,230,88,88);
   const verts=planeGeo.attributes.position;
   for(let i=0;i<verts.count;i++){
     const x=verts.getX(i),z=-verts.getY(i);
     verts.setZ(i,outpostTerrainHeight(x,z));
   }
   planeGeo.computeVertexNormals();geometries.push(planeGeo);
   const ground=mesh(planeGeo,surface);ground.rotation.x=-Math.PI/2;ground.position.y=0;ground.receiveShadow=true;ground.castShadow=false;
   // Repeated rocks use instanced geometry to keep the mobile draw call count low.
   const rockGeo=new T.IcosahedronGeometry(1,1);geometries.push(rockGeo);
   const rockCount=320;
   const rocks=new T.InstancedMesh(rockGeo,mat(session.destination==="mars"?0x92715a:0x8b8881,.02,.97),rockCount);
   const dummy=new T.Object3D();
   for(let i=0;i<rockCount;i++){
     const a=i*2.39996,r=6+Math.sqrt(i)*3.25,x=Math.cos(a)*r,z=Math.sin(a)*r;
     // All matrices are initialized; keep rocks clear of the base paths.
     const hidden=Math.abs(x)<23&&Math.abs(z)<25;
     dummy.position.set(hidden?200+i:x,outpostTerrainHeight(x,z)+.06,hidden?200+i:z);
     dummy.rotation.set((i%7)*.15,a,(i%5)*.09);
     const width=.22+(i%11)*.11;dummy.scale.set(width,.12+(i%6)*.15,width*(.8+(i%3)*.29));
     dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);
     const shade=.77+(i%8)*.047;rocks.setColorAt(i,new T.Color().setRGB(shade,shade*.97,shade*.94));
   }
   rocks.instanceMatrix.needsUpdate=true;
   if(rocks.instanceColor)rocks.instanceColor.needsUpdate=true;
   rocks.castShadow=false;rocks.receiveShadow=true;world.add(rocks);
   // The same continuous, scanned-material heightfield forms the horizon.
   // Separate enlarged boulders would read as a ring of toy mountains and
   // introduce mismatched ground seams; distant relief is already in its vertices.
   // Scene constellations and distant Earth/Phobos.
   const starPositions=new Float32Array(900*3);
   for(let i=0;i<900;i++){const a=i*2.42,b=.08+(i%91)/100*Math.PI*.43,r=95;
     starPositions[i*3]=Math.cos(a)*Math.sin(b)*r;starPositions[i*3+1]=Math.cos(b)*r;starPositions[i*3+2]=Math.sin(a)*Math.sin(b)*r;
   }
   const starGeo=new T.BufferGeometry();geometries.push(starGeo);
   starGeo.setAttribute("position",new T.BufferAttribute(starPositions,3));
   const starMat=new T.PointsMaterial({color:0xc9e7ef,size:.19,sizeAttenuation:true,transparent:true,opacity:session.destination==="mars"?0:dark?.8:.28});materials.push(starMat);
   const stars=new T.Points(starGeo,starMat);scene.add(stars);
   // NASA Blue Marble Earth texture already preserved in this repository.
   // From the Moon, Earth is a real mapped globe instead of a flat blue orb.
   const planetMaterial=mat(session.destination==="moon"?0xffffff:0xd8a48e,.05,.85);
   if(session.destination==="moon"){
     const earth=new T.TextureLoader().load("/assets/planetary/earth-bluemarble-svs2915-1024-d1d3cb36ae6a.png");
     earth.colorSpace=T.SRGBColorSpace;textures.push(earth);
     planetMaterial.map=earth;planetMaterial.needsUpdate=true;
   }
   const planet=mesh(sphereGeom,planetMaterial);
   planet.scale.setScalar(session.destination==="moon"?2.3:.32);planet.position.set(48,35,-85);planet.castShadow=false;
   for(const f of BASE_FACILITIES){
     const group=new T.Group();group.position.set(f.x,0,f.z);
     const facing=Math.atan2(-f.x,-f.z);group.rotation.y=facing;world.add(group);
     nameplate(f.title,group,5.8);
     const goal=new T.Group();goal.position.set(0,.10,0);group.add(goal);
     const circleGeo=new T.RingGeometry(f.radius+.90,f.radius+1.04,48);
     geometries.push(circleGeo);
     const ring=mesh(circleGeo,glow,goal);ring.rotation.x=-Math.PI/2;ring.castShadow=false;
     markers.set(f.id,goal);
     externalProps.push(new T.Box3(new T.Vector3(f.x-f.radius*.72,.3,f.z-f.radius*.72),new T.Vector3(f.x+f.radius*.72,4.1,f.z+f.radius*.72)));
     // Each structure gets a genuine purpose-specific silhouette and details.
     // Only the airlock interface is consistent across the six designs.
     const leaf=buildDistinctExterior(f.id,kit,group,f);
     doors.set(f.id,{mesh:leaf,open:0});
     if(f.id==="habitat")referenceAssets.push(attachRealismModel(group,"habitat",{extent:6.8,position:[0,.1,-1.1],rotation:[0,Math.PI,0],onLoad:model=>{
       // Reuse the engineered pressure-vessel geometry, with original neutral
       // thermal finishes. NASA identifiers on source maps are not displayed
       // on the fictional Alpha/Nova base.
       model.traverse(object=>{if(!(object instanceof T.Mesh))return;
         const mats=Array.isArray(object.material)?object.material:[object.material];
         for(const material of mats)if(material instanceof T.MeshStandardMaterial){
           if(material.map){textures.push(material.map);material.map=null;}
           material.color.set(0xc7c7bc);material.roughness=.72;material.metalness=.12;material.needsUpdate=true;
         }
       });
       (leaf.userData.pressureBody as T.Group).visible=false;
     }}));
   }
   // A genuine self-hosted science rover is parked off the marked routes.
   referenceAssets.push(attachRealismModel(world,"rover",{extent:3.6,position:[8,0,0],rotation:[0,-.7,0],onLoad:model=>{
     world.updateMatrixWorld(true);externalProps.push(new T.Box3().setFromObject(model));
   }}));
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
   const floor=box(world,9,.4,9,0,-.21,0,mat(0x636965,.06,.86));
   const greenhouseRoof=mat(0xb7c6b4,.15,.24);
   if(room==="greenhouse"){greenhouseRoof.transparent=true;greenhouseRoof.opacity=.22;greenhouseRoof.depthWrite=false;}
   const roof=box(world,9,.35,9,0,4.0,0,room==="greenhouse"?greenhouseRoof:hull);
   roof.castShadow=room!=="greenhouse";
   const wall=mat(room==="shield"?0x777972:0xc1c3b9,.15,.78);
   if(metalDetail){wall.map=metalDetail;wall.needsUpdate=true;}
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
     box(world,.025,.015,8,-4+i*1.55,.016,0,rubber);
     box(world,8,.015,.025,0,.015,-4+i*1.55,rubber);
   }
   const control=box(world,3.1,1.2,.9,0,.85,-2.85,darkSteel);
   box(world,2.75,.10,.7,0,1.55,-2.85,gold);
   const panel=box(world,2.48,1.2,.08,0,2.25,-3.16,glass);
   // Glowing console status indicators.
   const readout=facilityDisplay(room,session.oxygen,session.water,session.battery);
   const screenMaterial=mat(0xffffff,.02,.62,0xffffff,.42);
   if(readout){textures.push(readout);screenMaterial.map=readout;screenMaterial.emissiveMap=readout;}
   const screen=box(world,2.5,1.25,.065,0,2.27,-3.06,screenMaterial);
   screen.rotation.x=-.07;
   for(let i=0;i<8;i++)box(world,.13,.07,.12,(i%4-1.5)*.5,1.61,-2.36,i%3?glow:red);
   for(let i=0;i<4;i++)box(world,.8,2.4,.85,(i%2?1:-1)*3.3,1.45,-2.4+i*1.4,darkSteel);
   for(const x of [-2.65,2.65]){
     box(world,.24,.08,6.6,x,3.72,0,mat(0xf0ece2,.05,.6,0xf0e4cc,1.2));
   }
   for(const z of [-2.2,2.2])lamps.push(light(world,0,3.35,z,room==="greenhouse"?0xe6f1dc:0xffefdb,2.6,8));
   // Every room now contains equipment appropriate to that facility.
   furnishDistinctInterior(room,kit,world);
   if(room==="recycle"||room==="solar"||room==="battery")referenceAssets.push(attachRealismModel(world,"equipment",{extent:1.6,position:[-3.15,.05,2.55],rotation:[0,Math.PI/2,0],onLoad:model=>{world.updateMatrixWorld(true);externalProps.push(new T.Box3().setFromObject(model));}}));
   if(room==="habitat"){
     for(const [x,z,color] of [[CREW_BED.x,CREW_BED.z,0x9dd4fc],[CREW_DINING.x,CREW_DINING.z,0xe6d7a0]]){
       const markerMat=mat(color,.18,.35,color,.45);
       const marker=box(world,.75,.045,.75,x,.055,z,markerMat);
       marker.castShadow=false;
       lamps.push(light(world,x,2.6,z,color,1.25,4.5));
     }
   }
 }
 // Gather the large opaque static structures once for third-person camera
 // obstruction tests. Ray/box tests are far cheaper than raycasting every
 // triangle of each machine on every animation frame.
 const cameraSolids:T.Box3[]=externalProps;
 if(room){
  world.updateMatrixWorld(true);
  world.traverse(o=>{
   if(!(o instanceof T.Mesh))return;
   const mat=o.material;
   if(mat instanceof T.MeshStandardMaterial&&(mat.transparent||mat.emissiveIntensity>1))return;
   const bounds=new T.Box3().setFromObject(o);
   const dims=new T.Vector3();bounds.getSize(dims);
   if(dims.x<.30||dims.y<.23||dims.z<.12)return;
   if(bounds.max.y<.45||bounds.min.y>3.7)return;
   cameraSolids.push(bounds);
  });
 }
 const astro=new T.Group();world.add(astro);
 // Layered expedition suit, visible from the third-person camera.
 const suit=createTechnicalMaterial("fabric",0xe8e9dd),visor=mat(0x19374b,.62,.13,0x28485b,.35),
   suitDark=mat(0x344b59,.4,.58),fabric=mat(0xc1c9c6,.09,.92),
   harness=mat(0x67757a,.36,.59),suitBlue=mat(0x28648a,.4,.46);
 const visorGlass=new T.MeshPhysicalMaterial({color:0x244455,metalness:.55,roughness:.09,clearcoat:1,clearcoatRoughness:.08});
 materials.push(suit,visorGlass);
 const torso=mesh(new T.CapsuleGeometry(.37,.54,5,12),suit,astro);geometries.push(torso.geometry);
 torso.position.y=1.24;
 const helmet=mesh(sphereGeom,suit,astro);helmet.position.y=2.05;helmet.scale.set(.37,.38,.37);
 const shield=mesh(sphereGeom,visorGlass,astro);shield.position.set(0,2.08,-.17);shield.scale.set(.30,.26,.23);
 const rimGeo=new T.TorusGeometry(.29,.029,8,30);geometries.push(rimGeo);
 const rim=mesh(rimGeo,gold,astro);rim.position.set(0,2.07,-.34);rim.scale.y=.91;
 const collarGeo=new T.TorusGeometry(.39,.072,8,20);geometries.push(collarGeo);
 const collar=mesh(collarGeo,harness,astro);collar.rotation.x=Math.PI/2;collar.position.set(0,1.78,0);
 // Pressure pack, oxygen tanks, suit harness and status instrumentation.
 box(astro,.70,1.03,.40,0,1.38,.53,trim);
 box(astro,.56,.69,.06,0,1.43,.75,fabric);
 for(const side of [-1,1]){
   cylinder(astro,.13,.72,side*.26,1.40,.82,hull,12);
   box(astro,.11,.93,.13,side*.36,1.43,.29,harness);
   box(astro,.18,.25,.25,side*.43,1.69,0,suitBlue);
 }
 box(astro,.47,.17,.12,0,1.49,-.38,suitBlue);
 for(let i=0;i<3;i++)box(astro,.075,.065,.025,-.12+i*.12,1.49,-.45,i===2?red:glow);
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
   box(leg,.34,.095,.47,0,-.76,-.18,rubber);
   box(leg,.30,.12,.28,0,-.43,-.08,harness);
   limbs.push(leg);
 }
 // Equipment accent remains available as a low-cost loading fallback.
 box(astro,.42,.16,.09,0,1.43,-.36,glow);
 const suitFallback=[...astro.children];
 let referenceSuit:ReturnType<typeof rigAstronautModel>|null=null;
 referenceAssets.push(attachRealismModel(astro,"astronaut",{extent:2.3,rotation:[0,Math.PI,0],onLoad:model=>{
   const size=new T.Box3().setFromObject(model).getSize(new T.Vector3());
   const adjust=2.25/Math.max(.1,size.y);model.scale.multiplyScalar(adjust);model.position.multiplyScalar(adjust);
   referenceSuit=rigAstronautModel(model);referenceSuit.update(0,0);
   suitFallback.forEach(object=>object.visible=false);
 }}));
 const releaseBatches=batchOutpostStructure(world,[astro,...[...doors.values()].map(d=>d.mesh),...[...markers.values()],...solarPanels,...foliage,...(doors.get("habitat")?.mesh.userData.pressureBody?[doors.get("habitat")!.mesh.userData.pressureBody as T.Group]:[])]);
 const camera=new T.PerspectiveCamera(59,1,.12,250);
 const dispose=()=>{
   referenceSuit?.dispose();referenceAssets.forEach(asset=>asset.dispose());
   releaseBatches();
   world.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.InstancedMesh){o.geometry.dispose();}});
   materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());geometries.forEach(g=>g.dispose());
 };
 return {scene,camera,astro,limbs,doors,markers,solarPanels,foliage,lamps,batteryLights,cameraSolids,updateReferenceSuit:(time:number,speed:number)=>referenceSuit?.update(time,speed),dispose};
}
export default function World3D({session,room,graphics,blocked,movement,lookDelta,spawn,interactSeq,target,onEnter,onConsole,onRoutine,onNear,onPosition,onError}:Props){
 const host=useRef<HTMLDivElement>(null);
 const latest=useRef({session,blocked,onEnter,onConsole,onRoutine,onNear,onPosition,onError,interactSeq,target});
 latest.current={session,blocked,onEnter,onConsole,onRoutine,onNear,onPosition,onError,interactSeq,target};
 useEffect(()=>{
   const container=host.current;if(!container)return;
   let renderer:T.WebGLRenderer;
   try{renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:"high-performance"});}
   catch{latest.current.onError("3D graphics could not start. Enable WebGL in your browser.");return;}
   let preferences;try{preferences=readPreferences(localStorage);}catch{preferences=readPreferences();}
   preferences={...preferences,graphics};
   const scene=createScene(latest.current.session,room);
   const bounds=graphicsRatioBounds(window.devicePixelRatio||1,preferences.graphics);
   let pixelRatio=bounds.limit;renderer.setPixelRatio(pixelRatio);
   renderer.shadowMap.enabled=preferences.graphics!=="battery";renderer.shadowMap.type=T.PCFSoftShadowMap;
   renderer.outputColorSpace=T.SRGBColorSpace;
   renderer.toneMapping=T.ACESFilmicToneMapping;
   renderer.toneMappingExposure=1.0;
   const pmrem=new T.PMREMGenerator(renderer),lightingRoom=new RoomEnvironment();
   const lighting=pmrem.fromScene(lightingRoom,.04, .1, 30);
   scene.scene.environment=lighting.texture;scene.scene.environmentIntensity=room?.42:.28;
   lightingRoom.dispose();pmrem.dispose();
   container.appendChild(renderer.domElement);
   renderer.domElement.className="jm-world-canvas";
   const initial=spawn.current;
   const player:Point2={...initial.position};
   const state={position:player,yaw:initial.yaw,pitch:initial.pitch,open:null as FacilityId|null,openAt:0};
   // Restore the avatar's visible facing direction immediately, not only
   // after walking. After a door exit the astronaut must face away from it.
   scene.astro.rotation.y=Math.atan2(-Math.sin(initial.yaw),-Math.cos(initial.yaw))-Math.PI;
   const keys=new Set<string>();
   let lookPointer:number|null=null,px=0,py=0;
   let previous=performance.now(),frame=0,alive=true,lastPrompt="",lastInteraction=latest.current.interactSeq;
   let entered=false,lastBattery=-1,lastReported=0,cameraInitialized=false;
   let gait=0,smoothedSpeed=0,sampleStart=performance.now(),sampleFrames=0,measuredFps:number|null=null;
   let interactRequest=false;
   const down=(e:KeyboardEvent)=>{if(latest.current.blocked)return;const k=e.key.toLowerCase();
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
       if(room==="habitat"){
         const routine=nearHabitatRoutine(state.position);
         if(routine){latest.current.onRoutine(routine);return;}
       }
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
     // Buttons may own a separate touch contact while the movement joystick is
     // held. Their drag deltas are consumed by the SAME 3D camera.
     const pendingLook=lookDelta.current;
     state.yaw+=pendingLook.yaw;
     state.pitch=Math.max(-.15,Math.min(.52,state.pitch+pendingLook.pitch));
     pendingLook.yaw=0;pendingLook.pitch=0;
     const isBlocked=latest.current.blocked;
     const motion=isBlocked?{x:0,y:0,run:false}:movement.current||{x:0,y:0,run:false};
     const right=isBlocked?0:Number(keys.has("d")||keys.has("arrowright"))-Number(keys.has("a")||keys.has("arrowleft"));
     const front=isBlocked?0:Number(keys.has("w")||keys.has("arrowup"))-Number(keys.has("s")||keys.has("arrowdown"));
     const x=Math.max(-1,Math.min(1,motion.x+right)),y=Math.max(-1,Math.min(1,motion.y+front));
     const running=!isBlocked&&(motion.run||keys.has("shift"));
     const next=walkStep(state.position,state.yaw,x,y,dt*(running?1.43:1),Boolean(room),state.open);
     if(!room){const dx=next.x-8,dz=next.z,r=Math.hypot(dx,dz);
       if(r<2.15){next.x=8+(r>.001?dx/r:1)*2.15;next.z=(r>.001?dz/r:0)*2.15;}}
     state.position.x=next.x;state.position.z=next.z;
     if(now-lastReported>250){
       lastReported=now;
       if(!room)latest.current.onPosition({x:state.position.x,z:state.position.z});
     }
     const speed=Math.min(1,Math.hypot(x,y));
     smoothedSpeed+=(speed-smoothedSpeed)*(1-Math.exp(-dt*9));
     // Exterior gait reflects reduced gravity without altering mission travel
     // distances. A slow lunar lope and restrained Martian step replace a
     // fast terrestrial swing; idle motion is only a subtle suit breath.
     const lunar=!room&&data.destination==="moon";
     gait+=dt*(room?7.6:lunar?4.8:6.3)*(running?1.25:1)*Math.max(.12,smoothedSpeed);
     const lift=lunar?.095:room?.023:.045;
     const bob=Math.pow(Math.sin(gait),2)*lift*smoothedSpeed+Math.sin(now*.0018)*.003;
     scene.astro.position.set(state.position.x,bob,state.position.z);
     if(speed>.04){const facing=Math.atan2(-Math.sin(state.yaw)*y+Math.cos(state.yaw)*x,-Math.cos(state.yaw)*y-Math.sin(state.yaw)*x)-Math.PI;
       const turn=Math.atan2(Math.sin(facing-scene.astro.rotation.y),Math.cos(facing-scene.astro.rotation.y));
       scene.astro.rotation.y+=turn*(1-Math.exp(-dt*10));}
     scene.updateReferenceSuit(gait/6,smoothedSpeed);
     scene.limbs.forEach((limb,i)=>{const side=i<2?-1:1,isLeg=i%2===1;
       limb.rotation.x=Math.sin(gait+(isLeg?0:Math.PI))*side*(isLeg?.36:.25)*smoothedSpeed;
       limb.rotation.z=isLeg?0:side*.065;});
     // Collision-aware 3rd-person camera: every indoor position stays below
     // the ceiling and inside the room shell, with no wall/console clipping.
     const back=new T.Vector3(Math.sin(state.yaw),0,Math.cos(state.yaw));
     const focus=new T.Vector3(state.position.x,1.54+state.pitch*.2,state.position.z);
     const wanted=new T.Vector3(
       state.position.x+back.x*(room?3.3:6.2),
       (room?2.92:3.4)+state.pitch*(room?2.0:4),
       state.position.z+back.z*(room?3.3:6.2));
     const capped=room?confinedInteriorCamera(wanted):wanted;
     const desired=new T.Vector3(capped.x,capped.y,capped.z);
     if(scene.cameraSolids.length){
       const vec=desired.clone().sub(focus);
       const length=vec.length();
       if(length>.01){
         const ray=new T.Ray(focus,vec.normalize());
         let safe=length;
         const hit=new T.Vector3();
         for(const wall of scene.cameraSolids){
           if(wall.containsPoint(focus))continue;
           if(ray.intersectBox(wall,hit)){
             const dist=hit.distanceTo(focus);
             if(dist>.48&&dist<safe)safe=Math.max(.58,dist-.26);
           }
         }
         if(safe<length)desired.copy(focus).addScaledVector(vec,safe);
       }
     }
     if(!cameraInitialized){scene.camera.position.copy(desired);cameraInitialized=true;}
     else scene.camera.position.lerp(desired,Math.min(1,dt*(room?11:8)));
     scene.camera.lookAt(focus);
     if(isBlocked){
       // An overlay owns input; do not execute a queued second INTERACT
       // or complete an old airlock crossing behind its controls.
       lastInteraction=latest.current.interactSeq;
       interactRequest=false;
     }else if(latest.current.interactSeq!==lastInteraction || interactRequest){
       lastInteraction=latest.current.interactSeq;interactRequest=false;interact();
     }
     // Render physical airlock slide and require walking across the doorway.
     for(const [id,gate] of scene.doors){
       const shouldOpen=state.open===id;
       const goal=shouldOpen?1:0;
       gate.open+=(goal-gate.open)*(1-Math.exp(-dt*6));
       gate.mesh.position.x=gate.open*1.9;
     }
     if(!isBlocked&&state.open&&now-state.openAt>350&&!entered){
       if(room){
         if(state.position.z>4.05){entered=true;
             latest.current.onEnter(null,{position:{...state.position},yaw:state.yaw,pitch:state.pitch});return;}
       }else if(doorwayCrossed(state.position,state.open)){
         entered=true;
         latest.current.onEnter(state.open,{position:{...state.position},yaw:state.yaw,pitch:state.pitch});return;
       }
     }
     const routine=room==="habitat"?nearHabitatRoutine(state.position):null;
     const near:Proximity=room?
       routine==="meal"?{kind:"meal",id:"habitat",title:data.breakfastSol!==data.sol?"EAT BREAKFAST":data.dinnerSol!==data.sol?"EAT DINNER":"DINING AREA"}:
       routine==="sleep"?{kind:"sleep",id:"habitat",title:"SLEEP IN CREW BED"}:
       nearConsole(state.position)?{kind:"console",id:room,title:"OPERATE "+room.toUpperCase()}:
       nearExit(state.position)?{kind:"exit",id:room,title:state.open?"EXIT THROUGH AIRLOCK":"OPEN EXIT AIRLOCK"}:null
       :(()=>{const f=nearestDoor(state.position,2.5);return f?{kind:"door",id:f.id,title:state.open===f.id?"AIRLOCK OPEN · WALK INSIDE":"OPEN "+f.title.toUpperCase()+" AIRLOCK"}:null;})();
     const label=near?near.title:"";
     if(label!==lastPrompt){lastPrompt=label;latest.current.onNear(near);}
     // Light the current mission target on the actual 3D terrain.
     scene.markers.forEach((o,id)=>{o.visible=id===latest.current.target;o.rotation.y+=dt*.18;});
     // Make the environment react immediately to the actual game resources.
     const power=data.battery/100;
     if(Math.round(data.battery)!==lastBattery){
       lastBattery=Math.round(data.battery);
       scene.lamps.forEach(l=>l.intensity=power<.08?.35:power<.22?1.05:2.6);
       scene.batteryLights.forEach(m=>m.emissiveIntensity=power<.08?.08:power<.22?.25:.75);
     }
     scene.foliage.forEach((o,i)=>{const growth=Math.max(.2,.35+data.crop/75);
       o.scale.setScalar(growth*(.93+(i%3)*.05));});
     scene.solarPanels.forEach((o,i)=>o.rotation.y=Math.sin(now*.00012+i*.28)*.14);
     sampleFrames++;
     if(now-sampleStart>2500){
       measuredFps=sampleFrames*1000/(now-sampleStart);sampleFrames=0;sampleStart=now;
       const nextRatio=adaptiveGraphicsRatio(pixelRatio,bounds,measuredFps,30);
       if(nextRatio!==pixelRatio){pixelRatio=nextRatio;renderer.setPixelRatio(pixelRatio);resize();}
       publishGraphicsTrace(renderer.domElement,{preset:preferences.graphics,deviceRatio:window.devicePixelRatio||1,ratio:pixelRatio,...bounds,measuredFps,targetFps:30});
     }
     renderer.render(scene.scene,scene.camera);
     frame=requestAnimationFrame(animate);
   };
   frame=requestAnimationFrame(animate);
   return ()=>{alive=false;cancelAnimationFrame(frame);ro.disconnect();release();
     document.removeEventListener("keydown",down);document.removeEventListener("keyup",up);window.removeEventListener("blur",release);
     renderer.domElement.removeEventListener("pointerdown",pointerDown);renderer.domElement.removeEventListener("pointermove",pointerMove);
     renderer.domElement.removeEventListener("pointerup",pointerEnd);renderer.domElement.removeEventListener("pointercancel",pointerEnd);
     lighting.dispose();scene.dispose();renderer.dispose();renderer.domElement.remove();
   };
 },[room,graphics,movement,lookDelta,spawn]);
 return <div className="jm-world-host" ref={host} role="img" aria-label={"Walkable three-dimensional "+session.destination+" research outpost. Move with left joystick or WASD, drag to look, and press interact at airlocks and control panels."}/>;
}

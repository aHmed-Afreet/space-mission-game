import * as THREE from "three";
import type { StoryScenario, Station } from "./storyScenarios";
import {createHistoricVehicle,historicReferenceKey} from "./historicVehicles";
import { attachRealismModel } from "../presentation/realismAssets";
import { readPreferences, defaultPreferences } from "../commander/campaign/preferences";
import { graphicsRatioBounds } from "../commander/graphicsPolicy";
import {makePlanet,planetKind} from "../commander/celestial";
import {installStoryBridge} from "./storyBridge";
import { storyPixelRatio } from "./storyRuntime";
import { storyPresentation } from "../presentation/missionPresentation";
import { disposeObjectResources } from "../presentation/resources";
import { createEvaGloves } from "../presentation/evaGloves";
import { installSurfaceScenery } from "../commander/campaign/surfaceScenery";
import { storyArchitecture, storyPalette } from "./storyArchitecture";
import { storyInstrumentMaterial } from "./storyInstruments";
import { cabinStep } from "./storyCollision";
import { applyInteriorPbr, type InteriorQuality } from "../presentation/interiorAssets";
import { fabricationMaterials, consoleHousing, formedPanel, route, gauge, finishFabrication } from "./storyFabrication";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const stationLocations:Record<Station,[number,number]>={
 brief:[-3,2.5],systems:[3,2.5],operations:[-3,-2.5],science:[3,-2.5],
};
type Material=THREE.MeshStandardMaterial;
const aluminum=()=>new THREE.MeshStandardMaterial({color:0x99b0b7,metalness:.75,roughness:.34});
const accent=()=>new THREE.MeshStandardMaterial({color:0xe3b55b,metalness:.62,roughness:.33});
const ceramic=()=>new THREE.MeshStandardMaterial({color:0xf0f2eb,metalness:.2,roughness:.58});
const dark=()=>new THREE.MeshStandardMaterial({color:0x343c3e,metalness:.36,roughness:.59});
function piece(group:THREE.Group,shape:THREE.BufferGeometry,mat:Material,x:number,y:number,z:number,rotX=0,rotY=0,rotZ=0){
 const obj=new THREE.Mesh(shape,mat);obj.position.set(x,y,z);obj.rotation.set(rotX,rotY,rotZ);
 obj.castShadow=false;obj.receiveShadow=true;group.add(obj);return obj;
}
function box(g:THREE.Group,w:number,h:number,d:number,m:Material,x=0,y=0,z=0){
 return piece(g,new THREE.BoxGeometry(w,h,d),m,x,y,z);
}
function cyl(g:THREE.Group,r1:number,r2:number,h:number,m:Material,x=0,y=0,z=0,rx=0,ry=0,rz=0){
 return piece(g,new THREE.CylinderGeometry(r1,r2,h,18),m,x,y,z,rx,ry,rz);
}
function sphere(g:THREE.Group,r:number,m:Material,x=0,y=0,z=0){
 return piece(g,new THREE.SphereGeometry(r,18,14),m,x,y,z);
}
function beam(g:THREE.Group,a:THREE.Vector3,b:THREE.Vector3,r:number,m:Material){
 const delta=b.clone().sub(a),mid=a.clone().add(b).multiplyScalar(.5);
 const mesh=cyl(g,r,r,delta.length(),m,mid.x,mid.y,mid.z);
 mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return mesh;
}
function badge(text:string){
 const c=document.createElement("canvas");c.width=512;c.height=128;
 const ctx=c.getContext("2d");if(!ctx)return null;
 ctx.fillStyle="#242b2c";ctx.fillRect(0,0,512,128);
 ctx.strokeStyle="#77827e";ctx.lineWidth=3;ctx.strokeRect(3,3,506,122);
 ctx.fillStyle="#e2e3da";ctx.font="bold 25px Arial";ctx.textAlign="center";
 ctx.fillText(text,256,79,486);
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
 const mat=new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide});
 return new THREE.Mesh(new THREE.PlaneGeometry(2.35,.58),mat);
}
export function createStoryScene(scenario:StoryScenario,quality:InteriorQuality="balanced"){
 const scene=new THREE.Scene();
 const presentation=storyPresentation(scenario);
 scene.userData.presentation=presentation;
 const inField=presentation.playerContext==="surface";
 const sky=inField&&scenario.setting==="mars"?0x422b28:0x000000;
 scene.background=new THREE.Color(sky);
 scene.fog=scenario.setting==="mars"?new THREE.FogExp2(sky,.006):null;
 scene.add(new THREE.HemisphereLight(0xd8ded9,inField?0x181717:0x43556a,inField?.52:1.75));
 const sun=new THREE.DirectionalLight(0xfff4d4,2.7);sun.position.set(-8,13,-6);scene.add(sun);
 const architecture=storyArchitecture(scenario),palette=storyPalette[architecture];
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.MeshStandardMaterial({color:palette.floor,metalness:.16,roughness:.86}));
 floor.rotation.x=-Math.PI/2;floor.position.y=-.08;scene.add(floor);
 const deck=new THREE.Group();scene.add(deck);
 installStoryBridge(deck,scenario);
 const reconstruction=badge(palette.label);
 if(reconstruction){reconstruction.position.set(0,3.15,-6.43);reconstruction.scale.set(1.4,.48,1);deck.add(reconstruction);}
 if(scenario.role==="astronaut"){
  if(inField){
   // The cabin stays a cabin before egress. Geology beyond the forward windows
   // belongs to this deck and disappears together with it on an excursion.
   const panorama=new THREE.Group();panorama.position.z=-36;deck.add(panorama);
   installSurfaceScenery(panorama,scenario.setting==="mars"?"mars":"moon",[],"battery");
  }else{
   const planet=makePlanet(planetKind(scenario.destination),7);
   planet.position.set(17,14,-32);deck.add(planet);
  }
 }

 const stationMeshes:Record<Station,THREE.Group>={} as Record<Station,THREE.Group>;
 const taskTitles:Record<Station,string>={
   brief:"MISSION BRIEF",
   systems:scenario.profile.hardware,
   operations:scenario.profile.operation,
   science:scenario.profile.observation,
 };
 (Object.keys(stationLocations) as Station[]).forEach((id,i)=>{
  const [x,z]=stationLocations[id];
  const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);stationMeshes[id]=g;
  const fabrication=new THREE.Group();g.add(fabrication);
  const materials=fabricationMaterials(architecture);
  consoleHousing(fabrication,2.14,materials,architecture);
  // Instrumentation belongs inside the sloping housing rather than a monitor
  // standing on a second cabinet. The same station remains at the same target.
  const face=new THREE.Group();face.position.set(0,1.91,.04);face.rotation.x=-.29;fabrication.add(face);
  const bezel=formedPanel(face,1.94,.91,.042,.1,materials.trim);
  formedPanel(face,1.81,.79,.025,.055,materials.dark,0,0,.028);
  const display=new THREE.Mesh(new THREE.PlaneGeometry(1.68,.67),storyInstrumentMaterial(scenario,id));
  display.position.z=.065;display.name="Historical live "+id+" display";face.add(display);
  // The analogous controls have physical bezels, rotary knobs and toggle
  // guards, with compact era-appropriate graphics behind the machined fascia.
  for(const side of[-1,1])for(const y of[-.34,.34]){
   const screw=new THREE.Mesh(new THREE.CircleGeometry(.017,8),materials.structure);screw.position.set(side*.9,y,.07);face.add(screw);
  }
  for(let k=0;k<7;k++){
   const x=-.83+k*.277;
   const rotary=new THREE.Mesh(new THREE.CylinderGeometry(.036,.044,.057,12),k%3===0?materials.warning:materials.trim);
   rotary.position.set(x,1.39,.43);fabrication.add(rotary);
   const indicator=formedPanel(fabrication,.008,.033,.009,.002,materials.shell,x,1.426,.43);indicator.rotation.x=-Math.PI/2;
  }
  if(architecture==="apollo"||architecture==="early-capsule"){
   for(let k=0;k<3;k++)gauge(fabrication,-.64+k*.64,.91,.77,.115,materials.structure,materials.dark,[-.6,.4,1.1][k]);
  }else{
   const legend=formedPanel(fabrication,1.63,.26,.017,.05,materials.fabric,0,.96,.64);legend.rotation.x=.09;
   for(let k=0;k<4;k++)formedPanel(fabrication,.22,.025,.018,.007,k===0?materials.warning:materials.trim,-.51+k*.34,.96,.658);
  }
  const tag=badge(taskTitles[id].toUpperCase().slice(0,38));if(tag){tag.position.set(0,2.57,-.33);tag.scale.set(.9,.45,1);g.add(tag);}
  finishFabrication(fabrication);
  // A discreet floor marker retains the existing target/active-state feedback.
  const halo=new THREE.Mesh(new THREE.TorusGeometry(1.2,.012,4,48),new THREE.MeshBasicMaterial({color:i%2?0x879797:0xa4b6a1}));
  halo.rotation.x=Math.PI/2;halo.position.y=.02;g.add(halo);
 });
 // Distinctive historic-vehicle equipment instead of a uniform generic simulator.
 // These are recognizable low-poly training interpretations, not museum-accurate plans.
 if(scenario.family==="lunar"){
   const lmPanel=new THREE.Group();lmPanel.position.set(0,0,-5.9);deck.add(lmPanel);
   const lmMaterials=fabricationMaterials(architecture);consoleHousing(lmPanel,2.45,lmMaterials,architecture);
   const lmGuidance=new THREE.Mesh(new THREE.PlaneGeometry(2.14,.72),storyInstrumentMaterial(scenario,"operations"));lmGuidance.position.set(0,1.91,.09);lmGuidance.rotation.x=-.29;lmPanel.add(lmGuidance);
   for(let i=0;i<6;i++)box(lmPanel,.2,.22,.075,i%2?accent():aluminum(),-1+i*.4,1.95,-.16);
   for(const x of [-.65,.65])box(lmPanel,.55,.48,.09,new THREE.MeshStandardMaterial({color:0x3c7392,emissive:0x133246}),x,1.1,-.19);
   if(/Apollo 15|Apollo 17/.test(scenario.title)){
     const sampleRack=new THREE.Group();sampleRack.position.set(5.1,0,-4.8);deck.add(sampleRack);
     box(sampleRack,.8,1.2,.7,aluminum(),0,.65,0);
     for(let i=0;i<3;i++)cyl(sampleRack,.12,.12,.46,ceramic(),-.25+i*.25,1.48,0);
   }
 }
 if(scenario.family==="gemini"||scenario.family==="capsule"||scenario.family==="apollo"||scenario.family==="sphere"){
   const console=new THREE.Group();console.position.set(0,0,-5.55);deck.add(console);
   const flightMaterials=fabricationMaterials(architecture);consoleHousing(console,2.9,flightMaterials,architecture);
   const flightInstruments=new THREE.Mesh(new THREE.PlaneGeometry(2.66,.76),storyInstrumentMaterial(scenario,"operations"));flightInstruments.position.set(0,1.91,.09);flightInstruments.rotation.x=-.29;console.add(flightInstruments);
   for(let i=0;i<13;i++){const x=-1.32+(i%7)*.41,y=1.15+Math.floor(i/7)*.36;
     cyl(console,.075,.075,.04,i%3===0?accent():aluminum(),x,y,-.39,Math.PI/2);}
   if(scenario.family==="gemini")for(const side of [-1,1]){
     box(console,.65,.5,.65,ceramic(),side*1.1,.48,1.2);
   }
 }
 if(scenario.family==="shuttle"){
   const flightdeck=new THREE.Group();flightdeck.position.set(0,0,-5.7);deck.add(flightdeck);
   const orbiterMaterials=fabricationMaterials(architecture);consoleHousing(flightdeck,3.5,orbiterMaterials,architecture);
   const flightInstruments=new THREE.Mesh(new THREE.PlaneGeometry(3.24,.76),storyInstrumentMaterial(scenario,"operations"));flightInstruments.position.set(0,1.91,.09);flightInstruments.rotation.x=-.29;flightdeck.add(flightInstruments);
   for(let i=0;i<8;i++)box(flightdeck,.17,.09,.17,accent(),-1.3+i*.37,.92,-.45);
 }
 if(scenario.family==="rover"){
   const roboticBay=new THREE.Group();roboticBay.position.set(0,0,-5.8);deck.add(roboticBay);
   const controlMaterials=fabricationMaterials(architecture);consoleHousing(roboticBay,3.3,controlMaterials,architecture);
   const roverInstruments=new THREE.Mesh(new THREE.PlaneGeometry(3.02,.76),storyInstrumentMaterial(scenario,"science"));roverInstruments.position.set(0,1.91,.09);roverInstruments.rotation.x=-.29;roboticBay.add(roverInstruments);
 }
 const craft=createHistoricVehicle(scenario);
 craft.position.set(0,4,-15);craft.rotation.y=.4;
 const scale=scenario.family==="station"?.8:scenario.family==="shuttle"?.85:scenario.family==="lunar"?.9:1.04;
 craft.scale.setScalar(scale);scene.add(craft);
 const references:{dispose():void}[]=[],referenceKey=historicReferenceKey(scenario);
 const installReference=(owner:THREE.Group)=>{
  if(!referenceKey)return;
  const fallback=[...owner.children];
  const floorLander=owner!==craft&&referenceKey==="lander"&&inField;
  references.push(attachRealismModel(owner,referenceKey,{position:floorLander?[0,-owner.position.y/owner.scale.y,0]:undefined,extent:referenceKey==="station"?12:referenceKey==="probe"?9:referenceKey==="shuttle"?7.5:4.8,centered:!floorLander,shadows:false,onLoad:()=>{
   // Retain the authored silhouette until the real, locally hosted model exists.
   for(const part of fallback)part.visible=false;
   owner.userData.vehicleSource="NASA reference model / educational reconstruction";
  }}));
 };
 installReference(craft);
 if(scenario.family==="shuttle"||scenario.family==="station"){
  // Real orbital replaceable-unit hardware adds textured maintenance detail;
  // these props have no gameplay collider and do not assert a flight procedure.
  for(const side of [-1,1])references.push(attachRealismModel(deck,"equipment",{extent:1.4,position:[side*4.85,.3,-4.65],rotation:[0,side*Math.PI/2,0],shadows:false}));
 }
 if(scenario.role==="mission operator")references.push(attachRealismModel(deck,"controlRoom",{extent:17,position:[0,0,-16],shadows:false}));
 let exteriorReferenceLoaded=false;
 const loadExteriorReference=()=>{if(exteriorReferenceLoaded)return;exteriorReferenceLoaded=true;installReference(outerCraft);};
 // Pressure hatch: one control on the cabin side and one on the EVA side.
 const hatchAssembly=new THREE.Group();hatchAssembly.position.set(0,0,7.35);scene.add(hatchAssembly);
 const hatchMaterials=fabricationMaterials(architecture);
 // Rounded pressure leaf, recessed seal, dogged handle and a real viewport;
 // the interactive panel stays at precisely the existing reach/aim coordinates.
 formedPanel(hatchAssembly,2.32,2.82,.16,.34,hatchMaterials.structure,0,1.38,0);
 formedPanel(hatchAssembly,2.02,2.57,.19,.30,hatchMaterials.dark,0,1.38,-.015);
 formedPanel(hatchAssembly,1.84,2.38,.20,.27,hatchMaterials.shell,0,1.38,-.025);
 const hatchWindow=new THREE.Mesh(new THREE.CircleGeometry(.21,32),new THREE.MeshStandardMaterial({color:0x152c31,roughness:.2,metalness:.22}));hatchWindow.position.set(0,1.94,-.14);hatchWindow.rotation.y=Math.PI;hatchAssembly.add(hatchWindow);
 for(const side of[-1,1])route(hatchAssembly,[[side*.64,1.15,-.15],[side*.57,1.28,-.23],[side*.57,1.55,-.23],[side*.64,1.68,-.15]],.035,hatchMaterials.structure,18);
 for(const z of[-.26,.26]){
  formedPanel(hatchAssembly,.29,.42,.11,.045,hatchMaterials.trim,.84,1.36,z);
  formedPanel(hatchAssembly,.12,.21,.12,.025,hatchMaterials.warning,.84,1.36,z+Math.sign(z)*.025);
 }
 finishFabrication(hatchAssembly);
 hatchAssembly.visible=scenario.role==="astronaut";
 const exterior=new THREE.Group();scene.add(exterior);exterior.visible=false;
 const dusty=inField;
 const isMars=scenario.setting==="mars";
 if(dusty){
  // Shared deterministic geology keeps scales and lunar illumination coherent.
  // This layer owns visuals only; hatch range and movement bounds stay unchanged.
  installSurfaceScenery(exterior,isMars?"mars":"moon",[{x:0,z:10},{x:0,z:17}],"balanced");
 }else{
  // A large textured Earth for low-Earth orbit; other destinations have their own globe.
  const planet=makePlanet(planetKind(scenario.destination),18);
  planet.position.set(-21,-7,32);exterior.add(planet);
  const sun=new THREE.DirectionalLight(0xfff8e0,2.8);
  sun.position.set(13,24,9);exterior.add(sun);
 }
 const outerCraft=createHistoricVehicle(scenario);
 outerCraft.position.set(0,2,3.1);outerCraft.scale.setScalar(dusty?1.4:1.2);
 exterior.add(outerCraft);
 if(scenario.family==="lunar"&&/Apollo 15|Apollo 17/.test(scenario.title)){
  // Preserve the four-wheel lunar rover from these expeditions, now correctly
  // located on the EVA terrain rather than inside the pressure cabin.
  const lunarRover=new THREE.Group();lunarRover.position.set(6,0,17);exterior.add(lunarRover);
  box(lunarRover,2,.22,1.6,accent(),0,.78,0);
  for(const side of [-1,1])for(const z of [-.8,.8])cyl(lunarRover,.32,.32,.16,dark(),side, .29,z,0,0,Math.PI/2);
  for(const side of [-1,1]){box(lunarRover,.65,.12,.65,ceramic(),side*.46,.99,.25);box(lunarRover,.65,.55,.12,ceramic(),side*.46,1.25,.55);}
  beam(lunarRover,new THREE.Vector3(0,.85,-.35),new THREE.Vector3(0,2.1,-.55),.035,aluminum());
 }

 // An actual external hatch housing, control panel and lit handle sit behind the vehicle.
 const outerHatch=new THREE.Group();outerHatch.position.set(0,0,9.05);
 exterior.add(outerHatch);
 const outerMaterials=fabricationMaterials(architecture);
 formedPanel(outerHatch,2.4,2.75,.22,.3,outerMaterials.structure,0,1.4,0);
 formedPanel(outerHatch,1.94,2.39,.25,.27,outerMaterials.dark,0,1.4,.02);
 formedPanel(outerHatch,1.78,2.25,.27,.24,outerMaterials.shell,0,1.4,.04);
 route(outerHatch,[[-.62,1.08,.21],[-.55,1.21,.28],[-.55,1.6,.28],[-.62,1.7,.21]],.035,outerMaterials.structure,16);
 formedPanel(outerHatch,.28,.42,.16,.045,outerMaterials.trim,.98,1.42,.22);
 formedPanel(outerHatch,.15,.18,.18,.025,outerMaterials.warning,.98,1.42,.33);
 finishFabrication(outerHatch);
 // A physical tether connects the suit to a fixed spacecraft attachment.
 const tetherMaterial=new THREE.LineBasicMaterial({color:0xe8c46f,transparent:true,opacity:.88});
 const tetherGeometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,1.4,9.15),new THREE.Vector3(0,1.4,9.15)]);
 const tether=new THREE.Line(tetherGeometry,tetherMaterial);exterior.add(tether);

 // First-person glove and cuff meshes appear only when the suit is worn outside.
 const suitView=createEvaGloves("battery").group;
 const craftDisplay=badge(scenario.craft.toUpperCase().slice(0,36));
 if(craftDisplay){craftDisplay.position.set(0,6.9,-15);craftDisplay.scale.setScalar(.8);scene.add(craftDisplay);}
 // Physical spotlight and secure display pedestal instead of a large neon halo.
 const workMount=new THREE.Group();scene.add(workMount);
 box(workMount,2.7,.2,1.7,dark(),0,.3,-15);
 box(workMount,.24,2.9,.22,aluminum(),0,1.7,-15);
 const stars=new THREE.BufferGeometry();const positions:number[]=[];
 let seed=(Number(scenario.missionId.replace(/\D/g,""))*49297+1217)|0;
 for(let i=0;i<550;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;
 const x=(seed>>>0)/4294967295*2-1;seed=(Math.imul(seed,1664525)+1013904223)|0;
 const y=(seed>>>0)/4294967295;seed=(Math.imul(seed,1664525)+1013904223)|0;
 const z=(seed>>>0)/4294967295*2-1;
 positions.push(x*80,y*60+5,z*80);}
 stars.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
 const pts=new THREE.Points(stars,new THREE.PointsMaterial({color:0xc5cbd0,size:.075,sizeAttenuation:true}));
 if(scenario.role==="astronaut"&&!inField)scene.add(pts);
 references.push(applyInteriorPbr(scene,quality));
 return {scene,craft,stationMeshes,deck,exterior,hatchAssembly,suitView,dusty,workMount,floor,tether,references,loadExteriorReference};
}
export type StoryWorldSnapshot={
 version:1;outside:boolean;position:[number,number,number];yaw:number;pitch:number;
 motion:[number,number,number];jumpHeight:number;jumpSpeed:number;
 movement?:[number,number];
};
/** Validate without applying any pose. A resume cannot place a controller
 * outside, tunnel past the training bounds, or manufacture a giant jump. */
export function validStoryWorldSnapshot(value:unknown,scenario:Pick<StoryScenario,"role"|"setting">):value is StoryWorldSnapshot{
 if(!value||typeof value!=="object")return false;
 const p=value as StoryWorldSnapshot;
 const vector=(v:unknown,length:number):v is number[]=>Array.isArray(v)&&v.length===length&&v.every(n=>typeof n==="number"&&Number.isFinite(n));
 if(p.version!==1||typeof p.outside!=="boolean"||!vector(p.position,3)||!vector(p.motion,3)||
 ![p.yaw,p.pitch,p.jumpHeight,p.jumpSpeed].every(n=>typeof n==="number"&&Number.isFinite(n))||
 (p.movement!==undefined&&(!vector(p.movement,2)||Math.hypot(...p.movement)>1.01)))return false;
 if(Math.abs(p.pitch)>1.15||Math.hypot(...p.motion)>3.26||p.jumpHeight<0||p.jumpHeight>4||Math.abs(p.jumpSpeed)>9)return false;
 const [x,y,z]=p.position,dusty=scenario.setting==="moon"||scenario.setting==="mars";
 if(!p.outside)return Math.abs(x)<=5.6&&z>=-5.65&&z<=6.65&&Math.abs(y-1.65)<.001&&p.jumpHeight===0&&p.jumpSpeed===0&&Math.hypot(...p.motion)<.001;
 if(scenario.role!=="astronaut")return false;
 if(dusty)return Math.abs(x)<=23&&z>=9.9&&z<=64&&Math.abs(y-(1.65+p.jumpHeight))<.001&&Math.hypot(...p.motion)<.001;
 return y>=-10&&y<=18&&Math.hypot(x,y-1.65,z-9.05)<=24.01&&p.jumpHeight===0&&p.jumpSpeed===0;
}
export type StoryWorld={
 canvas:HTMLCanvasElement;
 look:(dx:number,dy:number,sensitivity?:number)=>void;
 update:(axisX:number,axisY:number,sprint:boolean,dt:number,active?:Station|null,vertical?:number)=>Station|null;
 jump:()=>void;
 distanceToHatch:()=>number;
 setExcursion:(outside:boolean)=>void;
 nearHatch:()=>boolean;
 aimingAtHatch:()=>boolean;
 resize:()=>void;
 dispose:()=>void;
 snapshot:()=>StoryWorldSnapshot;
 restore:(value:unknown)=>boolean;
};
export function startStoryWorld(canvas:HTMLCanvasElement,scenario:StoryScenario):StoryWorld{
 let preferences=defaultPreferences;
 try{preferences=readPreferences(localStorage);}catch{/* Storage can be denied in private browsing. */}
 const renderer=new THREE.WebGLRenderer({canvas,antialias:preferences.graphics!=="battery",alpha:false,powerPreference:preferences.graphics==="battery"?"low-power":"high-performance"});
 const ratioBounds=graphicsRatioBounds(window.devicePixelRatio||1,preferences.graphics);
 const pixelLimit=ratioBounds.limit;
 let pixelRatio=pixelLimit,frameClock=performance.now(),drawn=0,lastRender=0;
 renderer.setPixelRatio(pixelRatio);
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.04;
 const {scene,craft,stationMeshes,deck,exterior,hatchAssembly,suitView,dusty,workMount,floor,tether,references,loadExteriorReference}=createStoryScene(scenario,preferences.graphics);
 // One small prefiltered environment supplies soft material reflections. No
 // screen-space effects or extra per-frame render passes are needed on tablets.
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
 const reflections=pmrem.fromScene(room,.06);room.dispose();pmrem.dispose();
 scene.environment=reflections.texture;scene.environmentIntensity=.36;
 const camera=new THREE.PerspectiveCamera(68,1,.04,170);camera.position.set(0,1.65,6.25);
 let yaw=0,pitch=0,t=0,outside=false;
 const motion=new THREE.Vector3(),AIRLOCK=new THREE.Vector3(0,1.65,9.05);
 const movement={x:0,z:0};
 let jumpSpeed=0,jumpHeight=0;
 const distanceToHatch=()=>outside?camera.position.distanceTo(AIRLOCK):Math.max(0,7.35-camera.position.z);
 const nearHatch=()=>outside?distanceToHatch()<2.8:Math.abs(camera.position.x)<1.7&&camera.position.z>4.65;
 const aimingAtHatch=()=>{
  if(scenario.role!=="astronaut"||!nearHatch())return false;
  const panel=outside?new THREE.Vector3(.98,1.42,9.37):new THREE.Vector3(.84,1.36,7.06);
  const ray=panel.sub(camera.position);
  const range=ray.length();
  const direction=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  return range<3.2&&ray.normalize().dot(direction)>.66;
 };
 const jump=()=>{
  if(outside&&dusty&&jumpHeight<.015&&jumpSpeed===0)jumpSpeed=scenario.setting==="moon"?2.3:2.65;
 };
 camera.add(suitView);scene.add(camera);suitView.visible=false;
 const setExcursion=(next:boolean)=>{
  if(next&&scenario.role!=="astronaut")return;
  outside=next;
  motion.set(0,0,0);jumpSpeed=0;jumpHeight=0;
  deck.visible=!next;floor.visible=!next;hatchAssembly.visible=!next;workMount.visible=!next;
  for(const g of Object.values(stationMeshes))g.visible=!next;
  exterior.visible=next;craft.visible=!next;
  if(next)loadExteriorReference();
  suitView.visible=next;
  camera.position.set(0,1.65,next?10.55:5.9);
  yaw=next?Math.PI:0;pitch=0;
  scene.fog=scenario.setting==="mars"?new THREE.FogExp2(0x7e5a47,next?.004:.008):null;
  scene.background=new THREE.Color(next&&scenario.setting==="mars"?0xa47e62:0x000000);
 };
 const snapshot=():StoryWorldSnapshot=>({version:1,outside,position:camera.position.toArray() as [number,number,number],yaw,pitch,motion:motion.toArray() as [number,number,number],jumpHeight,jumpSpeed,movement:[movement.x,movement.z]});
 const restore=(value:unknown)=>{
  if(!validStoryWorldSnapshot(value,scenario))return false;
  setExcursion(value.outside);camera.position.set(...value.position);
  yaw=value.yaw;pitch=value.pitch;motion.set(...value.motion);
  jumpHeight=value.jumpHeight;jumpSpeed=value.jumpSpeed;
  movement.x=value.movement?.[0]??0;movement.z=value.movement?.[1]??0;
  camera.rotation.order="YXZ";camera.rotation.set(pitch,yaw,0,"YXZ");
  return true;
 };
 const resize=()=>{
  const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
 };
 resize();
 const look=(dx:number,dy:number,sensitivity=1)=>{
  yaw-=dx*.0032*sensitivity;pitch=Math.max(-1.15,Math.min(1.15,pitch-dy*.0028*sensitivity));
 };
 const update=(axisX:number,axisY:number,sprint:boolean,dt:number,active?:Station|null,vertical=0):Station|null=>{
  const time=Math.min(dt,.07);
  const rightX=Math.cos(yaw),rightZ=-Math.sin(yaw);
  const forwardX=-Math.sin(yaw),forwardZ=-Math.cos(yaw);
  const len=Math.max(1,Math.hypot(axisX,axisY));
  const moveX=(rightX*axisX+forwardX*axisY)/len;
  const moveZ=(rightZ*axisX+forwardZ*axisY)/len;
  const damping=Math.min(1,time*9);
  movement.x+=(moveX-movement.x)*damping;
  movement.z+=(moveZ-movement.z)*damping;
  if(outside&&!dusty){
   // A bounded relative-motion trainer: thrust and assistance change velocity.
   // Orbital free fall still occurs in a gravitational field.
   motion.x+=(movement.x*3.7-motion.x*.64)*time;
   motion.z+=(movement.z*3.7-motion.z*.64)*time;
   motion.y+=(Math.max(-1,Math.min(1,vertical))*3.7-motion.y*.64)*time;
   motion.clampLength(0,sprint?3.25:2.05);
   camera.position.addScaledVector(motion,time);
   // An anchored tether limits the free-flight training range.
   const offset=camera.position.clone().sub(AIRLOCK);
   if(offset.length()>24){
    camera.position.copy(AIRLOCK).addScaledVector(offset.normalize(),24);
    motion.multiplyScalar(.32);
   }
   camera.position.y=Math.max(-10,Math.min(18,camera.position.y));
  }else{
   const speed=(outside?(scenario.setting==="moon"?1.5:1.65):2.65)*(sprint?1.55:1);
   const nx=camera.position.x+movement.x*speed*time;
   const nz=camera.position.z+movement.z*speed*time;
   if(outside){
    camera.position.x=Math.max(-23,Math.min(23,nx));camera.position.z=Math.max(9.9,Math.min(64,nz));
   }else{
    const bowConsole=["lunar","capsule","gemini","apollo","sphere","shuttle","rover"].includes(scenario.family);
    const [x,z]=cabinStep(camera.position.x,camera.position.z,nx,nz,bowConsole);
    camera.position.x=x;camera.position.z=z;
   }
   if(outside){
    const gravity=scenario.setting==="moon"?1.62:3.71;
    jumpHeight=Math.max(0,jumpHeight+jumpSpeed*time);
    jumpSpeed-=gravity*time;
    if(jumpHeight===0&&jumpSpeed<0)jumpSpeed=0;
   }
   camera.position.y=1.65+(outside?jumpHeight:0);
  }
  camera.rotation.order="YXZ";camera.rotation.y=yaw;camera.rotation.x=pitch;
  if(outside){
   // Update the safety tether without allocating a new geometry every frame.
   const coords=tether.geometry.attributes.position as THREE.BufferAttribute;
   coords.setXYZ(0,0,1.4,9.15);
   coords.setXYZ(1,camera.position.x,camera.position.y-.34,camera.position.z);
   coords.needsUpdate=true;
   tether.geometry.computeBoundingSphere();
  }
  t+=time;if(!outside)craft.rotation.y=.35+Math.sin(t*.33)*.12;
  let candidate:Station|null=null,maxAlign=.32;
  for(const [id,[sx,sz]] of Object.entries(stationLocations) as [Station,[number,number]][]){
   if(outside)break;
   const dx=sx-camera.position.x,dz=sz-camera.position.z;
   const dist=Math.hypot(dx,dz);
   const alignment=(-Math.sin(yaw)*dx-Math.cos(yaw)*dz)/Math.max(.001,dist);
   if(dist<3.7&&alignment>maxAlign){candidate=id;maxAlign=alignment;}
  }
  for(const id of Object.keys(stationMeshes) as Station[]){
   const ring=stationMeshes[id].children.find(o=>o instanceof THREE.Mesh && o.geometry instanceof THREE.TorusGeometry) as THREE.Mesh|undefined;
   if(ring&&ring.material instanceof THREE.MeshBasicMaterial)
    ring.material.color.set(candidate===id?0xe8ffcd:id===active?0xffd879:0x477b86);
  }
  // At 120 Hz tablets, avoid GPU renders in excess of 60 FPS. All movement,
  // aiming and EVA simulation still update on every animation frame.
  const now=performance.now();
  if(now-lastRender>=14){
   renderer.render(scene,camera);
   lastRender=now;drawn++;
   const interval=now-frameClock;
   if(interval>3100){
    const fps=drawn*1000/interval;
    canvas.dataset.graphicsTrace=JSON.stringify({preset:preferences.graphics,measuredFps:Math.round(fps*10)/10,ratio:pixelRatio,limit:pixelLimit,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles});
    const desired=Math.max(ratioBounds.floor,storyPixelRatio(pixelRatio,pixelLimit,fps));
    if(Math.abs(desired-pixelRatio)>.015){
     pixelRatio=desired;renderer.setPixelRatio(pixelRatio);
     renderer.setSize(Math.max(1,canvas.clientWidth),Math.max(1,canvas.clientHeight),false);
    }
    frameClock=now;drawn=0;
   }
  }
  return candidate;
 };
 const dispose=()=>{
  if(scene.userData.disposed)return;
  references.forEach(reference=>reference.dispose());
  disposeObjectResources(scene);reflections.dispose();renderer.dispose();
 };
 return {canvas,look,update,resize,dispose,setExcursion,nearHatch,aimingAtHatch,jump,distanceToHatch,snapshot,restore};
}

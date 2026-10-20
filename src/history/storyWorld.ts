import * as THREE from "three";
import type { StoryScenario, Station } from "./storyScenarios";
import {createHistoricVehicle} from "./historicVehicles";
import {makePlanet,planetKind} from "../commander/celestial";

const stationLocations:Record<Station,[number,number]>={
 brief:[-3,2.5],systems:[3,2.5],operations:[-3,-2.5],science:[3,-2.5],
};
type Material=THREE.MeshStandardMaterial;
const aluminum=()=>new THREE.MeshStandardMaterial({color:0x99b0b7,metalness:.75,roughness:.34});
const accent=()=>new THREE.MeshStandardMaterial({color:0xe3b55b,metalness:.62,roughness:.33});
const ceramic=()=>new THREE.MeshStandardMaterial({color:0xf0f2eb,metalness:.2,roughness:.58});
const dark=()=>new THREE.MeshStandardMaterial({color:0x14212f,metalness:.45,roughness:.43});
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
 ctx.fillStyle="#092c38";ctx.fillRect(0,0,512,128);
 ctx.strokeStyle="#5adcc6";ctx.lineWidth=4;ctx.strokeRect(3,3,506,122);
 ctx.fillStyle="#e0fff7";ctx.font="bold 38px Arial";ctx.textAlign="center";
 ctx.fillText(text,256,79,486);
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
 const mat=new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide});
 return new THREE.Mesh(new THREE.PlaneGeometry(3.2,.8),mat);
}
function createScene(scenario:StoryScenario){
 const scene=new THREE.Scene();
 const inField=scenario.role==="astronaut"&&(scenario.setting==="moon"||scenario.setting==="mars");
  const sky=inField?(scenario.setting==="mars"?0x422b28:0x11171e):0x050f1e;
 scene.background=new THREE.Color(sky);
 scene.fog=new THREE.FogExp2(sky,scenario.setting==="orbit"?.012:.021);
 scene.add(new THREE.HemisphereLight(0xc6eaf8,0x43556a,2.1));
 const sun=new THREE.DirectionalLight(0xfff4d4,2.7);sun.position.set(-8,13,-6);scene.add(sun);
 const floorColor=inField?(scenario.setting==="mars"?0x805039:0x747b79):0x182b3d;
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.MeshStandardMaterial({color:floorColor,metalness:scenario.setting==="orbit"?.35:.02,roughness:.94}));
 floor.rotation.x=-Math.PI/2;floor.position.y=-.08;scene.add(floor);
 const deck=new THREE.Group();scene.add(deck);
 for(let x=-6;x<=6;x+=2){box(deck,.028,.02,14,aluminum(),x,0,0);}
 for(let z=-6;z<=7;z+=2){box(deck,12,.02,.028,aluminum(),0,0,z);}

  // Outdoor lunar and Martian operations feature mission-specific hardware and terrain.
  if(inField){
    const terrain=new THREE.MeshStandardMaterial({color:scenario.setting==="mars"?0xa66a43:0x949c96,roughness:.95});
    for(let k=0;k<30;k++){
      const x=(k%2===0?-1:1)*(7+(k%6)*1.7);
      const z=-8-Math.floor(k/6)*2.5;
      const stone=new THREE.Mesh(new THREE.DodecahedronGeometry(.3+(k%5)*.11,0),terrain);
      stone.position.set(x,-.02,z);stone.scale.y=.46;scene.add(stone);
    }
    if(scenario.family==="lunar"&&/Apollo 15|Apollo 17/.test(scenario.title)){
      const lunarRover=new THREE.Group();lunarRover.position.set(6,0,-12);scene.add(lunarRover);
      box(lunarRover,2,.22,1.6,accent(),0,.78,0);
      for(const side of [-1,1])for(const z of [-.8,.8])
        cyl(lunarRover,.32,.32,.16,dark(),side*1,.29,z,0,0,Math.PI/2);
      beam(lunarRover,new THREE.Vector3(0,.85,0),new THREE.Vector3(0,2.1,-.2),.05,aluminum());
    }
  }else{
    // Interior ribs and overhead rails of a crew training cabin / remote probe-control bay.
    for(const side of [-1,1]){
      for(let z=-6;z<=6;z+=2){
        box(deck,.28,3.9,.25,aluminum(),side*6.2,1.92,z);
        sphere(deck,.07,new THREE.MeshStandardMaterial({color:0x80cdbf,emissive:0x1a8470,emissiveIntensity:1}),side*6.05,2.6,z);
      }
      beam(deck,new THREE.Vector3(side*6.2,3.9,-6.2),new THREE.Vector3(side*6.2,3.9,6.7),.07,aluminum());
    }
    // Textured planetary bodies replace the single-colour placeholder sphere.
    const planet=makePlanet(planetKind(scenario.destination),7);
    planet.position.set(17,14,-32);scene.add(planet);
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
  const base=aluminum();const light=new THREE.MeshStandardMaterial({color:0x2b7687,emissive:0x145a63,emissiveIntensity:.7,metalness:.6,roughness:.34});
  box(g,2.35,1.2,1.2,dark(),0,.68,0);
  box(g,2.25,.12,1.37,base,0,1.35,0);
  const scr=box(g,1.75,.85,.12,light,0,1.95,-.36);scr.rotation.x=-.18;
  for(let k=0;k<5;k++)box(g,.22,.07,.18,k%2?accent():light,-.73+k*.36,1.43,.32);
  for(let k=0;k<3;k++)box(g,1.5-k*.16,.035,.02,aluminum(),0,1.98+k*.15,-.292);
  const tag=badge(taskTitles[id].toUpperCase().slice(0,38));if(tag){tag.position.set(0,2.82,0);g.add(tag);}
  const spot=new THREE.PointLight(0x4ec9ca,.6,3.5);spot.position.set(0,2.5,0);g.add(spot);
  const halo=new THREE.Mesh(new THREE.TorusGeometry(1.2,.025,5,48),new THREE.MeshBasicMaterial({color:i%2?0x6a99aa:0x63e4bf}));
  halo.rotation.x=Math.PI/2;halo.position.y=.02;g.add(halo);
 });
 // Distinctive historic-vehicle equipment instead of a uniform generic simulator.
 // These are recognizable low-poly training interpretations, not museum-accurate plans.
 if(scenario.family==="lunar"){
   const lmPanel=new THREE.Group();lmPanel.position.set(0,0,-5.9);deck.add(lmPanel);
   box(lmPanel,2.5,2,.22,dark(),0,1.45,0);
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
   box(console,3,1.6,.65,dark(),0,.95,0);
   for(let i=0;i<13;i++){const x=-1.32+(i%7)*.41,y=1.15+Math.floor(i/7)*.36;
     cyl(console,.075,.075,.04,i%3===0?accent():aluminum(),x,y,-.39,Math.PI/2);}
   if(scenario.family==="gemini")for(const side of [-1,1]){
     box(console,.65,.5,.65,ceramic(),side*1.1,.48,1.2);
   }
 }
 if(scenario.family==="shuttle"){
   const flightdeck=new THREE.Group();flightdeck.position.set(0,0,-5.7);deck.add(flightdeck);
   box(flightdeck,3.6,1.4,.7,dark(),0,1.15,0);
   for(let i=0;i<4;i++)box(flightdeck,.55,.43,.09,new THREE.MeshStandardMaterial({color:0x1b7184,emissive:0x13404e,emissiveIntensity:.6}),-1.17+i*.78,1.56,-.4);
   for(let i=0;i<8;i++)box(flightdeck,.17,.09,.17,accent(),-1.3+i*.37,.92,-.45);
 }
 if(scenario.family==="station"){
   for(const side of [-1,1])for(let i=0;i<4;i++){
     const rack=new THREE.Group();rack.position.set(side*5.8,0,-4.7+i*2.65);deck.add(rack);
     box(rack,.55,2.2,1.55,ceramic(),0,1.2,0);
     box(rack,.6,.7,1.2,dark(),-side*.05,1.46,0);
     box(rack,.61,.28,.75,accent(),-side*.06,.87,0);
   }
 }
 if(scenario.family==="rover"){
   const roboticBay=new THREE.Group();roboticBay.position.set(0,0,-5.8);deck.add(roboticBay);
   box(roboticBay,3.4,1.4,.52,dark(),0,1.12,0);
   for(let i=0;i<3;i++)box(roboticBay,.78,.55,.08,new THREE.MeshStandardMaterial({color:i===0?0xb66c40:0x3d7686,emissive:0x10222a}),-1+i,1.65,-.3);
 }
 const craft=createHistoricVehicle(scenario);
 craft.position.set(0,4,-15);craft.rotation.y=.4;
 const scale=scenario.family==="station"?.8:scenario.family==="shuttle"?.85:scenario.family==="lunar"?.9:1.04;
 craft.scale.setScalar(scale);scene.add(craft);
 // Pressure hatch: one control on the cabin side and one on the EVA side.
 const hatchAssembly=new THREE.Group();hatchAssembly.position.set(0,0,7.35);scene.add(hatchAssembly);
 const hatchShell=aluminum(),hatchPanel=dark(),hatchLight=accent();
 for(const x of [-1.05,1.05])box(hatchAssembly,.23,2.65,.22,hatchShell,x,1.3,0);
 box(hatchAssembly,2.3,.25,.2,hatchShell,0,2.7,0);
 box(hatchAssembly,1.85,2.4,.14,hatchPanel,0,1.35,0);
 for(const z of [-.26,.26]){
  box(hatchAssembly,.31,.42,.11,hatchLight,.84,1.36,z);
  box(hatchAssembly,.16,.22,.125,ceramic(),.84,1.36,z+Math.sign(z)*.025);
 }
 const exterior=new THREE.Group();scene.add(exterior);exterior.visible=false;
 const dusty=scenario.setting==="moon"||scenario.setting==="mars";
 const isMars=scenario.setting==="mars";
 if(dusty){
  // Low relief, rocks and impact sites give scale without blocking motion.
  const terrain=new THREE.PlaneGeometry(100,110,58,58);
  terrain.rotateX(-Math.PI/2);
  const p=terrain.attributes.position;
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),z=p.getZ(i),rough=(Math.sin(x*.34+z*.12)*Math.cos(z*.26)+Math.sin(z*.81+x*.44)*.28)*.13;
   p.setY(i,Math.abs(x)<3&&Math.abs(z-17)<13?-.12:rough-.12);
  }
  terrain.computeVertexNormals();
  const soil=new THREE.MeshStandardMaterial({color:isMars?0xb07152:0x858786,roughness:1});
  const floor=new THREE.Mesh(terrain,soil);floor.position.z=25;exterior.add(floor);
  const boulder=new THREE.DodecahedronGeometry(1,0),rockMaterial=new THREE.MeshStandardMaterial({color:isMars?0x7a4736:0x666862,roughness:1});
  const rocks=new THREE.InstancedMesh(boulder,rockMaterial,160),dummy=new THREE.Object3D();
  for(let i=0;i<160;i++){
   const x=Math.sin(i*37.19)*39,z=9+(i*13.73)%65;
   dummy.position.set(Math.abs(x)<3?x+5:x,.01,z);
   dummy.rotation.set(i*.3,i*.4,0);const scale=.18+(i%8)*.11;
   dummy.scale.set(scale,scale*.4,scale*.85);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);
  }
  exterior.add(rocks);
  const crater=new THREE.Mesh(new THREE.TorusGeometry(3,.18,7,48),rockMaterial);
  crater.rotation.x=Math.PI/2;crater.position.set(-7,-.09,25);exterior.add(crater);
  const earth=makePlanet("earth",isMars?1.9:1.3);
  earth.position.set(-22,20,-55);exterior.add(earth);
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
 // First-person glove and cuff meshes appear only when the suit is worn outside.
 const suitView=new THREE.Group();
 for(const side of [-1,1]){
  const sleeve=box(suitView,.22,.38,.56,ceramic(),side*.39,-.47,-.83);
  sleeve.rotation.x=-.42;
  sphere(suitView,.18,ceramic(),side*.38,-.59,-1.12);
  cyl(suitView,.17,.17,.14,hatchLight,side*.38,-.36,-.93,Math.PI/2);
 }
 const craftDisplay=badge(scenario.craft.toUpperCase().slice(0,36));
 if(craftDisplay){craftDisplay.position.set(0,8,-15);craftDisplay.scale.setScalar(1.25);scene.add(craftDisplay);}
 const outline=new THREE.Mesh(new THREE.TorusGeometry(5.3,.04,8,72),new THREE.MeshBasicMaterial({color:0x4b7d8a}));
 outline.position.set(0,4,-15);scene.add(outline);
 const stars=new THREE.BufferGeometry();const positions:number[]=[];
 let seed=(Number(scenario.missionId.replace(/\D/g,""))*49297+1217)|0;
 for(let i=0;i<550;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;
 const x=(seed>>>0)/4294967295*2-1;seed=(Math.imul(seed,1664525)+1013904223)|0;
 const y=(seed>>>0)/4294967295;seed=(Math.imul(seed,1664525)+1013904223)|0;
 const z=(seed>>>0)/4294967295*2-1;
 positions.push(x*80,y*60+5,z*80);}
 stars.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
 const pts=new THREE.Points(stars,new THREE.PointsMaterial({color:0xbbdce1,size:.19,sizeAttenuation:true}));scene.add(pts);
 return {scene,craft,stationMeshes,deck,exterior,hatchAssembly,suitView,dusty};
}
export type StoryWorld={
 canvas:HTMLCanvasElement;
 look:(dx:number,dy:number,sensitivity?:number)=>void;
 update:(axisX:number,axisY:number,sprint:boolean,dt:number,active?:Station|null)=>Station|null;
 setExcursion:(outside:boolean)=>void;
 nearHatch:()=>boolean;
 resize:()=>void;
 dispose:()=>void;
};
export function startStoryWorld(canvas:HTMLCanvasElement,scenario:StoryScenario):StoryWorld{
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:"high-performance"});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.45));
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 const {scene,craft,stationMeshes,deck,exterior,hatchAssembly,suitView,dusty}=createScene(scenario);
 const camera=new THREE.PerspectiveCamera(72,1,.04,170);camera.position.set(0,1.65,6.25);
 let yaw=0,pitch=0,t=0,outside=false;
 camera.add(suitView);scene.add(camera);suitView.visible=false;
 const nearHatch=()=>outside?Math.hypot(camera.position.x,camera.position.z-9)<3.7:Math.abs(camera.position.x)<2.2&&camera.position.z>4.65;
 const setExcursion=(next:boolean)=>{
  outside=next;
  deck.visible=!next;hatchAssembly.visible=!next;
  for(const g of Object.values(stationMeshes))g.visible=!next;
  exterior.visible=next;craft.visible=!next;
  suitView.visible=next;
  camera.position.set(0,1.65,next?9.3:5.9);
  yaw=next?Math.PI:0;pitch=0;
  if(next)scene.fog=new THREE.FogExp2(dusty?(scenario.setting==="mars"?0x422b28:0x11171e):0x050f1e,.012);
  else scene.fog=new THREE.FogExp2(0x050f1e,.012);
 };
 const resize=()=>{
  const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
 };
 resize();
 const look=(dx:number,dy:number,sensitivity=1)=>{
  yaw-=dx*.0032*sensitivity;pitch=Math.max(-1.15,Math.min(1.15,pitch-dy*.0028*sensitivity));
 };
 const update=(axisX:number,axisY:number,sprint:boolean,dt:number,active?:Station|null):Station|null=>{
  const time=Math.min(dt,.07);
  const speed=(sprint?5.1:2.75)*time;
  const rightX=Math.cos(yaw),rightZ=-Math.sin(yaw);
  const forwardX=-Math.sin(yaw),forwardZ=-Math.cos(yaw);
  const len=Math.max(1,Math.hypot(axisX,axisY));
  const x=camera.position.x+(rightX*axisX+forwardX*axisY)/len*speed;
  const z=camera.position.z+(rightZ*axisX+forwardZ*axisY)/len*speed;
  camera.position.x=Math.max(outside?-24:-5.6,Math.min(outside?24:5.6,x));
  camera.position.z=Math.max(outside?7:-5.65,Math.min(outside?65:6.65,z));
  camera.rotation.order="YXZ";camera.rotation.y=yaw;camera.rotation.x=pitch;
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
  renderer.render(scene,camera);
  return candidate;
 };
 const dispose=()=>{
  scene.traverse(obj=>{
   if(!(obj instanceof THREE.Mesh||obj instanceof THREE.Points))return;
   obj.geometry.dispose();
   const mats=Array.isArray(obj.material)?obj.material:[obj.material];
   for(const m of mats){
    const tex=(m as THREE.MeshBasicMaterial).map;if(tex)tex.dispose();
    m.dispose();
   }
  });renderer.dispose();
 };
 return {canvas,look,update,resize,dispose,setExcursion,nearHatch};
}

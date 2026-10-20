import * as THREE from "three";
import type { StoryScenario } from "./storyScenarios";

/**
 * Highly-instanced playable mission bridge. The four mission consoles retain
 * their exact coordinates so existing story actions still work. Astronaut
 * missions look like a pressurized spacecraft; uncrewed missions remain an
 * Earth-based mission operations centre.
 */
export function installStoryBridge(root:THREE.Group,scenario:StoryScenario){
 const cockpit=scenario.role==="astronaut";
 const shell=new THREE.MeshStandardMaterial({color:cockpit?0x354652:0x4c5866,metalness:.48,roughness:.45});
 const rib=new THREE.MeshStandardMaterial({color:0x8a9faa,metalness:.72,roughness:.32});
 const recess=new THREE.MeshStandardMaterial({color:0x122431,metalness:.25,roughness:.72});
 const trim=new THREE.MeshStandardMaterial({color:0x213847,metalness:.45,roughness:.5});
 const light=new THREE.MeshStandardMaterial({color:0x93e7ee,emissive:0x27aeb9,emissiveIntensity:.85,metalness:.16,roughness:.3});
 const amber=new THREE.MeshStandardMaterial({color:0xbba370,emissive:0xc58e46,emissiveIntensity:.23,metalness:.35,roughness:.5});
 const metals=[shell,rib,recess,trim,light,amber];
 const strips:{[key:number]:{x:number;y:number;z:number;w:number;h:number;d:number;rx?:number;rz?:number}[]}={};
 const add=(k:number,x:number,y:number,z:number,w:number,h:number,d:number,rz=0,rx=0)=>{
  (strips[k]||=[]).push({x,y,z,w,h,d,rz,rx});
 };
 // Main pressure ring structure, instead of a generic square stage.
 for(let z=-6;z<=6.02;z+=1.5){
  for(const side of [-1,1]){
   add(1,side*6.02,2.06,z,.17,3.85,.2);
   add(1,side*5.32,3.87,z,1.26,.17,.21,side*.48);
   add(1,side*4.65,4.28,z,.6,.16,.18,side*.19);
   add(0,side*6.05,.27,z,.38,.2,.19);
   add(2,side*5.75,1.47,z,.16,1.75,.21);
   add(3,side*5.83,2.36,z,.2,.31,.2);
  }
  add(1,0,4.43,z,9.45,.12,.24);
  add(0,0,.02,z,10.9,.08,.16);
  add(4,0,4.36,z,3.1,.025,.09);
 }
 // Metallic ceiling inserts, false ventilation grilles and service conduit.
 for(const side of [-1,1]){
  add(0,side*5.18,4.31,0,.67,.13,13.3,side*.41);
  add(4,side*4.96,4.19,0,.34,.025,12.6,side*.41);
  add(3,side*5.91,3.02,0,.3,.18,13.0);
  for(let z=-5.8;z<6.3;z+=.7){
   for(let i=0;i<4;i++)
    add(2,side*(3.3+i*.48),4.25,z,.16,.025,.36);
   for(let y=.66;y<3.45;y+=.45)
    add(1,side*5.87,y,z,.08,.045,.12);
   add(5,side*5.66,1.0,z,.07,.09,.24);
  }
  for(let z=-5.5;z<5.8;z+=2.7){
   // Recessed equipment cabinets and telemetry panels along the far walls.
   add(2,side*5.68,1.72,z,.24,1.45,2.1);
   add(0,side*5.45,1.72,z,.08,1.39,1.93);
   add(1,side*5.38,2.42,z,.12,.08,1.98);
   add(4,side*5.36,2.13,z,.135,.05,1.55);
   for(let k=0;k<7;k++)
    add(k%4===0?5:3,side*5.32,1.0+(k%5)*.15,z-.79+Math.floor(k/5)*.86,.04,.06,.3);
  }
 }
 // Control-room floor: inset non-slip panels and removable access sections.
 for(let z=-6;z<=6;z+=.62){
  add(3,0,-.043,z,8.6,.022,.52);
  add(1,0,-.018,z,6.65,.015,.015);
  for(const side of [-1,1]){
   add(1,side*4.7,.013,z,.028,.028,.38);
   add(5,side*4.98,.024,z,.14,.01,.28);
  }
 }
 // Large, layered forward viewports and close-set steel frames.
 add(0,0,4.17,-6.75,13,.67,.39);
 add(0,0,.48,-6.75,13,1.05,.42);
 for(const side of [-1,1]){
  add(0,side*5.3,2.41,-6.65,1.0,3.5,.44);
  add(1,side*4.46,2.43,-6.45,.25,2.8,.3,side*.17);
  add(1,side*2.15,3.96,-6.43,4.0,.17,.3,side*.13);
  add(4,side*4.34,3.55,-6.39,.1,.22,.12);
 }
 add(1,0,3.97,-6.44,4.25,.21,.27);
 add(1,0,1.19,-6.42,8.7,.22,.36);
 add(4,0,3.84,-6.36,1.54,.05,.09);
 // Detailed, angled flight controllers at the bow, outside the main walkway.
 for(const side of [-1,1]){
  add(2,side*2.95,.73,-5.71,1.72,1.32,1.1,side*.06);
  add(0,side*2.95,1.39,-5.55,1.86,.12,.95,side*.06);
  add(3,side*2.95,1.49,-5.57,1.6,.035,.78);
  for(let k=0;k<8;k++)
   add(k%5===0?5:k%3===0?4:1,side*(2.34+k*.17),1.52,-5.44,.09,.03,.09);
 }
 // Airlock outer controls remain unobstructed at z=7.35 in StoryFlight.
 for(const side of [-1,1]){
  add(0,side*5.8,1.75,6.8,.3,3.0,.45);
  add(5,side*5.63,1.37,6.66,.12,.28,.07);
 }
 const geo=new THREE.BoxGeometry(1,1,1);
 for(let i=0;i<metals.length;i++){
  const elements=strips[i]||[];
  if(!elements.length)continue;
  const instanced=new THREE.InstancedMesh(geo,metals[i],elements.length);
  const obj=new THREE.Object3D();
  for(let n=0;n<elements.length;n++){
   const part=elements[n];
   obj.position.set(part.x,part.y,part.z);
   obj.rotation.set(part.rx||0,0,part.rz||0);
   obj.scale.set(part.w,part.h,part.d);
   obj.updateMatrix();instanced.setMatrixAt(n,obj.matrix);
  }
  instanced.instanceMatrix.needsUpdate=true;
  instanced.frustumCulled=false;
  root.add(instanced);
 }
 root.userData.bridgeRole=cockpit?"CREW VEHICLE":"GROUND MISSION CONTROL";
}

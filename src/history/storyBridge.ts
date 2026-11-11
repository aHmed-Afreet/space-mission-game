import * as THREE from "three";
import type { StoryScenario } from "./storyScenarios";
import { storyArchitecture, storyPalette } from "./storyArchitecture";

/** Family-specific educational interiors. Reachable task stations and the aft
 * hatch retain their coordinates; no visual detail changes collision/save data. */
export function installStoryBridge(root:THREE.Group,scenario:StoryScenario){
 const architecture=storyArchitecture(scenario), palette=storyPalette[architecture];
 const crew=architecture!=="ground-control",station=architecture==="station";
 const materials=[
  new THREE.MeshStandardMaterial({color:palette.shell,metalness:station?.15:.32,roughness:.66}),
  new THREE.MeshStandardMaterial({color:palette.structure,metalness:.72,roughness:.37}),
  new THREE.MeshStandardMaterial({color:palette.trim,metalness:.2,roughness:.78}),
  new THREE.MeshStandardMaterial({color:palette.floor,metalness:.17,roughness:.85}),
  new THREE.MeshStandardMaterial({color:0xeee9da,emissive:0xffedce,emissiveIntensity:.5,roughness:.48}),
  new THREE.MeshStandardMaterial({color:0xba9a60,metalness:.5,roughness:.55}),
 ];
 type Part={x:number;y:number;z:number;w:number;h:number;d:number;rz:number;rx:number};
 const strips:Part[][]=materials.map(()=>[]);
 const add=(k:number,x:number,y:number,z:number,w:number,h:number,d:number,rz=0,rx=0)=>strips[k].push({x,y,z,w,h,d,rz,rx});
 const roofHeight=architecture==="early-capsule"?4.35:architecture==="shuttle"?4.1:4.65;
 const wallHeight=2.85,halfWidth=6.2;
 // A curved pressure vessel and complete roof replace the open prototype stage.
 // Capsule training volume is expanded for accessible free movement; the placard
 // explicitly identifies the reconstruction rather than claiming exact dimensions.
 if(crew){
  const profile:THREE.Vector3[]=[new THREE.Vector3(-halfWidth,.03,0),new THREE.Vector3(-halfWidth,wallHeight,0)];
  for(let k=1;k<=12;k++){
   const a=Math.PI-k*Math.PI/12;
   profile.push(new THREE.Vector3(Math.cos(a)*halfWidth,wallHeight+Math.sin(a)*(roofHeight-wallHeight),0));
  }
  profile.push(new THREE.Vector3(halfWidth,.03,0));
  const hullVertices:number[]=[],hullIndices:number[]=[];
  for(let i=0;i<profile.length-1;i++){
   const a=profile[i],b=profile[i+1],n=hullVertices.length/3;
   hullVertices.push(a.x,a.y,-6.8,b.x,b.y,-6.8,b.x,b.y,6.85,a.x,a.y,6.85);
   hullIndices.push(n,n+1,n+2,n,n+2,n+3);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.Float32BufferAttribute(hullVertices,3));geo.setIndex(hullIndices);geo.computeVertexNormals();
  const skin=materials[0].clone();skin.side=THREE.DoubleSide;
  const shell=new THREE.Mesh(geo,skin);shell.name=`${architecture} pressure shell`;root.add(shell);
  const curve=new THREE.CatmullRomCurve3(profile);
  const ringGeometry=new THREE.TubeGeometry(curve,48,.065,6,false);
  const ringCount=architecture==="early-capsule"?12:8;
  const rings=new THREE.InstancedMesh(ringGeometry,materials[1],ringCount),matrix=new THREE.Matrix4();
  for(let i=0;i<ringCount;i++){matrix.makeTranslation(0,0,-6.45+i*12.9/(ringCount-1));rings.setMatrixAt(i,matrix);}
  rings.name=`${architecture} pressure frames`;root.add(rings);
 }else{
  // An Earth-based operations gallery is architecturally distinct from a cabin.
  add(0,-6.25,2.3,0,.18,4.6,13.7);add(0,6.25,2.3,0,.18,4.6,13.7);
  add(0,0,4.65,0,12.7,.16,13.7);
  for(let z=-6;z<7;z+=1.4){add(1,0,4.48,z,12.4,.08,.04);add(4,0,4.44,z,5.5,.04,.16);}
  // Observation bay beyond the front glazing holds the vehicle reference model.
  add(0,0,7.5,-22,26,15,.25);
  for(const side of [-1,1])add(0,side*13,7.5,-14,.25,15,16);
  add(0,0,14.9,-14,26,.2,16);
  for(const side of [-1,1])for(let z=-8;z>-21;z-=3.5)add(4,side*7.5,10,z,4,.1,.2);
 }
 // Inset sidewall equipment, fasteners and cable routes are batched by material.
 for(const side of [-1,1]){
  add(2,side*6.07,1.48,0,.13,2.65,13.1);
  add(1,side*5.97,2.88,0,.13,.08,13.1);
  add(4,side*5.79,3.18,0,.14,.05,12.5);
  for(let z=-5.4;z<6.1;z+=2.3){
   add(0,side*5.96,1.5,z,.14,2.2,2.12);
   add(1,side*5.85,2.57,z,.12,.07,2.14);
   add(1,side*5.85,.45,z,.12,.07,2.14);
   add(2,side*5.78,1.78,z,.1,.71,1.82);
   for(let i=0;i<9;i++)add(1,side*5.71,.78+i*.1,z,.04,.035,1.5);
   for(const dz of [-.9,.9])add(5,side*5.7,2.34,z+dz,.08,.07,.08);
   if(station){
    // Orbital research racks, soft stowage and handholds instead of flight seats.
    add(0,side*5.69,1.45,z,.22,1.4,1.2);
    add(2,side*5.53,1.79,z,.07,.47,.88);
    add(5,side*5.5,.8,z,.08,.06,.67);
    add(1,side*5.42,2.42,z,.09,.08,.9);
   }else if(architecture==="early-capsule"){
    add(2,side*5.75,1.4,z,.1,1.35,.12);
    add(5,side*5.7,1.4,z,.08,.2,.19);
   }
  }
 }
 // Non-slip deck plates and recessed access seams: quiet neutral materials.
 for(let z=-6.3;z<6.6;z+=.82){
  add(3,0,-.025,z,11.8,.05,.79);
  add(1,0,.004,z,11.7,.008,.012);
  for(const side of [-1,1]){add(1,side*4.95,.012,z,.045,.012,.76);add(5,side*5.15,.016,z,.12,.01,.24);}
 }
 // Forward viewports retain the unobstructed external vehicle reference.
 add(0,0,4.1,-6.8,12.5,.82,.25);add(0,0,.54,-6.8,12.5,1.08,.25);
 for(const side of [-1,1]){
  add(0,side*5.6,2.5,-6.8,1.25,3.2,.25);
  add(1,side*4.7,2.52,-6.62,.17,2.75,.25,side*.15);
  add(1,side*1.67,2.73,-6.62,.13,2.76,.22,side*.12);
  add(1,side*3.1,3.84,-6.62,3.06,.14,.25);
  add(1,side*3.1,1.28,-6.62,3.05,.14,.3);
 }
 // Shuttle decks use a broad overhead switch bank; Apollo panels are upright.
 if(architecture==="shuttle"){
  add(0,0,3.55,-5.56,6.3,.18,1.55,0,-.22);
  for(let i=0;i<24;i++)add(i%6===0?5:2,-2.8+(i%12)*.51,3.42,-5.65+Math.floor(i/12)*.48,.17,.05,.13);
 }else if(architecture==="apollo"||architecture==="early-capsule"){
  for(const side of [-1,1]){
   add(0,side*4.65,2.06,-5.55,1.19,2.3,.26,side*.08);
   for(let k=0;k<16;k++)add(k%7===0?5:2,side*4.65-.37+(k%4)*.24,1.35+Math.floor(k/4)*.43,-5.38,.13,.13,.04);
  }
 }
 // Recessed luminaire diffusers provide visible light sources without glow halos.
 for(const side of [-1,1]){
  add(2,side*3.48,roofHeight-.17,0,.75,.07,11.8);
  add(4,side*3.48,roofHeight-.22,0,.58,.025,11.6);
  // Complete aft bulkhead while preserving the pressure hatch and interaction ray.
  add(0,side*3.68,2.18,6.83,4.98,4.35,.2);
  add(1,side*1.11,1.5,6.82,.16,3,.3);
 }
 add(0,0,3.82,6.83,2.2,1.05,.2);
 const boxGeometry=new THREE.BoxGeometry(1,1,1),dummy=new THREE.Object3D();
 materials.forEach((material,i)=>{
  const parts=strips[i];if(!parts.length)return;
  const mesh=new THREE.InstancedMesh(boxGeometry,material,parts.length);
  for(let n=0;n<parts.length;n++){
   const p=parts[n];dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(p.rx,0,p.rz);dummy.scale.set(p.w,p.h,p.d);dummy.updateMatrix();mesh.setMatrixAt(n,dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate=true;mesh.name=`${architecture} fittings ${i}`;root.add(mesh);
 });
 root.userData.bridgeRole=crew?"CREW VEHICLE":"GROUND MISSION CONTROL";
 root.userData.storyArchitecture=architecture;
}

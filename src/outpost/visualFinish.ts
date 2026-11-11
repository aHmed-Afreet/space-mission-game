import * as T from "three";
import {mergeGeometries} from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Instrumentation is readable at console distance. The drawing describes the
 * educational resource simulation, rather than a historical flight procedure. */
export function facilityDisplay(title:string,oxygen:number,water:number,power:number){
 const c=document.createElement("canvas");c.width=1024;c.height=512;
 const ctx=c.getContext("2d");if(!ctx)return null;
 ctx.fillStyle="#071218";ctx.fillRect(0,0,1024,512);
 ctx.fillStyle="#bdcdd1";ctx.font="500 24px monospace";ctx.fillText("ORBITAL / SURFACE SYSTEMS",34,43);
 ctx.fillStyle="#e5eceb";ctx.font="600 42px monospace";ctx.fillText(title.toUpperCase(),34,102);
 ctx.strokeStyle="#33474e";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(34,126);ctx.lineTo(990,126);ctx.stroke();
 const values=[{label:"OXYGEN",v:oxygen},{label:"WATER",v:water},{label:"POWER",v:power}];
 values.forEach((item,i)=>{const x=34+i*324;
  ctx.fillStyle="#a9bec5";ctx.font="22px monospace";ctx.fillText(item.label,x,170);
  ctx.fillStyle=item.v<20?"#deb481":"#dae8e9";ctx.font="54px monospace";ctx.fillText(Math.round(item.v)+"%",x,233);
  ctx.fillStyle="#23363e";ctx.fillRect(x,252,278,9);
  ctx.fillStyle="#7fa9ac";ctx.fillRect(x,252,278*Math.max(0,Math.min(100,item.v))/100,9);
 });
 ctx.strokeStyle="#263a43";ctx.lineWidth=1;
 for(let y=310;y<=446;y+=34){ctx.beginPath();ctx.moveTo(34,y);ctx.lineTo(990,y);ctx.stroke();}
 ctx.strokeStyle="#7fa9ac";ctx.lineWidth=3;ctx.beginPath();
 for(let x=34;x<990;x+=5){const y=383+Math.sin(x*.019)*17+Math.cos(x*.045)*5;x===34?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.stroke();
 ctx.fillStyle="#83999f";ctx.font="18px monospace";ctx.fillText("RESOURCE TREND / EDUCATIONAL SIMULATION",34,488);
 const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=2;return texture;
}

/** Static construction detail is merged by material after camera bounds are
 * captured. Doors, foliage, solar tracking, and astronauts stay independent.
 * This removes hundreds of small per-frame draw calls on tablet GPUs. */
export function batchOutpostStructure(world:T.Group,dynamic:T.Object3D[]){
 const moving=new Set(dynamic),batches=new Map<T.Material,T.Mesh[]>();
 const owned=new Set<T.BufferGeometry>();
 world.updateMatrixWorld(true);
 const visit=(object:T.Object3D)=>{
  if(moving.has(object)||object instanceof T.InstancedMesh)return;
  if(object instanceof T.Mesh&&object.material instanceof T.Material){
   const list=batches.get(object.material)??[];list.push(object);batches.set(object.material,list);
   owned.add(object.geometry);
  }
  object.children.forEach(visit);
 };
 visit(world);
 for(const [material,meshes] of batches){
  if(meshes.length<3)continue;
  const copies=meshes.map(mesh=>{
   const copy=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
   copy.applyMatrix4(mesh.matrixWorld);return copy;
  });
  const merged=mergeGeometries(copies,false);copies.forEach(copy=>copy.dispose());
  if(!merged)continue;
  const mesh=new T.Mesh(merged,material);mesh.name="batched-outpost-structure";
  mesh.castShadow=!(material instanceof T.MeshStandardMaterial&&material.emissiveIntensity>1);
  mesh.receiveShadow=true;world.add(mesh);
  meshes.forEach(source=>source.removeFromParent());
 }
 return ()=>owned.forEach(geometry=>geometry.dispose());
}

/** The navigable 58m square is graded level. Terrain and scattered rocks use
 * the same elevation outside that area, preventing suspended surface props. */
export function outpostTerrainHeight(x:number,z:number){
 const r=Math.hypot(x,z),blend=T.MathUtils.smoothstep(r,43,67);
 const hills=Math.sin(x*.094+z*.021)*2.7+Math.cos(z*.121-x*.04)*1.6+Math.sin(x*.23+z*.15)*.7;
 const distance=Math.hypot(x+53,z-65);
 const bowl=-3.1*Math.exp(-Math.pow(distance/14,4));
 const rim=1.3*Math.exp(-Math.pow((distance-17)/3.2,2));
 return (hills+bowl+rim)*blend-.1;
}

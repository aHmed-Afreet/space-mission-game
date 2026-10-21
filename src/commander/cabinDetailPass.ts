import * as T from "three";
import {RoundedBoxGeometry} from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

// PBR-quality panel and cloth finishes, locally generated, no network,
// authored as photographic-scale fine surface structure rather than flat colours.
export function installCabinDetail(
 scene:T.Scene,
 materials:{hull:T.MeshStandardMaterial;panel:T.MeshStandardMaterial;
 dark:T.MeshStandardMaterial;floor:T.MeshStandardMaterial;
 metal:T.MeshStandardMaterial;fabric:T.MeshStandardMaterial},
 graphics:"quality"|"balanced"|"battery",
){
 const ownedGeometry:T.BufferGeometry[]=[];
 const ownedTextures:T.Texture[]=[];
 const ownedMaterials:T.Material[]=[];
 function grain(size:number,kind:"metal"|"cloth"){
  const canvas=document.createElement("canvas");
  canvas.width=size;canvas.height=size;
  const ctx=canvas.getContext("2d");
  if(!ctx)return null;
  const data=ctx.createImageData(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   // Repeatable multi-scale noise, directional scratches, and machine grooves.
   const fib=kind==="cloth"?(Math.sin(x*.85+y*.7)*16+Math.cos(x*1.65-y*.9)*13):
    (Math.sin(y*2.3)*11+Math.cos(y*.15)*14);
   const noise=Math.sin(x*17.31+y*9.72)*Math.cos(x*7.92-y*13.4)*17;
   const scratch=kind==="metal" && (y*47+x*3)%97===0?38:0;
   const v=Math.max(35,Math.min(235,Math.round(124+fib+noise+scratch)));
   const i=4*(y*size+x);
   data.data[i]=v;data.data[i+1]=v;data.data[i+2]=v;data.data[i+3]=255;
  }
  ctx.putImageData(data,0,0);
  const tx=new T.CanvasTexture(canvas);
  tx.wrapS=T.RepeatWrapping;tx.wrapT=T.RepeatWrapping;
  tx.repeat.set(kind==="metal"?2:3,kind==="metal"?2:3);
  tx.anisotropy=2;ownedTextures.push(tx);return tx;
 }
 if(graphics!=="battery"){
  const metal=grain(graphics==="quality"?256:128,"metal");
  const fabricMap=grain(128,"cloth");
  if(metal)for(const m of [materials.hull,materials.panel,materials.metal,materials.dark,materials.floor]){
   m.bumpMap=metal;m.bumpScale=graphics==="quality"?.024:.016;
   m.roughnessMap=metal;m.needsUpdate=true;
  }
  if(fabricMap){materials.fabric.bumpMap=fabricMap;materials.fabric.bumpScale=.055;materials.fabric.needsUpdate=true;}
 }
 const darkMetal=new T.MeshStandardMaterial({color:"#263745",metalness:.75,roughness:.36});
 const brushed=new T.MeshStandardMaterial({color:"#b7c8ce",metalness:.88,roughness:.26});
 const rubber=new T.MeshStandardMaterial({color:"#0b1118",metalness:.02,roughness:.89});
 const woven=new T.MeshStandardMaterial({color:"#526675",metalness:0,roughness:.99});
 const fastener=new T.MeshStandardMaterial({color:"#dfd9c3",metalness:.7,roughness:.41});
 const status=new T.MeshStandardMaterial({color:"#b0f5e1",emissive:"#2aab95",emissiveIntensity:.8,metalness:.23,roughness:.38});
 ownedMaterials.push(darkMetal,brushed,rubber,woven,fastener,status);
 function add(geo:T.BufferGeometry,mat:T.Material,x:number,y:number,z:number,
  sx=1,sy=1,sz=1,rx=0,ry=0,rz=0){
  ownedGeometry.push(geo);
  const mesh=new T.Mesh(geo,mat);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);
  mesh.rotation.set(rx,ry,rz);scene.add(mesh);return mesh;
 }
 function bar(x:number,y:number,z:number,w:number,h:number,d:number,mat:T.Material,rot=0){
  return add(new RoundedBoxGeometry(1,1,1,2,.13),mat,x,y,z,w,h,d,0,0,rot);
 }
 function hose(points:[number,number,number][],radius:number,mat:T.Material,segments=20){
  const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
  add(new T.TubeGeometry(curve,segments,radius,6,false),mat,0,0,0);
 }
 // Foredeck: tactile rotary dials and industrial bevel-rimmed instrument pods.
 for(const x of [-1.35,-.93,-.51,0,.51,.93,1.35]){
  const y=1.09,z=-6.02;
  add(new T.CylinderGeometry(.115,.115,.075,24),rubber,x,y,z,1,1,1,Math.PI/2);
  add(new T.TorusGeometry(.115,.02,8,24),brushed,x,y,z+.045,1,1,1);
  add(new T.CylinderGeometry(.035,.035,.09,12),fastener,x,y+.01,z+.07,1,1,1,Math.PI/2);
 }
 for(const side of [-1,1]){
  // Curved pilot-seat bolsters, textile seams and four-point harness webbing.
  const x=side*.8;
  bar(x,.91,-4.9,.62,1.02,.22,woven,-.06*side);
  bar(x,.59,-5.16,.65,.18,.76,woven);
  bar(x-.24,1.02,-4.88,.1,.74,.16,rubber,.07);
  bar(x+.24,1.02,-4.88,.1,.74,.16,rubber,-.07);
  hose([[x-.25,1.42,-4.84],[x-.19,1.1,-4.75],[x, .70,-4.82]],.032,brushed,12);
  hose([[x+.25,1.42,-4.84],[x+.19,1.1,-4.75],[x,.70,-4.82]],.032,brushed,12);
  bar(x,.73,-4.81,.28,.08,.085,darkMetal);
  // Suit harness buckle and layered mechanical armrest grippers.
  bar(x,.73,-4.735,.13,.09,.08,brushed);
  for(const delta of [-.38,.38]){
   bar(x+delta,.79,-5.14,.13,.11,.63,darkMetal);
   for(let k=0;k<3;k++)bar(x+delta,.86,-5.35+k*.19,.09,.012,.025,fastener);
  }
 }
 // Rigid and flexible utility plumbing and cable bundles look unlike
 // primitives because their visible profiles are genuinely curved.
 for(const side of [-1,1]){
  for(const z of [-6.6,-3.1,.65,4.2]){
   hose([[side*2.97,2.32,z-.62],[side*2.96,2.22,z-.25],
     [side*2.91,2.45,z+.16],[side*2.94,2.29,z+.64]],.034,darkMetal,22);
   hose([[side*2.89,2.37,z-.62],[side*2.83,2.18,z-.19],
     [side*2.88,2.31,z+.21],[side*2.89,2.36,z+.61]],.018,brushed,20);
  }
 }
 // Mission displays have transparent protective cover reflections and
 // machined retaining hardware rather than flat billboard rectangles.
 const screws:{x:number;y:number;z:number}[]=[];
 for(const [x,y,z,w,h] of [
  [-.93,1.48,-6.78,.8,.45],[0,1.48,-6.78,.82,.45],[.93,1.48,-6.78,.8,.45],
  [2.2,1.82,-3.35,1.1,.5],[-2.2,1.85,-3.35,1.16,.55],
 ]){
  for(const a of [-1,1])for(const b of [-1,1])
   screws.push({x:x+a*(w/2+.07),y:y+b*(h/2+.07),z:z+.058});
  // Small instrument identification tag.
  bar(x,y-h/2-.11,z+.07,w*.7,.025,.015,darkMetal);
 }
 const screwGeo=new T.CylinderGeometry(.018,.018,.014,10);
 ownedGeometry.push(screwGeo);
 const mesh=new T.InstancedMesh(screwGeo,fastener,screws.length);
 const obj=new T.Object3D();
 screws.forEach((pos,i)=>{
  obj.position.set(pos.x,pos.y,pos.z);obj.rotation.set(Math.PI/2,0,0);
  obj.updateMatrix();mesh.setMatrixAt(i,obj.matrix);
 });
 mesh.instanceMatrix.needsUpdate=true;scene.add(mesh);
 // Emergency handle hardware uses circular cross-sections with worn grips.
 for(const z of [-4.35,-1.35,2.35]){
  for(const side of [-1,1]){
   add(new T.TorusGeometry(.15,.025,7,22),brushed,side*1.23,1.77,z+.20,1,1,1,0,0,Math.PI/2);
   bar(side*1.23,1.77,z+.245,.13,.045,.04,rubber);
   bar(side*1.22,1.5,z+.215,.12,.07,.08,status);
  }
 }
 return ()=>{
  for(const obj of [...scene.children]){
   if(obj instanceof T.InstancedMesh && obj.geometry===screwGeo)scene.remove(obj);
  }
  ownedGeometry.forEach(g=>g.dispose());
  ownedMaterials.forEach(m=>m.dispose());
  ownedTextures.forEach(t=>t.dispose());
 };
}

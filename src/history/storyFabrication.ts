import * as T from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { StoryArchitecture } from "./storyArchitecture";
import { storyPalette } from "./storyArchitecture";

/** Original ORBITAL manufactured forms. Structural skins and console housings
 * are drawn profiles/lofts, not scaled unit boxes. These are educational cabin
 * interpretations, never claims about a vehicle's exact construction drawings. */
export function fabricationMaterials(kind: StoryArchitecture) {
 const colors=storyPalette[kind];
 const normal=new Uint8Array(128*128*4),rough=new Uint8Array(128*128*4);
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){
  const a=(x+y)*Math.PI/16,b=(x-y)*Math.PI/16;
  const dx=Math.cos(a)*Math.sin(b)*.13,dy=Math.sin(a)*Math.cos(b)*.13;
  const i=(y*128+x)*4;
  normal.set([128+dx*127,128+dy*127,252,255],i);
  const v=218+Math.round(Math.sin(a)*Math.sin(b)*13);rough.set([v,v,v,255],i);
 }
 const weave=new T.DataTexture(normal,128,128);weave.needsUpdate=true;weave.wrapS=weave.wrapT=T.RepeatWrapping;weave.repeat.set(8,5);weave.magFilter=T.LinearFilter;weave.minFilter=T.LinearMipmapLinearFilter;weave.generateMipmaps=true;
 const roughness=new T.DataTexture(rough,128,128);roughness.needsUpdate=true;roughness.wrapS=roughness.wrapT=T.RepeatWrapping;roughness.repeat.set(8,5);roughness.magFilter=T.LinearFilter;roughness.minFilter=T.LinearMipmapLinearFilter;roughness.generateMipmaps=true;
 const materials={
  shell:new T.MeshStandardMaterial({color:colors.shell,metalness:.23,roughness:.62}),
  structure:new T.MeshStandardMaterial({color:colors.structure,metalness:.62,roughness:.4}),
  dark:new T.MeshStandardMaterial({color:colors.trim,metalness:.12,roughness:.79}),
  fabric:new T.MeshStandardMaterial({color:kind==="early-capsule"?0x8f9b8b:kind==="apollo"?0xd5ceae:0xcaccc2,metalness:0,roughnessMap:roughness,normalMap:weave,normalScale:new T.Vector2(.55,.55),roughness:.93}),
  trim:new T.MeshStandardMaterial({color:0x40484a,metalness:.65,roughness:.39}),
  light:new T.MeshStandardMaterial({color:0xf1eddf,emissive:0xf1e1b5,emissiveIntensity:.7,roughness:.7}),
  warning:new T.MeshStandardMaterial({color:0xc4a565,metalness:.24,roughness:.68}),
  floor:new T.MeshStandardMaterial({color:colors.floor,metalness:.11,roughness:.91}),
 };
 const names={shell:"paint-historical-pressure-shell",structure:"metal-pressure-frame",dark:"rubber-equipment-gasket",fabric:"fabric-quilted-pressure-liner",trim:"metal-handrail",warning:"paint-caution-hardware",floor:"rubber-service-deck"};
 for(const[key,name]of Object.entries(names))materials[key as keyof typeof materials].name=name;
 materials.fabric.addEventListener("dispose",()=>{weave.dispose();roughness.dispose();});
 return materials;
}
export type FabricationMaterials=ReturnType<typeof fabricationMaterials>;
export function roundedProfile(w:number,h:number,r:number){
 const x=-w/2,y=-h/2,s=new T.Shape();
 s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);
 s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
 s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);
 s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;
}
export function formedPanel(parent:T.Object3D,w:number,h:number,depth:number,r:number,material:T.Material,x=0,y=0,z=0){
 const geo=new T.ExtrudeGeometry(roundedProfile(w,h,r),{depth,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:1,curveSegments:4,steps:1});
 geo.translate(0,0,-depth/2);const mesh=new T.Mesh(geo,material);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}
export function route(parent:T.Object3D,points:readonly (readonly [number,number,number])[],radius:number,material:T.Material,segments=24){
 const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
 const mesh=new T.Mesh(new T.TubeGeometry(curve,segments,radius,6,false),material);parent.add(mesh);return mesh;
}
export function gauge(parent:T.Object3D,x:number,y:number,z:number,r:number,material:T.Material,ink:T.Material,angle=.5){
 const rim=new T.Mesh(new T.TorusGeometry(r,.016,5,24),material);rim.position.set(x,y,z);parent.add(rim);
 const dial=new T.Mesh(new T.CircleGeometry(r-.012,24),ink);dial.position.set(x,y,z-.003);parent.add(dial);
 route(parent,[[x-Math.sin(angle)*r*.12,y-Math.cos(angle)*r*.12,z+.012],[x+Math.sin(angle)*r*.7,y+Math.cos(angle)*r*.7,z+.012]],.005,material,1);
}
/** Smooth side-elevation extrusion, with a knee recess instead of a solid black
 * cabinet. Front/upward surfaces carry the instruments; cable looms sit aft. */
export function consoleHousing(parent:T.Object3D,width:number,materials:FabricationMaterials,kind:StoryArchitecture){
 const profile=new T.Shape();profile.moveTo(-.52,.12);profile.lineTo(-.61,1.6);
 profile.quadraticCurveTo(-.62,2.25,-.4,2.36);profile.lineTo(-.2,2.36);
 profile.lineTo(.07,1.48);profile.quadraticCurveTo(.16,1.29,.58,1.29);
 profile.quadraticCurveTo(.73,1.28,.74,1.13);profile.lineTo(.68,.92);
 profile.lineTo(.28,.85);profile.lineTo(.18,.37);profile.quadraticCurveTo(.15,.12,-.12,.12);profile.closePath();
 const geo=new T.ExtrudeGeometry(profile,{depth:width,bevelEnabled:true,bevelSize:.035,bevelThickness:.035,bevelSegments:2,curveSegments:6,steps:1});
 // Profile coordinates are z/y; extrusion supplies the x axis.
 const p=geo.attributes.position,n=geo.attributes.normal;
 for(let i=0;i<p.count;i++)p.setXYZ(i,p.getZ(i)-width/2,p.getY(i),p.getX(i));
 for(let i=0;i<n.count;i++)n.setXYZ(i,n.getZ(i),n.getY(i),n.getX(i));
 // Axis permutation reverses winding; correct the triangle order as well.
 const index=geo.index;if(index){for(let i=0;i<index.count;i+=3){const a=index.getX(i);index.setX(i,index.getX(i+2));index.setX(i+2,a);}}else{for(const attr of Object.values(geo.attributes))for(let i=0;i<attr.count;i+=3)for(let k=0;k<attr.itemSize;k++){const a=attr.array[i*attr.itemSize+k];attr.array[i*attr.itemSize+k]=attr.array[(i+2)*attr.itemSize+k];attr.array[(i+2)*attr.itemSize+k]=a;}}
 geo.computeVertexNormals();geo.computeBoundingSphere();
 for(const side of[-1,1]){const foot=formedPanel(parent,.68,.64,.09,.14,materials.trim,side*width*.32,.06,-.3);foot.rotation.x=-Math.PI/2;}
 const body=new T.Mesh(geo,materials.shell);body.name=`${kind} formed equipment console`;parent.add(body);
 for(const side of [-1,1])route(parent,[[side*(width/2+.025),.32,-.45],[side*(width/2+.025),1.23,-.45],[side*(width/2+.025),1.82,-.26]],.025,materials.trim,12);
 for(const side of [-1,1])route(parent,[[side*width*.34,.16,-.56],[side*width*.34,.85,-.64],[side*width*.31,1.49,-.54]],.025,materials.dark,12);
 const keyboard=formedPanel(parent,width-.13,.34,.045,.06,materials.dark,0,1.33,.43);keyboard.rotation.x=-Math.PI/2+.11;
 const sill=formedPanel(parent,width-.17,.11,.055,.045,materials.fabric,0,1.26,.69);sill.rotation.x=-.13;
}
/** Merge only the known static fabrication. It owns its geometry and is never
 * applied to target halos, hatch leaves, controls or imported asynchronous props. */
export function finishFabrication(root:T.Group){
 root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert(),groups=new Map<T.Material,T.Mesh[]>();
 root.traverse(object=>{if(object instanceof T.Mesh&&!Array.isArray(object.material)&&!object.material.transparent){const list=groups.get(object.material)??[];list.push(object);groups.set(object.material,list);}});
 for(const[material,meshes]of groups){if(meshes.length<2)continue;
  const copies=meshes.map(mesh=>{const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();g.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld));return g;});
  const merged=mergeGeometries(copies,false);copies.forEach(g=>g.dispose());if(!merged)continue;
  const originals=new Set(meshes.map(m=>m.geometry));meshes.forEach(mesh=>mesh.removeFromParent());originals.forEach(g=>g.dispose());
  const mesh=new T.Mesh(merged,material);mesh.name="manufactured static assembly";mesh.raycast=()=>{};root.add(mesh);
 }
}

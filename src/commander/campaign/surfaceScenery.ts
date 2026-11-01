import * as T from "three";
import { makePlanet, disposePlanet } from "../celestial";
import type { Destination } from "./environments";
import { presentationBudgets } from "../../presentation/missionPresentation";

export type SurfaceQuality = "quality" | "balanced" | "battery";
export type Marker = { x: number; z: number };
export const visualCraters = Object.freeze([
  {x:-10.5,z:28,radius:3.9}, {x:13,z:34,radius:5}, {x:-20,z:42,radius:5.8},
]);
/** Smooth excavated bowl and subdued ejecta rim; negative centre is real terrain
 * geometry, rather than a torus hovering over an unbroken plane. */
export function craterRelief(x:number,z:number):number {
  let height=0;
  for(const crater of visualCraters){
    const dx=x-crater.x,dz=z-crater.z,angle=Math.atan2(dz,dx);
    const radius=crater.radius*(1+.035*Math.sin(angle*9+crater.x));
    const t=Math.hypot(dx,dz)/radius;
    if(t>=1.25)continue;
    const bowl=-.31*Math.max(0,1-(t/.83)**2)**2;
    const rim=.19*Math.exp(-Math.pow((t-.86)*9,2));
    const taper=Math.max(0,Math.min(1,(1.25-t)/.23));
    height+=(bowl+rim)*taper;
  }
  return height;
}
/** Pure, deterministic visual height function. Navigation/collision are never modified. */
export function terrainRelief(x:number,z:number):number {
  const waves=Math.sin(x*.22)*Math.cos(z*.19)*.19+
    Math.sin(x*.57+z*.34)*.08+Math.cos(x*.93-z*.41)*.028;
  // Main corridor and instrument sites stay nearly flat. No visual walls.
  const shoulder=Math.max(0,Math.min(1,(Math.abs(x)-2.7)/6));
  return -.115+waves*(.09+.91*shoulder)+craterRelief(x,z);
}
function hash(seed:number):number {
  const x=Math.sin(seed*127.13+78.233)*43758.5453;
  return x-Math.floor(x);
}
function createDustMap(
  destination:Destination, quality:SurfaceQuality,
  ownedTextures:T.Texture[],
):T.Texture | null {
  const size=quality==="quality"?384:quality==="battery"?128:256;
  const canvas=document.createElement("canvas");
  canvas.width=size;canvas.height=size;
  const context=canvas.getContext("2d");
  if(!context)return null;
  const pixels=context.createImageData(size,size);
  const mars=destination==="mars";
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const coarse=Math.sin(x*.066+y*.023)*.5+Math.cos(y*.093-x*.036)*.5;
    const grains=hash(x*19.17+y*151.31);
    const ridges=Math.cos(y*.73+Math.sin(x*.075)*3.1)*.5;
    const v=Math.max(-1,Math.min(1,coarse*.37+(grains-.5)*.68+ridges*.18));
    const index=4*(y*size+x);
    pixels.data[index]=Math.round((mars?133:116)+v*(mars?29:31));
    pixels.data[index+1]=Math.round((mars?78:117)+v*(mars?20:30));
    pixels.data[index+2]=Math.round((mars?53:120)+v*(mars?17:29));
    pixels.data[index+3]=255;
  }
  context.putImageData(pixels,0,0);
  const texture=new T.CanvasTexture(canvas);
  texture.colorSpace=T.SRGBColorSpace;
  texture.wrapS=T.RepeatWrapping;texture.wrapT=T.RepeatWrapping;
  texture.repeat.set(10,10);
  texture.anisotropy=quality==="quality"?4:2;
  ownedTextures.push(texture);
  return texture;
}

function createSky(
  group:T.Group, destination:Destination, quality:SurfaceQuality,
  geometries:T.BufferGeometry[],materials:T.Material[],textures:T.Texture[],
) {
  const sky=document.createElement("canvas");sky.width=quality==="battery"?512:1024;sky.height=quality==="battery"?256:512;
  const ctx=sky.getContext("2d");if(!ctx)return;
  const w=sky.width,h=sky.height;
  ctx.fillStyle="#010309";ctx.fillRect(0,0,w,h);
  // The Moon has virtually no atmospheric blue scattering: stars in black sky.
  // The Mars branch is future-proofed with a thin dusty horizon gradient.
  if(destination==="mars"){
    const haze=ctx.createLinearGradient(0,h*.25,0,h);
    haze.addColorStop(0,"rgba(31,15,18,0)");
    haze.addColorStop(.7,"rgba(107,51,35,.36)");
    haze.addColorStop(1,"rgba(161,78,41,.8)");
    ctx.fillStyle=haze;ctx.fillRect(0,0,w,h);
  }
  const stars=quality==="battery"?350:quality==="quality"?1600:950;
  for(let i=0;i<stars;i++){
    const x=hash(i*4+1)*w,y=hash(i*4+2)*h;
    const magnitude=.25+hash(i*4+3)*.65;
    const radius=i%43===0?1.4:.36+hash(i*4+4)*.55;
    ctx.fillStyle=`rgba(224,235,255,${magnitude})`;
    ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();
  }
  const texture=new T.CanvasTexture(sky);
  texture.colorSpace=T.SRGBColorSpace;textures.push(texture);
  const material=new T.MeshBasicMaterial({map:texture,side:T.BackSide,depthWrite:false,fog:false});
  materials.push(material);
  const geometry=new T.SphereGeometry(48,quality==="battery"?20:36,quality==="battery"?12:20);
  geometries.push(geometry);
  const mesh=new T.Mesh(geometry,material);
  mesh.position.set(0,4,20);mesh.renderOrder=-2;group.add(mesh);
}

/** Layered, offline lunar geology designed to remain fast on iPad.
 * Models are graphical only: gameplay collision and site locations are untouched.
 */
export function installSurfaceScenery(
  group:T.Group,
  destination:Destination,
  markers:readonly Marker[],
  quality:SurfaceQuality="balanced",
  onSceneChange?:()=>void,
):{dispose():void} {
  const originalChildren=new Set(group.children);
  const geometries:T.BufferGeometry[]=[];
  const materials:T.Material[]=[];
  const textures:T.Texture[]=[];
  const count=presentationBudgets[quality].rockInstances;
  const rocksGeom=new T.IcosahedronGeometry(1,quality==="quality"?1:0);
  geometries.push(rocksGeom);
  const dustyMap=createDustMap(destination,quality,textures);
  const regolith=new T.MeshStandardMaterial({
    color:"#ffffff",map:dustyMap||undefined,roughness:.99,metalness:0,
    bumpMap:quality==="battery"?null:dustyMap,bumpScale:.012,
    side:T.FrontSide,
  });
  const rubble=new T.MeshStandardMaterial({
    color:destination==="mars"?"#aa6749":"#888887",roughness:.97,metalness:0,
    flatShading:true,
  });
  const lightRock=new T.MeshStandardMaterial({
    color:destination==="mars"?"#d48f5e":"#a4a2a0",roughness:.96,flatShading:true,
  });
  const shadowMat=new T.MeshBasicMaterial({transparent:true,opacity:.38,depthWrite:false,color:"#0b0b13"});
  materials.push(regolith,rubble,lightRock,shadowMat);
  const terrain=new T.PlaneGeometry(68,76,quality==="battery"?50:quality==="quality"?140:90,quality==="battery"?55:quality==="quality"?154:100);
  terrain.rotateX(-Math.PI/2);
  const positions=terrain.attributes.position;
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),z=positions.getZ(i)+14;
    positions.setY(i,terrainRelief(x,z));
  }
  terrain.computeVertexNormals();geometries.push(terrain);
  const floor=new T.Mesh(terrain,regolith);
  floor.position.z=14;group.add(floor);

  // Small fractured rock silhouettes with no additional draw call per rock.
  const matrix=new T.Object3D();
  const pieces=new T.InstancedMesh(rocksGeom,rubble,count);
  const flecks=new T.InstancedMesh(rocksGeom,lightRock,Math.round(count*.44));
  for(let i=0;i<count;i++){
    const x=(hash(i*5+11)-.5)*65;
    const z=2+hash(i*5+19)*45;
    const siteDistance=Math.min(...markers.map(p=>Math.hypot(p.x-x,p.z-z)));
    const hall=Math.abs(x)<4&&z<14;
    // Visible geology is kept away from the walked central corridor and site markers.
    const px=siteDistance<3.5||hall?(x<0?-1:1)*(Math.abs(x)+4):x;
    matrix.position.set(px,terrainRelief(px,z)+.02,z);
    matrix.rotation.set(hash(i*13)*.45,hash(i*7)*Math.PI*2,hash(i*17)*.6);
    const radius=.11+hash(i*23)*.26;
    matrix.scale.set(radius*(1+hash(i*31)),radius*(.26+hash(i*37)*.65),radius*(.65+hash(i*47)));
    matrix.updateMatrix();pieces.setMatrixAt(i,matrix.matrix);
    if(i<flecks.count){
      matrix.position.x+=.3;matrix.position.z+=.45;
      matrix.scale.multiplyScalar(.35);
      matrix.updateMatrix();flecks.setMatrixAt(i,matrix.matrix);
    }
  }
  pieces.instanceMatrix.needsUpdate=true;flecks.instanceMatrix.needsUpdate=true;
  group.add(pieces,flecks);

  // Silhouette terrain behind the walkable field, not a new player obstacle.
  if(destination!=="earth"){
    for(const [i,backZ] of [52,57,62].entries()){
      const points:number[]=[];const faces:number[]=[];
      const steps=62;
      for(let k=0;k<=steps;k++){
        const x=-64+k*128/steps;
        const height=2.1+Math.abs(Math.sin(k*.37+i))*(2.0+i*1.2)+
          Math.abs(Math.cos(k*.11-i))*(1.4+i*.65);
        points.push(x,-.25,backZ,x,height-(i*.4),backZ);
        if(k<steps){const j=k*2;faces.push(j,j+2,j+1,j+1,j+2,j+3);}
      }
      const geo=new T.BufferGeometry();
      geo.setAttribute("position",new T.Float32BufferAttribute(points,3));
      geo.setIndex(faces);geo.computeVertexNormals();geometries.push(geo);
      const mat=new T.MeshBasicMaterial({
        color:destination==="mars"?["#634537","#815040","#9b6249"][i]:["#343b48","#252d39","#1a2130"][i],
        side:T.DoubleSide,
      });materials.push(mat);
      group.add(new T.Mesh(geo,mat));
    }
  }
  createSky(group,destination,quality,geometries,materials,textures);

  let earth:T.Group|null=null;
  if(destination==="moon"){
    // Earth is near the sky horizon at a distant position, not a giant globe.
    earth=makePlanet("earth",1.8,true,onSceneChange);
    earth.position.set(-23,23,48);
    group.add(earth);
  }
  const sun=new T.DirectionalLight(destination==="mars"?"#ffdfbe":"#fff8e9",2.0);
  sun.position.set(-15,25,8);group.add(sun);
  const fill=new T.HemisphereLight("#dce2ef","#161522",.38);
  group.add(fill);

  const installedChildren=group.children.filter(child=>!originalChildren.has(child));
  let disposed=false;
  return {dispose(){
    if(disposed)return;disposed=true;
    if(earth)disposePlanet(earth);
    geometries.forEach(g=>g.dispose());
    materials.forEach(m=>m.dispose());
    textures.forEach(t=>t.dispose());
    group.remove(...installedChildren);
  }};
}

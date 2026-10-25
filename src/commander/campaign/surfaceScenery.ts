import * as T from "three";
import { makePlanet, disposePlanet } from "../celestial";
import type { Destination } from "./environments";

export type SurfaceQuality = "quality" | "balanced" | "battery";
export type Marker = { x: number; z: number };
/** Pure, deterministic visual height function. Navigation/collision are never modified. */
export function terrainRelief(x:number,z:number):number {
  const waves=Math.sin(x*.22)*Math.cos(z*.19)*.19+
    Math.sin(x*.57+z*.34)*.08+Math.cos(x*.93-z*.41)*.028;
  // Main corridor and instrument sites stay nearly flat. No visual walls.
  const shoulder=Math.max(0,Math.min(1,(Math.abs(x)-2.7)/6));
  return -.115+waves*(.09+.91*shoulder);
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
  const geometry=new T.SphereGeometry(61,quality==="battery"?20:36,quality==="battery"?12:20);
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
):{dispose():void} {
  const geometries:T.BufferGeometry[]=[];
  const materials:T.Material[]=[];
  const textures:T.Texture[]=[];
  const count=quality==="battery"?40:quality==="quality"?225:135;
  const rocksGeom=new T.IcosahedronGeometry(1,quality==="quality"?1:0);
  geometries.push(rocksGeom);
  const dustyMap=createDustMap(destination,quality,textures);
  const regolith=new T.MeshStandardMaterial({
    color:"#ffffff",map:dustyMap||undefined,roughness:.99,metalness:0,
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

  function crater(cx:number,cz:number,radius:number){
    const rings=12,steps=56;
    const points:number[]=[];const colors:number[]=[];const faces:number[]=[];
    for(let j=0;j<=rings;j++){
      const t=j/rings;
      const r=radius*t;
      // A bowl with a fractured raised rim and an undisturbed outer transition.
      const bowl=-.55*Math.pow(Math.max(0,1-t/.80),1.55);
      const rim=.39*Math.exp(-Math.pow((t-.81)*12,2));
      for(let i=0;i<=steps;i++){
        const angle=i/steps*Math.PI*2;
        const d=1+.047*Math.sin(angle*11+cx)+.024*Math.sin(angle*19+cz);
        const x=cx+Math.cos(angle)*r*d;
        const z=cz+Math.sin(angle)*r*d;
        const y=terrainRelief(x,z)+bowl+rim+.018;
        points.push(x,y,z);
        const shade=Math.min(1,Math.max(0,.58+rim*.31+bowl*.20+hash(i*13+j*7)*.12));
        colors.push(shade,shade*.995,shade*.98);
        if(j<rings&&i<steps){
          const n=j*(steps+1)+i;
          faces.push(n,n+steps+1,n+1,n+1,n+steps+1,n+steps+2);
        }
      }
    }
    const geo=new T.BufferGeometry();
    geo.setAttribute("position",new T.Float32BufferAttribute(points,3));
    geo.setAttribute("color",new T.Float32BufferAttribute(colors,3));
    geo.setIndex(faces);geo.computeVertexNormals();
    geometries.push(geo);
    const mat=new T.MeshStandardMaterial({vertexColors:true,color:destination==="mars"?"#a97860":"#b0adac",roughness:1,side:T.DoubleSide});
    materials.push(mat);group.add(new T.Mesh(geo,mat));
  }
  if(destination!=="earth"){
    crater(-9.5,27,3.9);crater(12,32,5);crater(-19,41,5.8);
  }

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
    earth=makePlanet("earth",1.8);
    earth.position.set(-23,23,48);
    group.add(earth);
  }
  const sun=new T.DirectionalLight(destination==="mars"?"#ffdfbe":"#fff8e9",2.0);
  sun.position.set(-15,25,8);group.add(sun);
  const fill=new T.HemisphereLight("#dce2ef","#161522",.38);
  group.add(fill);

  return {dispose(){
    if(earth)disposePlanet(earth);
    geometries.forEach(g=>g.dispose());
    materials.forEach(m=>m.dispose());
    textures.forEach(t=>t.dispose());
    group.remove(...group.children.filter(c=>c===floor||c===pieces||c===flecks));
  }};
}

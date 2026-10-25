import * as T from "three";
import {RoundedBoxGeometry} from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

type Graphics="quality"|"balanced"|"battery";

/** Offline tactile cockpit fittings and soft contact occlusion.
 * Noninteractive: all geometry remains flush to cockpit walls and decks.
 * No picking targets, collision coordinates or flight displays are altered.
 */
export function installCockpitFinishing(scene:T.Scene,graphics:Graphics):()=>void {
  const root=new T.Group();root.name="Cockpit visual finishing";scene.add(root);
  const geometries:T.BufferGeometry[]=[];
  const materials:T.Material[]=[];
  const textures:T.Texture[]=[];
  const addMaterial=(m:T.Material)=>{materials.push(m);return m};
  const metal=addMaterial(new T.MeshStandardMaterial({color:"#b3bcc5",metalness:.83,roughness:.28}));
  const housing=addMaterial(new T.MeshStandardMaterial({color:"#132331",metalness:.49,roughness:.4}));
  const rubber=addMaterial(new T.MeshStandardMaterial({color:"#1a242b",metalness:.05,roughness:.91}));
  const light=addMaterial(new T.MeshStandardMaterial({color:"#9bdde9",emissive:"#35c1dc",emissiveIntensity:.7,metalness:.12,roughness:.34}));
  const phosphor=addMaterial(new T.MeshStandardMaterial({color:"#a7b8c5",emissive:"#1b6f8a",emissiveIntensity:.55,metalness:.33,roughness:.38}));
  const gold=addMaterial(new T.MeshStandardMaterial({color:"#d2a876",metalness:.55,roughness:.38}));
  const rounded=new RoundedBoxGeometry(1,1,1,3,.12);
  const cylinder=new T.CylinderGeometry(1,1,1,20);
  const torus=new T.TorusGeometry(1,.13,8,32);
  geometries.push(rounded,cylinder,torus);
  function object(geometry:T.BufferGeometry,material:T.Material,x:number,y:number,z:number,
    sx=1,sy=1,sz=1,rx=0,ry=0,rz=0){
    const mesh=new T.Mesh(geometry,material);
    mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);
    mesh.rotation.set(rx,ry,rz);root.add(mesh);return mesh;
  }
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,mat:T.Material=housing)=>
    object(rounded,mat,x,y,z,w,h,d);

  // Side-console casing and tactile toggle banks. Keep all fixtures beyond
  // x=+/-1.6 so the central aisle and occupied pilot positions stay clear.
  const n=graphics==="battery"?4:graphics==="quality"?12:8;
  for(const side of [-1,1]){
    const x=side*2.86;
    box(x,1.64,-5.83,.12,.94,1.3,housing);
    box(x-side*.072,1.77,-5.83,.033,.57,1.12,metal);
    const buttons=graphics==="battery"?3:6;
    for(let j=0;j<buttons;j++){
      const z=-6.32+j*.19;
      box(x-side*.106,1.7,z,.025,.075,.11,j%3===0?gold:rubber);
      box(x-side*.128,1.7,z,.015,.034,.061,j%3===0?phosphor:light);
    }
    // Three-dimensional hose couplers and cable strain-relief boots.
    for(const j of [-1,1]){
      const plug=object(cylinder,metal,x-side*.17,1.18,-5.78+j*.26,
        .085,.18,.085,0,0,Math.PI/2);
      plug.rotation.z=Math.PI/2;
      object(torus,rubber,x-side*.27,1.18,-5.78+j*.26,.092,.092,.092,0,Math.PI/2);
    }
    // Equipment light rails: small, diffuse practical indicators.
    box(side*2.82,2.28,-5.82,.14,.045,1.16,phosphor);
    for(let k=0;k<n;k++){
      const z=-6.32+k*(1.03/Math.max(1,n-1));
      box(side*2.73,2.28,z,.035,.019,.039,k%4===0?gold:light);
    }
  }

  // Circular machined instrumentation at the pilot's forward desk.
  // A shared instanced mesh avoids one draw call per gauge tick.
  const ticks:T.Matrix4[]=[];
  const dummy=new T.Object3D();
  const gaugePlaces=[[-1.49,1.06,-5.78],[1.49,1.06,-5.78]] as const;
  for(const [x,y,z] of gaugePlaces){
    object(cylinder,rubber,x,y,z,.21,.027,.21,Math.PI/2);
    object(torus,metal,x,y,z+.027,.18,.18,.18);
    object(cylinder,housing,x,y,z+.037,.145,.012,.145,Math.PI/2);
    for(let i=0;i<18;i++){
      const theta=i*Math.PI/9;
      dummy.position.set(x+Math.cos(theta)*.125,y+Math.sin(theta)*.125,z+.052);
      dummy.rotation.set(0,0,theta+Math.PI/2);
      dummy.scale.set(i%3===0?.044:.026,.008,.006);
      dummy.updateMatrix();ticks.push(dummy.matrix.clone());
    }
    box(x+.024,y-.017,z+.065,.105,.012,.008,light);
    object(cylinder,gold,x,y,z+.08,.024,.015,.024,Math.PI/2);
  }
  const marks=new T.InstancedMesh(rounded,metal,ticks.length);
  ticks.forEach((m,i)=>marks.setMatrixAt(i,m));
  marks.instanceMatrix.needsUpdate=true;root.add(marks);

  // Soft precomputed seat shadows make the physical cockpit feel grounded.
  // Single alpha texture, no real-time shadow maps or expensive postprocessing.
  if(graphics!=="battery"){
    const canvas=document.createElement("canvas");canvas.width=128;canvas.height=128;
    const context=canvas.getContext("2d");
    if(context){
      const g=context.createRadialGradient(64,64,8,64,64,62);
      g.addColorStop(0,"rgba(0,0,0,.57)");g.addColorStop(.43,"rgba(0,0,0,.30)");
      g.addColorStop(1,"rgba(0,0,0,0)");
      context.fillStyle=g;context.fillRect(0,0,128,128);
      const texture=new T.CanvasTexture(canvas);
      texture.colorSpace=T.SRGBColorSpace;textures.push(texture);
      const material=addMaterial(new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));
      const geometry=new T.PlaneGeometry(1,1);geometries.push(geometry);
      for(const x of [-.8,.8])object(geometry,material,x,.091,-4.94,1.35,1.65,1,-Math.PI/2);
    }
  }

  // A readable, manufacture-style warning plate on the side of each bulkhead.
  // Painted labels distinguish a real control cabin from generic block geometry.
  function stencil(text:string){
    const canvas=document.createElement("canvas");canvas.width=384;canvas.height=128;
    const ctx=canvas.getContext("2d");if(!ctx)return null;
    ctx.fillStyle="#142430";ctx.fillRect(0,0,384,128);
    ctx.strokeStyle="#69838e";ctx.lineWidth=5;ctx.strokeRect(7,7,370,114);
    ctx.font="700 25px monospace";ctx.fillStyle="#c1e6ef";ctx.fillText(text,21,56);
    ctx.font="15px monospace";ctx.fillStyle="#c5a87c";ctx.fillText("CREW SYSTEM · CHECK",22,91);
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
    textures.push(texture);return texture;
  }
  if(graphics!=="battery"){
    const labels=[[-2.928,-3.03,"ECLSS / 02"],[2.928,3.84,"EVA / 06"]] as const;
    const geometry=new T.PlaneGeometry(.85,.29);geometries.push(geometry);
    for(const [x,z,name] of labels){
      const texture=stencil(name);if(!texture)continue;
      const mat=addMaterial(new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));
      object(geometry,mat,x,1.91,z,1,1,1,0,x<0?Math.PI/2:-Math.PI/2);
    }
  }
  return ()=>{
    scene.remove(root);
    geometries.forEach(g=>g.dispose());
    materials.forEach(m=>m.dispose());
    textures.forEach(t=>t.dispose());
  };
}

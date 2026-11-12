import * as T from "three";
import type {LockerId} from "./campaign/ship";
import {attachRealismModel,rigAstronautModel} from "../presentation/realismAssets";
import {createReferenceModelLoader} from "../presentation/referenceModelLoader";
import {disposeObjectResources} from "../presentation/resources";
import {batchStaticVisuals} from "../presentation/staticBatch";

/** Original formed spacecraft stowage, built to the existing interaction anchors.
 * Structural rings are hollow extrusions, doors have machined recesses, and
 * textile stores use quilted soft faces instead of tall cabinet cuboids. */
export function createStowageFabrication(parent:T.Group,onSceneChange:()=>void=()=>{}){
 const staticRoot=new T.Group();staticRoot.name="Formed stowage static installation";parent.add(staticRoot);
 const geometry:T.BufferGeometry[]=[],materials:T.Material[]=[],textures:T.Texture[]=[];
 const models:{dispose():void}[]=[];
 let disposed=false,releaseBatch=()=>{};const closureBatches:(()=>void)[]=[];
 const mat=(color:string,metalness=.2,roughness=.65)=>{
  const m=new T.MeshStandardMaterial({color,metalness,roughness});materials.push(m);return m;
 };
 const shell=mat("#d5d4c7",.28,.54),metal=mat("#899394",.68,.42),recess=mat("#283238",.12,.82),
  rubber=mat("#222828",.02,.97),cloth=mat("#b8b5a5",.02,.96),blue=mat("#667f86",.15,.64),
  orange=mat("#b98451",.18,.69),medical=mat("#9c776d",.08,.81);
 if(typeof window!=="undefined"){
  const loader=new T.TextureLoader();
  for(const [name,slot,color] of [["fabric-base","map",true],["fabric-normal","normalMap",false],["fabric-roughness","roughnessMap",false]] as const){
   const tx=loader.load(`${import.meta.env?.BASE_URL??"./"}assets/interior/${name}.webp`,loaded=>{if(disposed)loaded.dispose();else onSceneChange();});
   tx.wrapS=tx.wrapT=T.RepeatWrapping;tx.repeat.set(2,2);if(color)tx.colorSpace=T.SRGBColorSpace;
   textures.push(tx);cloth[slot]=tx;
  }
  cloth.normalScale.set(.45,.45);
 }
 function outline(w:number,h:number,r:number){
  const s=new T.Shape(),x=-w/2,y=-h/2;
  s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);
  s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);
  s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;
 }
 function extrude(w:number,h:number,r:number,depth:number,bevel=.012,hole?:[number,number,number]){
  const shape=outline(w,h,r);
  if(hole){const p=new T.Path();p.absarc(hole[0],hole[1],hole[2],0,Math.PI*2,true);shape.holes.push(p);}
  const g=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:1,curveSegments:5,steps:1});
  geometry.push(g);return g;
 }
 function ring(w:number,h:number,r:number,thickness:number,depth:number){
  const shape=outline(w,h,r),cut=outline(w-thickness*2,h-thickness*2,Math.max(.015,r-thickness));
  // Reverse the continuous inner contour so the opening is an actual hole.
  const hole=new T.Path(cut.getPoints(28).reverse());shape.holes.push(hole);
  const g=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.009,bevelThickness:.009,bevelSegments:1,curveSegments:4,steps:1});geometry.push(g);return g;
 }
 function add(host:T.Object3D,g:T.BufferGeometry,m:T.Material,x=0,y=0,z=0){
  const mesh=new T.Mesh(g,m);mesh.position.set(x,y,z);host.add(mesh);return mesh;
 }
 function pipe(host:T.Object3D,points:[number,number,number][],radius:number,m:T.Material){
  const g=new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),12,radius,6,false);geometry.push(g);return add(host,g,m);
 }
 const boltGeo=new T.CylinderGeometry(.015,.015,.014,6);geometry.push(boltGeo);
 function bolt(host:T.Object3D,x:number,y:number,z:number){const mesh=add(host,boltGeo,metal,x,y,z);mesh.rotation.x=Math.PI/2;}
 function datum(host:T.Object3D,w:number,h:number,z:number){
  for(const x of [-w*.39,w*.39])for(const y of [-h*.4,h*.4])bolt(host,x,y,z);
 }
 function tag(host:T.Object3D,text:string,w:number,y:number,z:number){
  const canvas=document.createElement("canvas");canvas.width=512;canvas.height=96;
  const ctx=canvas.getContext("2d");if(!ctx)return;
  ctx.fillStyle="#273033";ctx.fillRect(0,0,512,96);ctx.fillStyle="#e2e0d2";ctx.font="500 24px monospace";
  ctx.fillText(text,18,39,480);ctx.fillStyle="#96a4a5";ctx.font="18px monospace";ctx.fillText("RETAIN CONTENTS / LATCH BEFORE MANEUVER",18,74,480);
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;textures.push(map);
  const material=new T.MeshBasicMaterial({map});materials.push(material);
  const g=new T.PlaneGeometry(w,.14);geometry.push(g);return add(host,g,material,0,y,z);
 }
 function loadHardware(host:T.Object3D,path:string,extent:number){
  if(typeof window==="undefined")return;
  const request=createReferenceModelLoader();let gone=false,accepted:T.Group|null=null;
  request.loader.load(`${import.meta.env?.BASE_URL??"./"}assets/interior/${path}.glb`,gltf=>{
   request.dispose();if(gone||disposed){disposeObjectResources(gltf.scene);return;}
   accepted=gltf.scene;accepted.updateMatrixWorld(true);const b=new T.Box3().setFromObject(accepted),s=b.getSize(new T.Vector3()),c=b.getCenter(new T.Vector3());
   const k=extent/Math.max(s.x,s.y,s.z,1e-6);accepted.scale.multiplyScalar(k);accepted.position.sub(c.multiplyScalar(k));
   accepted.traverse(o=>{if(o instanceof T.Mesh)o.raycast=()=>{};});host.add(accepted);onSceneChange();
  },undefined,()=>request.dispose());
  models.push({dispose(){gone=true;request.dispose();if(accepted){accepted.removeFromParent();disposeObjectResources(accepted);}}});
 }
 function cabinet(key:LockerId,name:string,position:[number,number,number]){
  const anchor=new T.Group();anchor.name=`stowage-${key}`;anchor.userData.lockerId=key;anchor.userData.interactionAnchor=position;
  anchor.position.fromArray(position);parent.add(anchor);
  // Cassettes face the centre aisle, at the original station centre. Their
  // recessed back and inward face stay inside the furnished side-bay boundary.
  anchor.rotation.y=position[0]<0?Math.PI/2:-Math.PI/2;
  const mounting=new T.Group();mounting.position.copy(anchor.position);mounting.rotation.copy(anchor.rotation);staticRoot.add(mounting);
  const tall=key==="eva",w=tall?.96:.85,h=tall?2.04:.9,cy=tall?-.88:0;
  add(mounting,extrude(w,h,.13,.04),recess,0,cy,-.14);
  add(mounting,ring(w+.06,h+.06,.17,.045,.29),shell,0,cy,-.16);
  add(mounting,ring(w-.025,h-.025,.12,.018,.02),rubber,0,cy,.132);
  const trim=key==="water"?blue:key==="emergency"?medical:key==="repair"||key==="maintenance"?orange:metal;
  add(mounting,ring(w+.115,h+.115,.19,.018,.025),trim,0,cy,-.145);
  for(const offset of [-.23,.18]){
   // Folded aluminium retention shelves with rounded front edges.
   const shelf=add(mounting,extrude(w-.1,.075,.025,.23,.006),metal,0,tall?-.85+offset:offset,-.115);shelf.rotation.x=Math.PI/2;
  }
  datum(mounting,w,h,.165);
  const pivot=new T.Group();pivot.name=`stowage-door-${key}`;pivot.position.set(-w/2,cy,.17);anchor.add(pivot);
  const textile=["equipment","repair","emergency","science"].includes(key);
  const door=add(pivot,extrude(w-.035,h-.03,.12,.035,textile?.02:.01),textile?cloth:shell,w/2,0,0);
  door.name=`formed-${key}-closure`;
  add(pivot,ring(w-.08,h-.08,.1,.018,.012),textile?recess:metal,w/2,0,.05);
  if(textile){
   // Tensioned sewn diamonds and webbing follow the inflated fabric face.
   for(const y of [-h*.28,0,h*.28]){
    pipe(pivot,[[.06,y,.06],[w*.35,y+.018,.075],[w-.07,y,.06]],.009,recess);
   }
   for(const x of [w*.25,w*.75])pipe(pivot,[[x,-h*.4,.06],[x,0,.082],[x,h*.4,.06]],.012,trim);
  }else if(key==="water"){
   // A protected fluid sightglass, connector collar and three calibration marks.
   const glass=mat("#576f76",.25,.26);
   add(pivot,extrude(.13,.43,.05,.015,.004),glass,w*.32,0,.059);
   for(let i=0;i<3;i++)pipe(pivot,[[w*.23,-.13+i*.13,.083],[w*.36,-.13+i*.13,.083]],.005,metal);
  }else if(tall){
   const window=add(pivot,extrude(w-.19,h-.33,.15,.008,.004),rubber,w/2,0,.065);
   // The suit door is open-backed in the closed state: a retention screen,
   // leaving the actual stowed suit visible before it is equipped.
   window.visible=false;door.visible=false;
   for(const y of [-.62,.28])pipe(pivot,[[.07,y,.07],[w/2,y,.08],[w-.07,y,.07]],.018,trim);
  }
  pipe(pivot,[[w-.13,-.12,.055],[w-.09,-.1,.11],[w-.09,.11,.11],[w-.13,.13,.055]],.018,metal);
  for(const y of [-h*.3,h*.3]){
   const g=new T.CylinderGeometry(.032,.032,.16,10);geometry.push(g);const hinge=add(pivot,g,metal,.025,y,.017);hinge.rotation.z=Math.PI/2;
  }
  const title=tag(pivot,name.toUpperCase(),w-.14,tall?h*.5-.055:h*.31,.08);if(title)title.position.x=w/2;
  const items=[0,1,2].map(i=>{
   const tray=new T.Group();tray.name=`stowage-item-${key}-${i}`;tray.position.set(tall?0:-.25+i*.25,tall?0:-.11,.045);anchor.add(tray);
   const lazy=(load:()=>void)=>{let started=false;tray.userData.loadStowageVisual=()=>{if(started||disposed)return;started=true;load();};};
   if(tall&&i===0){lazy(()=>models.push(attachRealismModel(tray,"astronaut",{extent:1.8,position:[0,-1.87,-.02],rotation:[0,0,0],shadows:false,onLoad:model=>{const rig=rigAstronautModel(model);rig.update(0,0);models.push(rig);onSceneChange();}})));}
   else if(key==="repair"||key==="maintenance")lazy(()=>loadHardware(tray,"pistol-grip-tool",.31));
   else if(key==="equipment"||key==="emergency")lazy(()=>loadHardware(tray,"crew-lock-bag",.28));
   else if(key==="science")lazy(()=>loadHardware(tray,i===0?"infrared-camera":"crew-lock-bag",.27));
   else if(key==="water"||key==="samples"){
    const profile=[new T.Vector2(.04,-.14),new T.Vector2(.065,-.12),new T.Vector2(.07,.09),new T.Vector2(.045,.13),new T.Vector2(.04,.16)];
    const g=new T.LatheGeometry(profile,14);geometry.push(g);add(tray,g,key==="water"?blue:metal);
    const capGeo=new T.CylinderGeometry(.045,.045,.025,12);geometry.push(capGeo);add(tray,capGeo,rubber,0,.17,0);
   }
   return tray;
  });
  if(key==="emergency"){
   // The medical pouch's original anchor lies at the aisle edge. Mount its
   // shallow support outboard so its opened textile flap cannot cover the walk lane.
   mounting.translateZ(-.4);anchor.children.forEach(child=>child.position.z-=.4);
  }
  closureBatches.push(batchStaticVisuals(pivot));
  return {anchor,pivot,items,plaquePosition:new T.Vector3(0,tall?-.8:-.18,key==="emergency"?-.3:.1)};
 }
 function hatchLeaf(host:T.Object3D,x:number,y:number,z:number,id:string,side:number){
  const shape=extrude(1.02,2.5,.16,.08,.012,[-side*.19,.5,.105]);shape.translate(0,0,-.04);
  const leaf=add(host,shape,shell,x,y,z);
  leaf.name=`section-hatch-${id}-${side}`;
  add(leaf,ring(.86,2.29,.13,.022,.01),metal,0,0,.09);
  const portGeo=new T.CircleGeometry(.096,24);geometry.push(portGeo);const portMat=mat("#52666b",.32,.26);
  const port=add(leaf,portGeo,portMat,-side*.19,.5,.05);port.material.side=T.DoubleSide;
  // Embedded locking pawls and a curved emergency handhold move with the leaf.
  for(const py of [-.78,0,.78]){
   const g=new T.CylinderGeometry(.028,.028,.09,8);geometry.push(g);const pawl=add(leaf,g,metal,side*.39,py,.078);pawl.rotation.x=Math.PI/2;
  }
  pipe(leaf,[[-side*.25,-.17,.095],[-side*.3,-.12,.15],[-side*.3,.18,.15],[-side*.25,.23,.095]],.022,metal);
  leaf.children.forEach(child=>child.position.z-=.04);
  return leaf;
 }
 return {cabinet,hatchLeaf,finish(){releaseBatch=batchStaticVisuals(staticRoot);},dispose(){
  disposed=true;models.forEach(model=>model.dispose());releaseBatch();closureBatches.forEach(dispose=>dispose());staticRoot.removeFromParent();geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
 }};
}

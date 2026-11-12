import * as T from "three";
import {batchStaticVisuals} from "../presentation/staticBatch";

/** Original ORBITAL pressure module, authored in metres and exported to GLB.
 * The curved panel topology is also an offline/failure fallback. No game state. */
export function buildPressureShell() {
 const root=new T.Group();root.name="ORBITAL / manufactured pressure module";
 const mat=(name:string,color:number,metalness:number,roughness:number)=>{const m=new T.MeshStandardMaterial({name,color,metalness,roughness});return m;};
 const quilt=mat("fabric / ivory beta-cloth liner",0xd8d4c6,.02,.91);
 const paint=mat("paint / warm ceramic alloy",0xc9cdc9,.22,.57);
 const frame=mat("metal / titanium structural extrusion",0x758084,.67,.4);
 const gasket=mat("rubber / pressure seals",0x1d2427,.02,.94);
 const deck=mat("rubber / graphite nonslip deck",0x46505a,.12,.89);
 const trim=mat("paint / blue equipment rail",0x385364,.35,.56);
 const amber=mat("paint / safety yellow",0xc9a56b,.15,.65);
 const lamp=new T.MeshStandardMaterial({name:"light / recessed diffuser",color:0xf4f0dc,emissive:0xf4eedc,emissiveIntensity:.65,roughness:.8});
 const add=(geometry:T.BufferGeometry,material:T.Material,x=0,y=0,z=0)=>{const m=new T.Mesh(geometry,material);m.position.set(x,y,z);root.add(m);return m;};
 const outline=(w:number,h:number,r:number,cx=0,cy=0)=>{
  const s=new T.Shape(),x=cx-w/2,y=cy-h/2;
  s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;
 };
 const plate=(w:number,h:number,r:number,d:number,material:T.Material,x:number,y:number,z:number)=>add(new T.ExtrudeGeometry(outline(w,h,r),{depth:d,bevelEnabled:true,bevelSegments:1,bevelSize:.012,bevelThickness:.009,curveSegments:5}),material,x,y,z);
 const hose=(points:T.Vector3[],radius:number,material:T.Material,segments=44)=>add(new T.TubeGeometry(new T.CatmullRomCurve3(points),segments,radius,6,false),material);
 const cross=(angle:number)=>new T.Vector2(3.25*Math.sign(Math.cos(angle))*Math.pow(Math.abs(Math.cos(angle)),.63),1.52+1.65*Math.sign(Math.sin(angle))*Math.pow(Math.abs(Math.sin(angle)),.63));
 // Individually manufactured panels follow the pressure hull. Tiny physical
 // joints and nonuniform longitudinal module lengths avoid wallpaper repetition.
 const sections=[-7.75,-6.25,-4.35,-2.8,-1.35,.45,2.35,4.3,6.05,7.8];
 for(let bay=0;bay<sections.length-1;bay++)for(let k=0;k<16;k++){
  const a=k/16*Math.PI*2+.004,b=(k+1)/16*Math.PI*2-.004;
  const p=cross((a+b)/2);if(p.y<.16)continue;
  const pos:number[]=[],uv:number[]=[],idx:number[]=[];const nt=6,nz=4;
  for(let z=0;z<=nz;z++)for(let j=0;j<=nt;j++){
   const point=cross(a+(b-a)*j/nt);const billow=.018*Math.sin(Math.PI*j/nt)*Math.sin(Math.PI*z/nz);const n=new T.Vector2(point.x/3.25,(point.y-1.52)/1.65).normalize();point.addScaledVector(n,-billow);pos.push(point.x,point.y,sections[bay]+.018+(sections[bay+1]-sections[bay]-.036)*z/nz);uv.push(j/nt,z/nz);
  }
  for(let z=0;z<nz;z++)for(let j=0;j<nt;j++){const i=z*(nt+1)+j;idx.push(i,i+nt+1,i+1,i+1,i+nt+1,i+nt+2);}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();
  const material=p.y>.72&&(bay%3!==1||p.y>2.3)?quilt:paint;material.side=T.DoubleSide;add(geo,material);
 }
 // Deck panels are long, inset service plates rather than raised black tiles.
 for(let i=0;i<9;i++){
  const p=plate(5.6,1.65,.13,.035,deck,0,.0,-6.92+i*1.68);p.rotation.x=-Math.PI/2;
  for(const side of [-1,1]){
   const rail=plate(.11,1.56,.045,.016,frame,side*1.04,.049,-6.92+i*1.68);rail.rotation.x=-Math.PI/2;
   const marker=plate(.025,.4,.012,.009,amber,side*1.14,.055,-6.92+i*1.68);marker.rotation.x=-Math.PI/2;
  }
 }
 // Curved structural frames are real continuous sections, with recessed seals
 // and distributed screw bosses. No tall wall cabinets or ceiling crossbars.
 for(const z of [-7.55,-4.35,-1.35,2.35,7.55]){
  const points:T.Vector3[]=[];for(let j=0;j<=64;j++){const p=cross(-.02+j/64*Math.PI*1.04);points.push(new T.Vector3(p.x*.985,Math.max(.11,p.y-.035),z));}
  hose(points,.045,frame,68);
 }
 // Rounded transfer openings with stepped compression flanges. Side faces
 // remain outside existing ±.85m walkable thresholds and all target positions.
 for(const z of [-4.35,-1.35,2.35]){
  const bulk=outline(6.42,3.2,.9,0,1.55);bulk.holes.push(outline(2.24,2.65,.24,0,1.355));
  add(new T.ExtrudeGeometry(bulk,{depth:.12,bevelEnabled:true,bevelSegments:1,bevelSize:.025,bevelThickness:.02,curveSegments:9}),paint,0,0,z-.06);
  const ring=outline(2.49,2.86,.29,0,1.35);ring.holes.push(outline(2.25,2.65,.23,0,1.355));
  add(new T.ExtrudeGeometry(ring,{depth:.16,bevelEnabled:true,bevelSegments:1,bevelSize:.018,bevelThickness:.015,curveSegments:9}),frame,0,0,z-.08);
  const seal=outline(2.3,2.71,.25,0,1.355);seal.holes.push(outline(2.25,2.65,.23,0,1.355));add(new T.ExtrudeGeometry(seal,{depth:.18,bevelEnabled:false,curveSegments:9}),gasket,0,0,z-.09);
  for(const side of [-1,1]){
   const hand=[new T.Vector3(side*1.26,1.08,z+.21),new T.Vector3(side*1.33,1.18,z+.29),new T.Vector3(side*1.33,1.78,z+.29),new T.Vector3(side*1.26,1.89,z+.21)];hose(hand,.025,frame,18);
   // Fastener locations follow the flanges rather than a repetitive bolt grid.
   for(const y of [.24,.75,2.05,2.47]){const screw=add(new T.CylinderGeometry(.022,.022,.025,6),frame,side*1.19,y,z+.117);screw.rotation.x=Math.PI/2;}
  }
 }
 // Integrated lighting coves: light surfaces face the cabin, hidden inside a
 // shallow gasket trough. Their warm panels are emissive, not neon tubes.
 for(const z of [-6.6,-3.05,.45,4.4,6.4])for(const side of [-1,1]){
  const trough=plate(.36,1.13,.13,.055,gasket,side*2.42,2.91,z);trough.rotation.x=Math.PI/2;trough.rotation.y=-side*.44;
  const light=plate(.21,.94,.075,.009,lamp,side*2.4,2.83,z);light.rotation.x=Math.PI/2;light.rotation.y=-side*.44;
 }
 // Routed utility bundles stay beside the liner. Soft bends and metal saddles
 // communicate a continuous service system; every run terminates at a module.
 for(const side of [-1,1])for(let cable=0;cable<3;cable++){
  hose([new T.Vector3(side*2.94,2.37+cable*.055,-7.3),new T.Vector3(side*3.02,2.40+cable*.055,-2.1),new T.Vector3(side*3.02,2.40+cable*.055,3.1),new T.Vector3(side*2.94,2.37+cable*.055,7.4)],cable===0?.023:.014,cable===1?trim:gasket,58);
 }
 for(const z of [-5.1,-2.4,1.5,3.5,6.5])for(const side of [-1,1]){
  hose([new T.Vector3(side*3.08,1.07,z-.27),new T.Vector3(side*2.98,1.07,z-.21),new T.Vector3(side*2.98,1.07,z+.21),new T.Vector3(side*3.08,1.07,z+.27)],.023,frame,16);
 }
 // Purpose-built aft pressure closure with a proper oval compression flange.
 const aft=outline(6.4,3.3,.86,0,1.58);aft.holes.push(outline(1.64,2.5,.48,0,1.3));
 add(new T.ExtrudeGeometry(aft,{depth:.13,bevelEnabled:true,bevelSize:.025,bevelThickness:.02,bevelSegments:1,curveSegments:10}),paint,0,0,7.72);
 const aftRing=outline(1.91,2.75,.57,0,1.3);aftRing.holes.push(outline(1.64,2.5,.48,0,1.3));add(new T.ExtrudeGeometry(aftRing,{depth:.18,bevelEnabled:true,bevelSize:.02,bevelThickness:.015,bevelSegments:1,curveSegments:10}),frame,0,0,7.64);
 // The front pressure glazing frame is deliberately deep and swept, with two
 // large unoccluded apertures. Actual planets stay in the existing world scene.
 const nose=outline(6.5,3.25,.65,0,1.53);
 for(const side of [-1,1])nose.holes.push(outline(2.67,1.65,.26,side*1.47,2.02));
 add(new T.ExtrudeGeometry(nose,{depth:.26,bevelEnabled:true,bevelSize:.04,bevelThickness:.04,bevelSegments:2,curveSegments:10}),paint,0,0,-7.73);
 for(const side of [-1,1]){
  const seal=outline(2.79,1.78,.29,side*1.47,2.02);seal.holes.push(outline(2.67,1.65,.26,side*1.47,2.02));add(new T.ExtrudeGeometry(seal,{depth:.1,bevelEnabled:true,bevelSize:.012,bevelThickness:.008,bevelSegments:1,curveSegments:10}),gasket,0,0,-7.4);
 }
 batchStaticVisuals(root);return root;
}

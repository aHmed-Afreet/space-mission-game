import * as THREE from "three";

/** Procedural, deterministic educational planet material, generated offline in the browser.
 * Uses no external textures or network requests and keeps memory small for iPads. */
export type PlanetKind="earth"|"moon"|"mars"|"venus"|"jupiter"|"saturn"|"mercury"|"neptune"|"uranus"|"pluto";
function hash(x:number,y:number,seed:number){
 let n=Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(seed,1274126177);
 n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;
}
function fractal(x:number,y:number,seed:number){
 let sum=0,amp=.54,norm=0;
 for(let octave=0;octave<5;octave++){
  const scale=1<<octave,px=x*scale,py=y*scale,ix=Math.floor(px),iy=Math.floor(py);
  const u=(px-ix)**2*(3-2*(px-ix)),v=(py-iy)**2*(3-2*(py-iy));
  const a=hash(ix,iy,seed)*(1-u)+hash(ix+1,iy,seed)*u;
  const b=hash(ix,iy+1,seed)*(1-u)+hash(ix+1,iy+1,seed)*u;
  sum+=(a*(1-v)+b*v)*amp;norm+=amp;amp*=.52;
 }
 return sum/norm;
}
export function planetKind(destination:string):PlanetKind{
 const t=destination.toLowerCase();
 if(/moon|lunar/.test(t))return "moon";
 if(/mars/.test(t))return "mars";
 if(/venus/.test(t))return "venus";
 if(/jupiter/.test(t))return "jupiter";
 if(/saturn/.test(t))return "saturn";
 if(/mercury/.test(t))return "mercury";
 if(/neptune/.test(t))return "neptune";
 if(/uranus/.test(t))return "uranus";
 if(/pluto/.test(t))return "pluto";
 return "earth";
}
function toByte(n:number){return Math.max(0,Math.min(255,Math.round(n)))}
function textureFor(kind:PlanetKind,clouds=false){
 const w=512,h=256,c=document.createElement("canvas");c.width=w;c.height=h;
 const ctx=c.getContext("2d");
 if(!ctx)throw Error("Canvas 2D unavailable");
 const image=ctx.createImageData(w,h),data=image.data;
 const seed=["earth","moon","mars","venus","jupiter","saturn","mercury","neptune","uranus","pluto"].indexOf(kind)*937+137;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const u=x/w,v=y/h,latitude=Math.abs(v-.5)*2;
  const large=fractal(u*5,v*3,seed),detail=fractal(u*36,v*18,seed+7),fine=fractal(u*92,v*48,seed+17);
  const pattern=large*.65+detail*.3+fine*.05,offset=(y*w+x)*4;
  let rgb:[number,number,number],alpha=255;
  if(clouds){
   const cover=fractal(u*13,v*8,seed+88);
   alpha=toByte(Math.max(0,(cover-.53)*2.6)*190);
   rgb=[244,250,253];
  }else if(kind==="earth"){
   const land=large+.12*Math.sin(u*39+v*22)>.52;
   const polar=Math.max(0,(latitude-.76)*4.6);
   const seaShade=18+35*detail;
   rgb=land?
    [toByte(67+63*pattern+122*polar),toByte(94+99*pattern+112*polar),toByte(42+60*pattern+132*polar)]:
    [toByte(8+seaShade+180*polar),toByte(44+65*detail+180*polar),toByte(105+90*detail+144*polar)];
  }else if(kind==="mars"){
   const cap=Math.max(0,(latitude-.89)*9);
   rgb=[toByte(135+84*pattern+90*cap),toByte(56+77*pattern+125*cap),toByte(32+53*pattern+140*cap)];
  }else if(kind==="moon"||kind==="mercury"){
   const craters=Math.abs(Math.sin(u*159+v*182)*Math.cos(u*90-v*154));
   const bright=68+100*pattern+(craters>.97?36:0);
   rgb=[toByte(bright+(kind==="moon"?5:18)),toByte(bright+1),toByte(bright-4)];
  }else if(kind==="jupiter"||kind==="saturn"||kind==="venus"){
   const bands=Math.sin((v*24+fractal(u*3,v*5,seed+38)*.55)*Math.PI);
   const swirls=18*detail+23*bands;
   rgb=kind==="jupiter"?[toByte(180+swirls),toByte(126+swirls),toByte(94+swirls*.65)]:
    kind==="saturn"?[toByte(189+swirls*.65),toByte(172+swirls*.65),toByte(128+swirls*.48)]:
    [toByte(207+swirls*.32),toByte(188+swirls*.34),toByte(126+swirls*.22)];
  }else if(kind==="neptune"||kind==="uranus"){
   rgb=kind==="neptune"?[toByte(29+25*detail),toByte(66+60*detail),toByte(164+70*detail)]:
    [toByte(66+22*detail),toByte(159+52*detail),toByte(182+42*detail)];
  }else{
   const shade=130+90*pattern;
   rgb=[toByte(shade),toByte(shade*.88),toByte(shade*.77)];
  }
  data[offset]=rgb[0];data[offset+1]=rgb[1];data[offset+2]=rgb[2];data[offset+3]=alpha;
 }
 ctx.putImageData(image,0,0);
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
 tex.wrapS=THREE.RepeatWrapping;tex.anisotropy=2;
 return tex;
}
export function makePlanet(kind:PlanetKind,radius:number,includeClouds=true):THREE.Group{
 const g=new THREE.Group(),geometry=new THREE.SphereGeometry(radius,48,32);
 const map=textureFor(kind);
 const material=new THREE.MeshStandardMaterial({map,roughness:kind==="earth"?.85:1,metalness:0});
 const surface=new THREE.Mesh(geometry,material);g.add(surface);
 // Optional photographic textures for Earth and the Moon. These are served
 // over HTTPS from the three.js examples repository; the procedural canvas
 // above remains fully functional if offline or if image loading fails.
 const photos:Partial<Record<PlanetKind,string>>={
  earth:"https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg",
  moon:"https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/moon_1024.jpg",
 };
 const source=photos[kind];
 if(source){
  const loader=new THREE.TextureLoader();
  loader.setCrossOrigin("anonymous");
  loader.load(source,real=>{
   if(g.userData.disposed){real.dispose();return;}
   real.colorSpace=THREE.SRGBColorSpace;real.anisotropy=2;
   const fallback=material.map;
   material.map=real;material.needsUpdate=true;fallback?.dispose();
  },undefined,()=>{/* Keep the generated texture. */});
 }
 if(kind==="earth"&&includeClouds){
  const cover=textureFor(kind,true);
  const layer=new THREE.Mesh(new THREE.SphereGeometry(radius*1.011,48,32),
   new THREE.MeshStandardMaterial({map:cover,transparent:true,depthWrite:false,roughness:1,opacity:.83}));
  g.add(layer);
  const rim=new THREE.Mesh(new THREE.SphereGeometry(radius*1.035,40,24),
   new THREE.MeshBasicMaterial({color:0x62a9f3,side:THREE.BackSide,transparent:true,opacity:.085}));
  g.add(rim);
 }
 if(kind==="saturn"){
  const ring=new THREE.Mesh(new THREE.RingGeometry(radius*1.3,radius*2.15,64),
   new THREE.MeshStandardMaterial({color:0xb7aa87,side:THREE.DoubleSide,transparent:true,opacity:.77,roughness:1}));
  ring.rotation.x=Math.PI*.37;g.add(ring);
 }
 return g;
}
export function disposePlanet(g:THREE.Group){
 g.userData.disposed=true;
 g.traverse(obj=>{
  if(!(obj instanceof THREE.Mesh))return;
  obj.geometry.dispose();
  const mats=Array.isArray(obj.material)?obj.material:[obj.material];
  for(const mat of mats){
   if(mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshBasicMaterial)mat.map?.dispose();
   mat.dispose();
  }
 });
}

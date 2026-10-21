import * as T from "three";

/**
 * Original geometric spacecraft architecture. All repeated fittings are sent
 * through Interior's instanced part/pipe batching rather than separate meshes.
 * The open centre aisle, station positions and pressure-hatch planes are kept
 * identical to the working mission simulator.
 */
type Part=(x:number,y:number,z:number,w:number,h:number,d:number,
 material:T.Material,rotation?:[number,number,number],geo?:T.BufferGeometry)=>void;
type Pipe=(from:T.Vector3,to:T.Vector3,r:number,material?:T.Material)=>void;
type Screen=(x:number,y:number,z:number,w:number,h:number,role?:number)=>void;
type Label=(text:string,x:number,y:number,z:number,w?:number,h?:number)=>void;
type Material=(color:string,metal?:number,rough?:number,emissive?:string)=>T.MeshStandardMaterial;

export function installShipArchitecture(
 part:Part,pipe:Pipe,screen:Screen,label:Label,mat:Material,
 mode:"quality"|"balanced"|"battery"="balanced",
){
 const detail=mode==="quality"?3:mode==="battery"?1:2;
 // Aircraft-grade alloys, anodised control surfaces and intentionally restrained
 // practical lighting evoke a working crew vehicle instead of an empty corridor.
 const spine=mat("#192a36",.64,.37);
 const graphite=mat("#111e29",.35,.7);
 const alloy=mat("#687c8b",.74,.28);
 const titanium=mat("#a4b1ba",.58,.33);
 const ceramic=mat("#8e9a9b",.18,.72);
 const trim=mat("#293d4e",.4,.5);
 const carpet=mat("#1d2b36",.14,.94);
 const status=mat("#0c6c78",.16,.3,"#1eb4c0");
 status.emissiveIntensity=.45;
 const warning=mat("#99643d",.25,.48,"#e3a45a");
 warning.emissiveIntensity=.28;
 const glow=mat("#c7eaf0",.03,.34,"#7ad4e2");
 glow.emissiveIntensity=1.15;
 const seal=mat("#0d141a",.06,.86);
 const accent=mat("#d0a76c",.4,.42);
 const bolts=mat("#c9d0cd",.6,.34);
 // A tiny reusable painted-alloy texture with seams, serial marks and
 // brushed wear makes large panels look manufactured instead of flat cubes.
 // All geometry still uses shared materials/instancing.
 const textureCanvas=document.createElement("canvas");
 textureCanvas.width=512;textureCanvas.height=512;
 const g=textureCanvas.getContext("2d");
 if(g){
  g.fillStyle="#d5d9d8";g.fillRect(0,0,512,512);
  for(let y=0;y<512;y+=2){
   const shade=Math.round(171+Math.sin(y*.77)*13+Math.sin(y*3.29)*6);
   g.fillStyle=`rgba(26,37,45,${Math.max(.03,(210-shade)/800)})`;
   g.fillRect(0,y,512,1);
  }
  g.strokeStyle="rgba(32,42,51,.28)";g.lineWidth=5;
  g.strokeRect(12,12,488,488);
  g.strokeStyle="rgba(245,248,249,.54)";g.lineWidth=2;
  g.strokeRect(20,20,472,472);
  g.fillStyle="#596772";
  for(const x of [31,481])for(const y of [31,481]){
   g.beginPath();g.arc(x,y,6,0,Math.PI*2);g.fill();
   g.strokeStyle="#dbe3e5";g.lineWidth=1;
   g.beginPath();g.moveTo(x-3,y+2);g.lineTo(x+3,y-2);g.stroke();
  }
  g.fillStyle="#53636a";g.font="bold 17px monospace";
  g.fillText("ORBITAL / PANEL ASSY",35,63);
  g.font="13px monospace";g.fillText("ACCESS  ·  04 / INSPECT",35,467);
  const map=new T.CanvasTexture(textureCanvas);
  map.colorSpace=T.SRGBColorSpace;map.anisotropy=2;
  for(const material of [ceramic,trim,alloy]){
   material.map=map;material.needsUpdate=true;
  }
 }
 const v=(x:number,y:number,z:number)=>new T.Vector3(x,y,z);

 // Eight-sided pressure tunnel: tapered overhead shoulders and thick frames.
 // Structural modules terminate at the actual hatch planes.
 const sections:[number,number][]=[[-7.65,-4.5],[-4.16,-1.51],[-1.19,2.16],[2.52,7.52]];
 for(const [from,to] of sections){
  for(let z=from;z<=to+.01;z+=1.16){
   for(const side of [-1,1]){
    part(side*3.09,1.42,z,.15,2.48,.11,spine);
    part(side*2.84,2.55,z,.22,.12,.12,titanium,[0,0,side*.77]);
    part(side*2.43,2.75,z,.38,.09,.12,alloy,[0,0,side*.18]);
    part(side*2.96,.25,z,.22,.18,.12,alloy);
    // Recessed tubular handholds and dark rubber grip brackets.
    part(side*2.88,1.44,z+.13,.12,.28,.15,graphite);
   }
   part(0,2.79,z,4.88,.08,.1,spine);
   part(0,.07,z,5.4,.065,.13,spine);
  }
  for(const side of [-1,1]){
   pipe(v(side*2.83,2.25,from),v(side*2.83,2.25,to),.028,titanium);
   pipe(v(side*2.84,1.12,from),v(side*2.84,1.12,to),.028,alloy);
   part(side*2.69,2.64,(from+to)/2,.53,.035,to-from,glow,[0,0,side*.48]);
   part(side*3.045,.49,(from+to)/2,.05,.07,to-from,spine);
   // Continuous electrical raceways above crew height.
   part(side*3.045,2.27,(from+to)/2,.095,.23,to-from,graphite);
  }
  // Low glare ceiling panels and ventilation banks.
  const centre=(from+to)/2,span=to-from;
  part(0,2.85,centre,3.7,.08,span,graphite);
  for(const x of [-1.38,1.38]){
   for(let z=from+.32;z<to-.2;z+=.72){
    part(x,2.79,z,.92,.038,.48,trim);
    if(detail>1)for(let k=0;k<4;k++)
     part(x-.3+k*.2,2.766,z,.038,.018,.33,spine);
   }
  }
  // Aisle floor: dark recessed tread rather than a featureless flat rectangle.
  part(0,.047,centre,1.92,.017,span,carpet);
  for(let z=from+.12;z<to;z+=.39){
   part(0,.061,z,1.45,.006,.012,alloy);
   if(detail>1){
    part(-.95,.064,z,.025,.008,.23,warning);
    part(.95,.064,z,.025,.008,.23,warning);
   }
  }
 }

 // Fluorescent-style recessed panels with mechanical cage fittings.
 for(const z of [-6.0,-3.1,.45,4.6,6.3]){
  part(0,2.745,z,1.62,.06,.62,graphite);
  for(const x of [-.47,0,.47])part(x,2.7,z,.31,.022,.48,glow);
  part(-.85,2.68,z,.055,.09,.63,alloy);
  part(.85,2.68,z,.055,.09,.63,alloy);
  if(detail>1){
   for(let k=0;k<5;k++)
    part(-.81+k*.4,2.705,z+.29,.02,.02,.045,titanium);
  }
 }

 // Hatch collars: hexagonal edges with tactile grips and hazard stripes.
 // Avoid placing new opaque geometry through the traversable doorway.
 for(const z of [-4.35,-1.35,2.35]){
  for(const side of [-1,1]){
   part(side*1.23,1.34,z,.13,2.55,.25,spine);
   part(side*1.32,1.36,z+.19,.09,1.96,.045,titanium);
   part(side*1.34,2.37,z+.18,.18,.08,.08,warning);
   for(const y of [.45,.9,1.65,2.1])
    part(side*1.26,y,z+.23,.035,.06,.05,bolts);
  }
  part(0,2.56,z,2.6,.24,.2,spine);
  part(0,2.43,z+.17,1.84,.05,.065,glow);
  part(0,.115,z,2.47,.035,.22,titanium);
  for(const x of [-1.05,-.78,.78,1.05])
   part(x,.147,z+.18,.17,.015,.05,warning);
 }

 // Forward panoramic canopy and cockpit framing. View outside remains clear.
 // A realistic view is obtained through dark recesses with bevelled pylons,
 // not a giant glass-textured flat wall.
 const z=-7.55;
 for(const side of [-1,1]){
  part(side*2.96,1.88,z+.19,.35,1.58,.27,spine,[0,0,side*.19]);
  part(side*2.19,2.65,z+.21,1.63,.21,.23,alloy,[0,0,side*.28]);
  part(side*2.12,1.2,z+.21,1.5,.11,.32,spine,[0,0,-side*.12]);
  part(side*2.39,1.55,z+.21,.24,.89,.2,titanium,[0,0,side*.24]);
  for(let j=0;j<3;j++)
   part(side*(1.24+j*.39),.76,z+1.15,.22,.035,.59,graphite);
 }
 part(0,2.73,z+.21,3.12,.23,.21,spine);
 part(0,1.05,z+.3,3.45,.22,.28,graphite);
 part(0,1.10,z+1.38,3.32,.16,.81,spine,[-.18,0,0]);
 // Flight instrumentation: continuous angled display arc.
 for(const [x,w,r] of [[-1.31,.77,1],[0,1.12,0],[1.31,.77,2]] as [number,number,number][]){
  part(x,1.18,-6.24,w+.14,.77,.16,graphite,[-.22,0,0]);
  screen(x,1.26,-6.09,w,.45,r);
  part(x,1.58,-6.13,w+.18,.045,.17,titanium);
  part(x,1.0,-5.86,w+.19,.055,.3,alloy);
  for(let k=0;k<4;k++){
   part(x-w*.34+(k*w*.23),.96,-5.67,.084,.025,.093,k===0?warning:status);
  }
 }
 // Overhead emergency annunciator and switch grids.
 part(0,2.63,-6.44,2.06,.08,.88,graphite,[-.33,0,0]);
 for(let col=0;col<11;col++)for(let row=0;row<3;row++){
  const m=(col+row*3)%12===0?warning:(col+row)%4===0?status:alloy;
  part(-.91+col*.182,2.565,-6.66+row*.2,.078,.014,.085,m);
 }
 // Twin pilot side consoles, control sticks, restraint hardware.
 for(const side of [-1,1]){
  part(side*1.85,.65,-6.45,.78,.98,1.7,graphite,[0,0,-side*.11]);
  part(side*1.84,1.12,-6.5,.87,.1,1.62,spine,[0,0,-side*.11]);
  part(side*1.84,1.18,-6.57,.66,.036,1.13,trim);
  for(let k=0;k<7;k++){
   part(side*1.84,1.209,-7.0+k*.14,.45,.012,.065,k%3===0?status:alloy);
  }
  // Yoke and hand-control mechanism, each with articulated support.
  pipe(v(side*.93,.86,-5.94),v(side*.93,1.32,-5.83),.053,graphite);
  part(side*.93,1.35,-5.81,.16,.23,.12,spine,[-.24,0,0]);
  part(side*1.0,1.41,-5.85,.085,.063,.07,status);
  part(side*.82,.63,-5.12,.1,.42,.17,alloy);
  for(const k of [-1,1]){
   part(side*.82+k*.21,.37,-5.15,.29,.15,.12,spine);
   part(side*.82+k*.21,.49,-5.15,.2,.055,.13,ceramic);
  }
 }
 label("FLIGHT CONTROL · NAV / SYSTEMS",0,2.55,-6.45,1.5,.13);

 // Module equipment carriers. Put all additional detail against walls,
 // never at the player's reachable station console collision coordinates.
 for(const section of [
   {z:-3.05,code:"SCIENCE / RADIO",role:2},
   {z:.52,code:"POWER / ECLSS",role:3},
   {z:4.64,code:"CREW / LOGISTICS",role:1},
 ]){
  for(const side of [-1,1]){
   const x=side*3.015;
   part(x,1.47,section.z,.15,1.47,1.75,spine);
   for(let y=.94;y<2.11;y+=.22){
    part(side*2.906,y,section.z,.04,.032,1.62,trim);
   }
   for(const k of [-1,1]){
    part(side*2.92,1.55,section.z+k*.66,.08,1.13,.065,titanium);
   }
   part(side*2.91,2.23,section.z,.105,.07,1.76,glow);
   if(detail>1){
    for(let row=0;row<5;row++)for(let col=0;col<4;col++){
     part(side*2.897,1.13+row*.17,section.z-.46+col*.27,.019,.036,.1,
      (row+col)%7===0?warning:alloy);
    }
   }
  }
  // Flush floor-edge cabinets with retention tabs and numbered labels.
  for(const side of [-1,1]){
   part(side*2.65,.37,section.z,.65,.55,1.0,graphite);
   for(const offset of [-.31,.31]){
    part(side*2.31,.4,section.z+offset,.05,.4,.37,ceramic);
    part(side*2.25,.42,section.z+offset,.03,.13,.08,alloy);
   }
  }
  label(section.code,0,2.53,section.z-.16,1.14,.1);
 }

 // Longitudinal surface fasteners and low-voltage status strips.
 if(detail>1){
  for(let z=-7.25;z<7.25;z+=.54){
   for(const side of [-1,1]){
    part(side*3.044,1.82,z,.024,.023,.045,bolts);
    part(side*3.035,.62,z,.022,.02,.16,accent);
   }
  }
 }
}

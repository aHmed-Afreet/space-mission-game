import * as T from "three";
import type { StoryScenario, Station } from "./storyScenarios";
import { storyArchitecture, storyPalette } from "./storyArchitecture";

/** A readable, compact instrument texture per console; no HTML rendered in 3D.
 * Values illustrate the simulation, not live telemetry or exact historic data. */
export function storyInstrumentMaterial(scenario: StoryScenario, station: Station): T.MeshBasicMaterial {
 const architecture=storyArchitecture(scenario), color=storyPalette[architecture].instrument;
 const canvas=document.createElement("canvas");canvas.width=512;canvas.height=256;
 const c=canvas.getContext("2d");
 if(c){
  c.fillStyle=architecture==="apollo"||architecture==="early-capsule"?"#171b1b":"#08151b";
  c.fillRect(0,0,512,256);
  c.fillStyle=color;c.font="bold 19px monospace";
  c.fillText(({brief:"FLIGHT PLAN",systems:"SYSTEMS STATUS",operations:"GUIDANCE / NAV",science:"SCIENCE DATA"})[station],18,29);
  c.globalAlpha=.6;c.fillRect(18,42,476,1);c.globalAlpha=1;
  c.font="12px monospace";c.fillText("EDUCATIONAL SIMULATION",18,244);
  if((architecture==="apollo"||architecture==="early-capsule")&&station!=="brief"){
   for(let i=0;i<3;i++){
    const x=94+i*162,y=126,r=54;
    c.fillStyle="#0c1010";c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();
    c.strokeStyle="#bfc4b6";c.lineWidth=2;c.stroke();
    for(let n=0;n<11;n++){
     const a=(n/10)*Math.PI*1.5+Math.PI*.75;
     c.beginPath();c.moveTo(x+Math.cos(a)*43,y+Math.sin(a)*43);c.lineTo(x+Math.cos(a)*49,y+Math.sin(a)*49);c.stroke();
    }
    const a=[-.9,-1.65,-.55][i];c.strokeStyle="#e4ded0";c.lineWidth=2.5;
    c.beginPath();c.moveTo(x-4*Math.cos(a),y-4*Math.sin(a));c.lineTo(x+38*Math.cos(a),y+38*Math.sin(a));c.stroke();
    c.fillStyle="#c1c3b5";c.textAlign="center";c.font="12px monospace";
    c.fillText((station==="systems"?["DC BUS","CABIN","O₂ SUPPLY"]:station==="operations"?["PITCH","YAW","ROLL"]:["SENSOR A","SENSOR B","RECORDER"])[i],x,205);
   }
   c.textAlign="left";
  }else if(station==="operations"||station==="brief"){
   c.strokeStyle="#45616a";c.lineWidth=1;
   for(let x=25;x<330;x+=32){c.beginPath();c.moveTo(x,59);c.lineTo(x,219);c.stroke();}
   for(let y=59;y<220;y+=32){c.beginPath();c.moveTo(25,y);c.lineTo(313,y);c.stroke();}
   c.strokeStyle=color;c.lineWidth=2;c.beginPath();c.ellipse(167,140,116,51,-.35,0,Math.PI*2);c.stroke();
   c.fillStyle="#9eaa98";c.beginPath();c.arc(150,145,27,0,Math.PI*2);c.fill();
   c.fillStyle=color;c.beginPath();c.arc(258,103,4,0,Math.PI*2);c.fill();
   c.font="13px monospace";["FLIGHT PLAN","ATTITUDE REF","TRACK VERIFIED","SIM / NOMINAL"].forEach((s,i)=>c.fillText(s,337,88+i*35));
  }else{
   c.font="14px monospace";
   const rows=station==="systems"?["POWER BUS","THERMAL","COMM LINK","RECORDER"]:["INSTRUMENT","CALIBRATION","SIGNAL","DATA BUFFER"];
   rows.forEach((label,i)=>{
    const y=77+i*38;c.fillStyle=color;c.fillText(label,19,y);
    c.fillStyle="#1e353d";c.fillRect(184,y-13,217,15);c.fillStyle=color;c.fillRect(184,y-13,[179,151,195,166][i],15);
    c.fillText(i===0?"NOMINAL":"READY",420,y);
   });
  }
 }
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
 texture.minFilter=T.LinearFilter;texture.generateMipmaps=false;
 return new T.MeshBasicMaterial({map:texture,toneMapped:false});
}

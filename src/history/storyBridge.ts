import * as T from "three";
import type { StoryScenario } from "./storyScenarios";
import { storyArchitecture } from "./storyArchitecture";
import { fabricationMaterials, formedPanel, roundedProfile, route, finishFabrication } from "./storyFabrication";

/** Original, family-specific pressure architecture. The navigable training
 * volume is deliberately expanded; no source claims exact historical dimensions.
 * Four task footprints and the aft hatch remain the existing gameplay geometry. */
export function installStoryBridge(root:T.Group,scenario:StoryScenario){
 const kind=storyArchitecture(scenario),m=fabricationMaterials(kind),crew=kind!=="ground-control";
 const structure=new T.Group();structure.name=`${kind} manufactured pressure architecture`;root.add(structure);
 const roof=kind==="early-capsule"?3.45:kind==="shuttle"?3.7:kind==="apollo"?3.65:3.95;
 const width=6.15,shoulder=2.3;
 const profile:T.Vector2[]=[new T.Vector2(-width,.02),new T.Vector2(-width,shoulder)];
 for(let i=1;i<=24;i++){const a=Math.PI-i*Math.PI/24;profile.push(new T.Vector2(Math.cos(a)*width,shoulder+Math.sin(a)*(roof-shoulder)));}
 profile.push(new T.Vector2(width,.02));
 function liningSegment(a:T.Vector2,b:T.Vector2,z1:number,z2:number,material:T.Material){
  const p=[a.x,a.y,z1,b.x,b.y,z1,b.x,b.y,z2,a.x,a.y,z2];
  const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(p,3));g.setAttribute("uv",new T.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();
  const mesh=new T.Mesh(g,material);structure.add(mesh);
 }
 if(crew){
  // An insulated pressure barrel: upper liner fabric between continuous formed
  // structural segments rather than a bare single-colour cylindrical ceiling.
  for(let z=-6.75;z<6.8;z+=2.25){
   for(let i=0;i<profile.length-1;i++)liningSegment(profile[i],profile[i+1],z,Math.min(6.85,z+2.22),i>2&&i<profile.length-4?m.fabric:m.shell);
  }
  for(const z of[-6.62,-4.4,-2.2,0,2.2,4.4,6.62]){
   const points=profile.map(p=>[p.x,p.y,z]as const);route(structure,points,.047,m.structure,52);
   const inner=profile.map(p=>[p.x*.994,p.y-.035,z+.08]as const);route(structure,inner,.015,m.dark,52);
  }
 }else{
  const walls=formedPanel(structure,12.5,4.7,.12,.15,m.shell,0,2.3,6.9);
  walls.name="Earth operations room rear wall";
  for(const side of[-1,1]){const wall=formedPanel(structure,13.7,4.7,.12,.15,m.shell,side*6.25,2.3,0);wall.rotation.y=Math.PI/2;}
  const ceiling=formedPanel(structure,12.5,13.7,.12,.15,m.shell,0,4.65,0);ceiling.rotation.x=Math.PI/2;
  // Glazed exhibition/operations gallery is visibly terrestrial, with no
  // pressure-rib styling or EVA storage presented as robotic spacecraft rooms.
  const rear=formedPanel(structure,25.5,14,.12,.15,m.shell,0,7,-22);rear.name="Terrestrial operations gallery";
  for(const side of[-1,1]){const wall=formedPanel(structure,16,14,.12,.15,m.shell,side*12.8,7,-14);wall.rotation.y=Math.PI/2;}
 }
 // Recessed service bays. Their main frames have rounded corners and an actual
 // inset opening; equipment lies inside that recess rather than on black boxes.
 for(const side of[-1,1])for(let n=0;n<5;n++){
  const z=-5.1+n*2.45,bay=new T.Group();bay.position.set(side*5.95,1.4,z);bay.rotation.y=-side*Math.PI/2;structure.add(bay);
  const shape=roundedProfile(2.18,2.18,.16);shape.holes.push(roundedProfile(1.95,1.94,.11));
  const frame=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.09,bevelEnabled:true,bevelSize:.018,bevelThickness:.018,bevelSegments:1,curveSegments:5}),m.structure);bay.add(frame);
  formedPanel(bay,1.93,1.92,.025,.12,m.dark,0,0,-.05);
  if(kind==="station"&&(n===1||n===3)){
   for(let i=0;i<3;i++){
    const pouch=formedPanel(bay,1.7,.48,.13,.14,m.fabric,0,.64-i*.61,.02);
    pouch.name="rounded textile cargo transfer bag";
    const a=pouch.geometry.attributes.position;
    for(let k=0;k<a.count;k++)if(a.getZ(k)>0)a.setZ(k,a.getZ(k)+.07*Math.max(0,1-Math.pow(a.getX(k)/.86,2))*Math.max(0,1-Math.pow(a.getY(k)/.25,2)));
    pouch.geometry.computeVertexNormals();
    route(bay,[[-.3,.64-i*.61,.2],[-.25,.72-i*.61,.25],[.25,.72-i*.61,.25],[.3,.64-i*.61,.2]],.022,m.trim,14);
   }
  }else{
   for(let i=0;i<3;i++){
    const panel=formedPanel(bay,1.69,.44,.07,.055,n%2?m.shell:m.structure,0,.62-i*.61,.02);panel.name="replaceable service equipment drawer";
    route(bay,[[-.62,.64-i*.61,.13],[-.56,.73-i*.61,.18],[.56,.73-i*.61,.18],[.62,.64-i*.61,.13]],.018,m.trim,14);
    // Slotted grille is part of the machinery, not a generic raised cabinet face.
    for(let k=0;k<6;k++)formedPanel(bay,.23,.014,.01,.006,m.dark,-.58+k*.23,.49-i*.61,.07);
   }
  }
  for(const x of[-.95,.95])for(const y of[-.95,.95]){
   const screw=new T.Mesh(new T.CircleGeometry(.023,8),m.warning);screw.position.set(x,y,.112);bay.add(screw);
  }
 }
 // Cable/handrail runs follow the shell shoulder and turn into equipment bays.
 for(const side of[-1,1]){
  route(structure,[[side*5.5,2.72,-6.5],[side*5.5,2.72,-3],[side*5.5,2.72,3],[side*5.5,2.72,6.5]],.027,m.dark,20);
  route(structure,[[side*5.48,2.83,-6.5],[side*5.48,2.83,-2],[side*5.48,2.83,4],[side*5.48,2.83,6.5]],.018,m.warning,20);
  for(const z of[-4.7,-1.4,1.9,5.1])route(structure,[[side*5.7,2.39,z-.42],[side*5.48,2.42,z-.32],[side*5.48,2.42,z+.32],[side*5.7,2.39,z+.42]],.035,m.structure,18);
 }
 // Thin shaped floor access hatches; a subtle centre path leaves suit clearance.
 for(let z=-5.8;z<6.5;z+=1.2){
  const plate=formedPanel(structure,3.25,1.14,.018,.12,m.floor,0,-.025,z);plate.rotation.x=-Math.PI/2;
  for(const side of[-1,1]){const stripe=formedPanel(structure,.045,.57,.01,.012,m.warning,side*2.13,.01,z);stripe.rotation.x=-Math.PI/2;}
 }
 // Visible diffuser troughs are recessed into the shaped pressure lining.
 for(const side of[-1,1])for(const z of[-4.5,0,4.5]){
  const fitting=formedPanel(structure,.52,3.5,.09,.16,m.trim,side*3.2,roof-.27,z);fitting.rotation.x=Math.PI/2;
  const lens=formedPanel(structure,.35,3.27,.045,.12,m.light,side*3.2,roof-.32,z);lens.rotation.x=Math.PI/2;
 }
 // Forward ring/window sill: chamfered apertures and rubber pressure gaskets.
 const forward=roundedProfile(12.35,roof-.1,.43);forward.holes.push(roundedProfile(9.1,1.84,.3));
 const front=new T.Mesh(new T.ExtrudeGeometry(forward,{depth:.15,bevelEnabled:true,bevelSize:.035,bevelThickness:.02,bevelSegments:1,curveSegments:6}),m.shell);front.position.set(0,roof/2,-6.8);structure.add(front);
 for(const side of[-1,1])route(structure,[[side*4.7,.94,-6.59],[side*4.75,2.76,-6.59],[side*3.7,3.01,-6.59],[side*.25,3.01,-6.59]],.035,m.dark,30);
 route(structure,[[0,.8,-6.56],[0,2.2,-6.56],[0,3.12,-6.56]],.065,m.structure,6);
 // Aft pressure bulkhead has a real central opening at the original hatch.
 const aft=roundedProfile(12.3,roof+.1,.42);aft.holes.push(roundedProfile(2.14,3.0,.25));
 const rear=new T.Mesh(new T.ExtrudeGeometry(aft,{depth:.12,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:1,curveSegments:5}),m.shell);rear.position.set(0,roof/2,6.85);structure.add(rear);
 // Local hardware styles explain era: Apollo exposed mechanical circuit breakers,
 // Shuttle broad switch matrices, stations soft bags and removable experiment bays.
 if(kind==="shuttle"){
  const overhead=formedPanel(structure,5.7,1.24,.12,.17,m.shell,0,3.17,-5.55);overhead.rotation.x=.28;
  for(let row=0;row<3;row++)for(let col=0;col<13;col++){
   const toggle=formedPanel(overhead,.028,.10,.065,.008,col%6===0?m.warning:m.trim,-2.5+col*.417,-.4+row*.32,.1);toggle.rotation.x=-.2;
  }
 }else if(kind==="apollo"||kind==="early-capsule"){
  for(const side of[-1,1]){
   const bank=formedPanel(structure,.8,1.72,.12,.09,m.shell,side*4.9,2,-5.8);bank.rotation.y=-side*.2;
   for(let i=0;i<18;i++)formedPanel(bank,.045,.075,.08,.015,i%5===0?m.warning:m.trim,-.24+i%3*.24,-.66+Math.floor(i/3)*.25,.12);
  }
 }
 finishFabrication(structure);
 root.userData.bridgeRole=crew?"CREW VEHICLE":"GROUND MISSION CONTROL";
 root.userData.storyArchitecture=kind;
}

import * as T from "three";
import { attachRealismModel } from "../../presentation/realismAssets";
import {makePlanet,disposePlanet} from "../celestial";
import { fieldSites, type Session } from "./engine";
import { type Destination } from "./environments";
import { commanderPresentation } from "../../presentation/missionPresentation";
import { createOrbitalWorksite } from "../../presentation/orbitalWorksite";
import { acceptDownloadedScene, disposeObjectResources } from "../../presentation/resources";
import { installSurfaceScenery, terrainRelief, type SurfaceQuality } from "./surfaceScenery";
/** Mission-specific 3D environments have offline fallbacks; local NASA reference models load lazily. */
export function createFieldWorld(scene: T.Scene, destination: Destination, missionId?: string, quality:SurfaceQuality="balanced", onSceneChange?:()=>void) {
  const presentation = commanderPresentation(missionId, destination);
  const group = new T.Group();
  group.name = "Commander mission environment";
  group.userData.presentation = presentation;
  scene.add(group);
  let disposed=false;
  const sceneChanged=()=>{if(!disposed)onSceneChange?.();};
  const geometries: T.BufferGeometry[] = [],
    materials: T.Material[] = [],
    textures: T.Texture[] = [];
  const cube = new T.BoxGeometry(1, 1, 1),
    cylinder = new T.CylinderGeometry(1, 1, 1, 10);
  geometries.push(cube, cylinder);
  const material = (color: string, metalness = 0.2, roughness = 0.7) => {
    const m = new T.MeshStandardMaterial({ color, metalness, roughness });
    materials.push(m);
    return m;
  };
  const alloy = material("#74848a", 0.65, 0.4),
    white = material("#a5aca8", 0.2, 0.7),
    dark = material("#23333d"),
    solar = material("#1d354a", 0.4, 0.38),
    gold = material("#a18f69", 0.3, 0.7);
  function box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    m: T.Material = alloy,
    parent: T.Object3D = group,
  ) {
    const a = new T.Mesh(cube, m);
    a.position.set(x, y, z);
    a.scale.set(w, h, d);
    parent.add(a);
    return a;
  }
  function rod(
    x: number,
    y: number,
    z: number,
    r: number,
    h: number,
    m: T.Material = alloy,
  ) {
    const a = new T.Mesh(cylinder, m);
    a.position.set(x, y, z);
    a.scale.set(r, h, r);
    group.add(a);
    return a;
  }
  // A physical two-hatch airlock is attached to the existing aft opening.
  box(0, -0.08, 9, 0.1 + 1.55, 0.16, 3.3, dark);
  box(-0.84, 1.3, 9, 0.12, 2.6, 3.3, white);
  box(0.84, 1.3, 9, 0.12, 2.6, 3.3, white);
  box(0, 2.6, 9, 1.8, 0.12, 3.3, white);
  for (const z of [7.75, 10.25]) {
    box(-0.78, 1.25, z, 0.12, 2.5, 0.17, alloy);
    box(0.78, 1.25, z, 0.12, 2.5, 0.17, alloy);
  }
  const inner = box(0, 1.25, 7.75, 1.42, 2.46, 0.1, white),
    outer = box(0, 1.25, 10.25, 1.42, 2.46, 0.1, white);
  inner.name="inner pressure hatch";outer.name="outer pressure hatch";
  // All hardware moves with its leaf. Normalized dimensions compensate for
  // the existing scaled hatch meshes, retaining their exact closure planes.
  for(const leaf of [inner,outer])for(const face of [-1,1]){
    for(const x of [-.43,.43])box(x,0,face*.66,.025,.91,.14,dark,leaf);
    for(const y of [-.45,.45])box(0,y,face*.66,.88,.014,.14,dark,leaf);
    box(-.22,0,face*.85,.035,.19,.2,alloy,leaf);
    for(const y of [-.1,.1])box(-.18,y,face*.85,.08,.018,.2,alloy,leaf);
    box(.11,.33,face*.7,.24,.035,.13,gold,leaf);
  }
  // Each pressure hatch has the same physical button inside and outside,
  // letting the player reach it after exiting the spacecraft.
  const buttons:{mesh:T.Mesh;side:"inner"|"outer"}[]=[];
  for(const [id,z] of [["inner",7.75],["outer",10.25]] as const)
   for(const face of [-1,1]){
    box(.67,1.36,z+face*.19,.26,.35,.06,dark);
    const m=material("#d2a45e",.15,.45);
    const control=box(.67,1.36,z+face*.24,.14,.19,.07,m);
    buttons.push({mesh:control,side:id});
   }
  box(0.72, 1.4, 8.8, 0.04, 0.37, 0.35, dark);
  box(0.68, 1.4, 8.8, 0.015, 0.2, 0.25, solar);
  // Exterior pressure shell and landing feet do not change the existing cabin geometry.
  box(-3.35, 1.4, 0.2, 0.2, 2.9, 15.5, white);
  box(3.35, 1.4, 0.2, 0.2, 2.9, 15.5, white);
  box(0, 3.02, 0.2, 6.9, 0.15, 15.5, white);
  for (const x of [-2.9, 2.9])
    for (const z of [-5.5, 5.5]) {
      rod(x, -0.02, z, 0.18, 0.25, alloy);
      box(x, -0.04, z, 0.75, 0.08, 0.85, dark);
    }
  for (let z = -6; z < 7; z += 2)
    for (const x of [-3.48, 3.48]) box(x, 1.4, z, 0.06, 2.5, 0.08, alloy);
  // Chamfered pressure-shell shoulders, restrained foil seams and external
  // radiator fins replace the box silhouette without entering the cabin.
  for(const side of [-1,1]){
    const shoulder=box(side*3.2,2.89,.2,.72,.09,15.5,alloy);
    shoulder.rotation.z=side*-.51;
    for(let z=-5.8;z<6.6;z+=1.2){
      box(side*3.51,1.65,z,.04,1.8,.95,white);
      if(quality!=="battery")for(let k=0;k<5;k++)box(side*3.54,.93+k*.34,z,.025,.022,.87,dark);
    }
  }
  // Reinforced external pressure-shell ribs, hatch-flange screws, radiator pipes.
  // Shallow surface details are outside the walkable hull, not solid walls.
  const gasket=material("#18242c",.22,.84),
    rivet=material("#d0d8d5",.78,.27),
    suitLight=material("#65c1c4",.2,.42);
  for(let z=-6.2;z<7;z+=1.65){
    for(const x of [-3.49,3.49]){
      box(x,2.61,z,.11,.16,1.48,gasket);
      box(x,.26,z,.11,.12,1.48,alloy);
      for(const y of [.53,1.15,1.77,2.39]){
        box(x+(x>0?.08:-.08),y,z,.035,.075,.075,rivet);
      }
    }
    box(0,3.13,z,6.35,.07,.11,alloy);
  }
  let surfaceScenery:ReturnType<typeof installSurfaceScenery>|null=null;
  const orbitEarth=destination==="earth"?makePlanet("earth",17,true,sceneChanged,quality):null;
  if(orbitEarth){orbitEarth.position.set(-20,-12,43);group.add(orbitEarth);}
  if (destination === "earth") {
    // Procedural high-contrast celestial dome: offline, iPad-friendly, and
    // visible in EVERY direction during orbital EVA (not just from cockpit).
    const skyCanvas=document.createElement("canvas");
    skyCanvas.width=1024;skyCanvas.height=512;
    const ctx=skyCanvas.getContext("2d");
    if(ctx){
      const base=ctx.createLinearGradient(0,0,0,512);
      base.addColorStop(0,"#050912");base.addColorStop(.52,"#03070f");
      base.addColorStop(1,"#090d19");
      ctx.fillStyle=base;ctx.fillRect(0,0,1024,512);
      const haze=ctx.createRadialGradient(730,235,10,730,235,380);
      haze.addColorStop(0,"rgba(64,91,137,.25)");
      haze.addColorStop(.45,"rgba(35,55,94,.11)");
      haze.addColorStop(1,"rgba(12,23,49,0)");
      ctx.fillStyle=haze;ctx.fillRect(0,0,1024,512);
      for(let i=0;i<1450;i++){
        const hash=(n:number)=>{const q=Math.sin(n*127.1+78.23)*43758.5453;return q-Math.floor(q);};
        const x=hash(i*3+1)*1024,y=hash(i*3+2)*512;
        const size=i%37===0?1.6:i%11===0?.93:.55;
        const alpha=.4+hash(i*3+3)*.55;
        ctx.fillStyle=i%13===0?`rgba(186,211,255,${alpha})`:`rgba(242,247,255,${alpha})`;
        ctx.beginPath();ctx.arc(x,y,size,0,Math.PI*2);ctx.fill();
      }
    }
    const skyTexture=new T.CanvasTexture(skyCanvas);
    skyTexture.colorSpace=T.SRGBColorSpace;
    textures.push(skyTexture);
    const skyMaterial=new T.MeshBasicMaterial({
      map:skyTexture,side:T.BackSide,depthWrite:false,fog:false,
    });
    materials.push(skyMaterial);
    const skyGeometry=new T.SphereGeometry(56,36,24);
    geometries.push(skyGeometry);
    const stars=new T.Mesh(skyGeometry,skyMaterial);
    stars.position.set(0,3,9);
    stars.renderOrder=-3;
    group.add(stars);
    // Orbital sunlight and Earth fill reveal surface relief without bloom.
    const exteriorSun=new T.DirectionalLight("#f4f8ff",1.25);
    exteriorSun.position.set(-7,12,17);
    group.add(exteriorSun);
    // Zero-ground orbital EVA scene: worksite and tether points on the hull,
    // not an impossible runway floating in Earth's orbit.
    for(const x of [-2.7,2.7]){
      box(x,1.65,13,.1,.1,5.8,alloy);
      for(let z=11.5;z<17;z+=1.3)
       box(x,1.65,z,.22,.21,.28,gold);
    }
    for(let z=11.8;z<=17.1;z+=1.35)
      box(0,2.82,z,5.5,.07,.07,alloy);
    box(0,1.3,18,2.1,1.8,.58,white);
    for(let x=-.8;x<=.8;x+=.4)box(x,1.9,17.65,.18,.22,.08,solar);
    // Raised tether reels, handrails and magnetic foot restraints; all remain
    // within the original EVA walkable footprint.
    for(const x of [-2.78,2.78]){
      for(let z=11.2;z<=17.1;z+=.85){
        box(x,1.4,z,.1,.07,.21,gasket);
        box(x,1.48,z,.11,.025,.13,suitLight);
      }
      box(x,2.17,14.1,.045,.045,5.8,rivet);
    }
    for(let z=11.8;z<17.3;z+=1.1){
      for(const x of [-1.4,0,1.4]){
        box(x,-.025,z,.18,.035,.24,gasket);
        box(x,.002,z,.09,.012,.15,alloy);
      }
    }
    // Access target: illuminated hatch and fasteners on the near satellite face.
    box(1.8,1.15,13.75,.8,.08,.26,dark);
    for(const x of [1.54,1.8,2.06])
      box(x,1.22,13.75,.075,.025,.095,suitLight);
    box(1.8,.83,13.78,.4,.04,.12,gold);
  } else if (presentation.playerContext === "surface") {
    // Layered geological scenery is visual only: preserve physical interaction
    // markers, landing site positions and collision/pathfinding exactly.
    surfaceScenery=installSurfaceScenery(group,destination,Object.values(fieldSites),quality,sceneChanged);
    for (const p of Object.values(fieldSites)) {
      rod(p.x, 0.23, p.z, 0.025, 0.5, gold);
      box(p.x, 0.48, p.z, 0.27, 0.12, 0.03, gold);
    }
  }
  const worksite = presentation.worksite === "none" ? null : createOrbitalWorksite(presentation.worksite, quality);
  const satellite = worksite?.group ?? new T.Group();
  satellite.position.set(2.4, 0, 15);
  group.add(satellite);
  // The same service target is used by all three existing orbital EVA missions.
  // Procedural spacecraft remain available without any network download.
   // Optional locally packaged NASA Hubble reference; asset-specific DigitalSpace
   // terms are tracked in the asset manifest. It is never required for play.
   let referenceModel:T.Group|null=null;
   let referenceLoad:{dispose():void}|null=null;
   if(typeof window!=="undefined" && destination==="earth" && presentation.worksite==="telescope"){
     void import("../../presentation/referenceModelLoader").then(({loadReferenceModel})=>{
       if(disposed)return;
       referenceLoad=loadReferenceModel(model=>{
         if(!acceptDownloadedScene(group,model))return;
         const bounds=new T.Box3().setFromObject(model);
         const size=bounds.getSize(new T.Vector3()),centre=bounds.getCenter(new T.Vector3());
         const diagonal=Math.max(size.x,size.y,size.z);
         if(!Number.isFinite(diagonal)||diagonal<=0){disposeObjectResources(model);return;}
         const scale=3.1/diagonal;
         model.position.copy(centre).multiplyScalar(-scale);
         model.scale.setScalar(scale);
         const pivot=new T.Group();pivot.position.y=1.35;
         pivot.add(model);satellite.add(pivot);
         referenceModel=pivot;
         // Keep the original reachable service panel and its live indicator.
         // The reference model is mounted behind the procedural service face.
         pivot.position.z=1.4;
         for(const object of satellite.children)if(object!==pivot&&!object.userData.serviceFace)object.visible=false;
         sceneChanged();
       });
     }).catch(()=>{/* No network dependency for mission progress. */});
   }
  // A recognisable lunar-module reference gives the training field a proper
  // aerospace scale. It is scenery beside the course, never a replacement for
  // the expedition cabin or its functional airlock and camp equipment.
  const landerReference = typeof window!=="undefined" && presentation.playerContext==="surface"
    ? attachRealismModel(group,"lander",{extent:7.5,position:[-10,terrainRelief(-10,20),20],rotation:[0,.55,0],shadows:false,onLoad:sceneChanged})
    : null;
  const camp = new T.Group();
  camp.name="Unpressurized instrument camp";
  camp.visible=presentation.playerContext==="surface";
  camp.position.set(fieldSites.camp.x, 0, fieldSites.camp.z);
  group.add(camp);
  const parts: Record<string, T.Object3D> = {};
  // The saved camp workpoint is the astronaut's working space, not the centre
  // of a solid housing. Keep its ship-facing approach clear and arrange the
  // graphical equipment around it without moving any gameplay site/collider.
  type Fitting = [number, number, number, number, number, number];
  function fittings(parent:T.Object3D,name:string,items:Fitting[],finish:T.Material) {
    const mesh=new T.InstancedMesh(cube,finish,items.length),pose=new T.Object3D();
    for(const [i,[x,y,z,w,h,d]] of items.entries()){
      pose.position.set(x,y,z);pose.scale.set(w,h,d);pose.updateMatrix();
      mesh.setMatrixAt(i,pose.matrix);
    }
    mesh.instanceMatrix.needsUpdate=true;mesh.name=name;parent.add(mesh);return mesh;
  }
  // Equipment groups stay unrotated; the array has a separate tilted face.
  // Extend their feet to this site's actual dust height.
  function groundSupports(parent:T.Object3D,name:string,feet:[number,number][],top:number,pad=.32) {
    const items:Fitting[]=[];
    for(const [x,z] of feet){
      const ground=terrainRelief(fieldSites.camp.x+parent.position.x+x,fieldSites.camp.z+parent.position.z+z)-parent.position.y;
      items.push([x,(ground+top)/2,z,.065,top-ground,.065]);
      items.push([x,ground+.025,z,pad,.05,pad]);
    }
    return fittings(parent,name,items,alloy);
  }
  function chamferedCase(parent:T.Object3D,name:string,w:number,h:number,d:number,cut:number,y:number,finish:T.Material) {
    const shape=new T.Shape(),x=w/2,z=d/2;
    shape.moveTo(-x+cut,-z);shape.lineTo(x-cut,-z);shape.lineTo(x,-z+cut);
    shape.lineTo(x,z-cut);shape.lineTo(x-cut,z);shape.lineTo(-x+cut,z);
    shape.lineTo(-x,z-cut);shape.lineTo(-x,-z+cut);shape.closePath();
    const geometry=new T.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false,steps:1});
    geometry.rotateX(-Math.PI/2);geometry.translate(0,-h/2,0);geometries.push(geometry);
    const mesh=new T.Mesh(geometry,finish);mesh.position.y=y;mesh.name=name;parent.add(mesh);return mesh;
  }
  const blanket=material("#b8b5a7",.32,.84),radiator=material("#bcc7c6",.3,.7);
  const blanketCanvas=document.createElement("canvas");blanketCanvas.width=128;blanketCanvas.height=128;
  const blanketContext=blanketCanvas.getContext("2d");
  if(blanketContext){
    const pixels=blanketContext.createImageData(128,128);
    for(let y=0;y<128;y++)for(let x=0;x<128;x++){
      const stitch=x%32<2||y%32<2;
      const fold=Math.sin((x%32)/32*Math.PI)*Math.sin((y%32)/32*Math.PI);
      const grain=Math.sin(x*17.13+y*61.7)*2;
      const v=Math.round((stitch?124:178+fold*24)+grain),i=(y*128+x)*4;
      pixels.data[i]=v;pixels.data[i+1]=v;pixels.data[i+2]=v-5;pixels.data[i+3]=255;
    }
    blanketContext.putImageData(pixels,0,0);
    const texture=new T.CanvasTexture(blanketCanvas);texture.colorSpace=T.SRGBColorSpace;
    texture.wrapS=T.RepeatWrapping;texture.wrapT=T.RepeatWrapping;textures.push(texture);
    blanket.map=texture;
    if(quality!=="battery"){blanket.bumpMap=texture;blanket.bumpScale=.009;}
  }
  const shelter = new T.Group();
  shelter.position.z=2.8;
  camp.add(shelter);
  chamferedCase(shelter,"Camp shelter body",2.2,1.4,1.6,.14,1.16,blanket);
  chamferedCase(shelter,"Camp shelter roof",2.5,.14,2,.2,1.93,gold);
  const structure:Fitting[]=[];
  // Adjustable legs/pads really meet the generated terrain. The lower body
  // stands clear of dust; posts and thermal straps sit outside its cut corners.
  for(const x of [-.92,.92])for(const z of [-.61,.61]){
    const ground=terrainRelief(fieldSites.camp.x+x,fieldSites.camp.z+shelter.position.z+z);
    structure.push([x,(ground+.48)/2,z,.075,.48-ground,.075]);
    structure.push([x,ground+.025,z,.38,.05,.38]);
  }
  for(const x of [-1.07,1.07])for(const z of [-.76,.76])structure.push([x,1.16,z,.065,1.5,.065]);
  for(const y of [.49,1.84]){
    for(const z of [-.815,.815])structure.push([0,y,z,2.08,.045,.035]);
    for(const x of [-1.115,1.115])structure.push([x,y,0,.035,.045,1.48]);
  }
  fittings(shelter,"Camp exposed shelter frame",structure,alloy);
  // Seat each rib into the roof's actual 2.00m top, leaving visible relief.
  fittings(shelter,"Camp exposed roof ribs",[-.85,-.425,0,.425,.85].map(x=>[x,2.016,0,.04,.045,1.66]),alloy);
  const panel=box(0,1.1,-.847,.98,.76,.055,dark,shelter);panel.name="Camp arrival service panel";
  const serviceFace=box(0,1.1,-.886,.76,.54,.018,solar,shelter);serviceFace.name="Camp exposed service face";
  fittings(shelter,"Camp service latches",[-.43,.43].flatMap(x=>[.9,1.3].map(y=>[x,y,-.891,.045,.1,.035] as Fitting)),rivet);
  for(const side of [-1,1]){
    const fins:Fitting[]=[[side*1.111,1.14,0,.03,1.05,1.08]];
    for(let i=0;i<7;i++)fins.push([side*1.139,.69+i*.15,0,.028,.055,1.08]);
    fittings(shelter,`Camp side radiator ${side}`,fins,radiator);
  }
  parts.shelter = shelter;
  const panels = new T.Group();
  panels.position.set(2.2, 0.5, 0);
  camp.add(panels);
  const panelArray=new T.Group();panelArray.rotation.z=-.3;panels.add(panelArray);
  box(0, 0, 0, 1.7, 0.08, 1.2, solar, panelArray);
  groundSupports(panels,"Camp solar ground supports",[[0,0]],0,.42);
  box(0,-.32,0,.13,.12,.13,rivet,panels).name="Camp solar cable socket";
  const pv=material("#1c4a68",.46,.33),gridline=material("#b7bdbe",.5,.39);
  const cells:Fitting[]=[],grids:Fitting[]=[];
  for(let i=0;i<8;i++)for(let j=0;j<5;j++)cells.push([-.74+i*.21,.052,-.48+j*.24,.183,.01,.211]);
  for(let i=0;i<=8;i++)grids.push([-.84+i*.21,.065,0,.011,.018,1.18]);
  for(let j=0;j<=5;j++)grids.push([0,.065,-.6+j*.24,1.68,.018,.012]);
  fittings(panelArray,"Camp photovoltaic cells",cells,pv);fittings(panelArray,"Camp photovoltaic grid",grids,gridline);
  parts.solar = panels;
  const battery=new T.Group();battery.position.x=-1.6;camp.add(battery);
  const batteryBody=box(0,.4,0,.6,.6,.6,dark,battery);batteryBody.name="Camp battery body";
  fittings(battery,"Camp battery exposed battens",[.2,.4,.6].map(y=>[0,y,-.308,.56,.025,.025]),alloy);
  fittings(battery,"Camp battery handles",[-.22,.22].map(x=>[x,.75,0,.045,.12,.22]),rivet);
  groundSupports(battery,"Camp battery ground supports",[-.22,.22].flatMap(x=>[-.22,.22].map(z=>[x,z] as [number,number])),.14,.16);
  box(0,.31,.33,.13,.12,.09,rivet,battery).name="Camp battery cable socket";
  parts.battery=battery;
  const antenna = new T.Group();
  camp.add(antenna);
  groundSupports(antenna,"Camp antenna ground supports",[[-1.7,-1]],2.2,.3);
  const campDishGeo=new T.SphereGeometry(.35,20,10,0,Math.PI*2,0,Math.PI*.46);
  geometries.push(campDishGeo);
  const campDish=new T.Mesh(campDishGeo,white);
  campDish.position.set(-1.7,2.1,-1);campDish.rotation.x=-.52;antenna.add(campDish);
  groundSupports(antenna,"Camp antenna stabilizer feet",[[-1.98,-1],[-1.42,-1]],.415,.19);
  box(-1.7,.39,-1,.62,.05,.055,alloy,antenna);
  box(-1.7,.24,-1,.13,.12,.13,rivet,antenna).name="Camp antenna cable socket";
  parts.antenna = antenna;
  const storage=new T.Group();storage.position.set(-1.7,0,1.45);camp.add(storage);
  box(0,.3,0,.8,.6,.45,gold,storage);box(0,.62,0,.83,.06,.48,alloy,storage);
  fittings(storage,"Camp sample case latches",[-.27,.27].map(x=>[x,.48,-.25,.06,.14,.045]),rivet);
  groundSupports(storage,"Camp storage ground supports",[-.29,.29].flatMap(x=>[-.13,.13].map(z=>[x,z] as [number,number])),.04,.15);
  parts.storage=storage;
  const sensor=new T.Group();sensor.position.set(1.8,0,1.7);camp.add(sensor);
  groundSupports(sensor,"Camp sensor ground supports",[[0,0]],1.4,.38);
  box(0,1.41,0,.36,.1,.3,white,sensor);
  box(0,.24,0,.13,.12,.13,rivet,sensor).name="Camp sensor cable socket";
  parts.sensor=sensor;
  for(const [id,object] of Object.entries(parts))object.name=`Camp ${id}`;
  const consoleGroup=new T.Group();consoleGroup.name="Camp service console";consoleGroup.position.z=1.1;camp.add(consoleGroup);
  groundSupports(consoleGroup,"Camp console ground supports",[[-.32,0],[.32,0]],.9,.3);
  box(0,.95,0,.88,.14,.44,dark,consoleGroup);
  const consoleGeometry=new T.PlaneGeometry(.74,.31);geometries.push(consoleGeometry);
  const consoleDisplay=new T.Mesh(consoleGeometry,solar);consoleDisplay.position.set(0,1.025,0);consoleDisplay.rotation.x=-Math.PI/2;consoleGroup.add(consoleDisplay);
  const result=box(0,1.035,0,.48,.018,.16,suitLight,consoleGroup);result.name="Camp retained science indicator";
  const connectorMaterial=material("#c79b54",.25,.6);
  const connector=box(-1.28,.31,1.45,.24,.21,.17,connectorMaterial,camp);
  connector.name="Camp power connector";
  const connectorStand=new T.Group();connectorStand.position.set(-1.28,0,1.45);camp.add(connectorStand);
  groundSupports(connectorStand,"Camp connector ground supports",[[0,0]],.22,.24);
  const harnesses: {id:"solar"|"battery"|"sensor"|"antenna";mesh:T.Mesh}[]=[];
  for(const [id,end] of [
    ["solar",[2.2,.18,0]], ["battery",[-1.6,.31,.33]],
    ["sensor",[1.8,.24,1.7]], ["antenna",[-1.7,.24,-1]],
  ] as const){
    // Cable run stays behind the working space or on its left/right edges.
    // Follow the dust between the raised sockets rather than floating at y=0.
    const start=connector.position.clone(),finish=new T.Vector3(...end);
    const route=new T.CatmullRomCurve3([start,new T.Vector3(end[0],0,1.85),finish]);
    const curve=new class extends T.Curve<T.Vector3>{
      constructor(){super();}
      getPoint(t:number,target=new T.Vector3()){
        route.getPoint(t,target);
        const ground=terrainRelief(fieldSites.camp.x+target.x,fieldSites.camp.z+target.z)+.025;
        target.y=ground+Math.max(0,1-t*6)*(start.y-ground)+Math.max(0,1-(1-t)*6)*(finish.y-ground);
        return target;
      }
    }();
    const geometry=new T.TubeGeometry(curve,quality==="battery"?6:12,.021,5,false);
    geometries.push(geometry);
    const cable=new T.Mesh(geometry,gasket);cable.name=`Camp ${id} cable`;camp.add(cable);harnesses.push({id,mesh:cable});
  }
  // The shelter is equipment protection, never a pressurized crew habitat.
  const placardCanvas=document.createElement("canvas");placardCanvas.width=256;placardCanvas.height=80;
  const placardContext=placardCanvas.getContext("2d");
  if(placardContext){
    placardContext.fillStyle="#292b28";placardContext.fillRect(0,0,256,80);
    placardContext.fillStyle="#f0e5bd";placardContext.font="bold 27px sans-serif";
    placardContext.fillText("UNPRESSURIZED",10,33);placardContext.font="bold 18px sans-serif";placardContext.fillText("INSTRUMENT SHELTER",10,61);
    const texture=new T.CanvasTexture(placardCanvas);textures.push(texture);
    const placardMaterial=new T.MeshBasicMaterial({map:texture});materials.push(placardMaterial);
    const geometry=new T.PlaneGeometry(1.45,.32);geometries.push(geometry);
    const placard=new T.Mesh(geometry,placardMaterial);placard.name="Camp arrival safety placard";placard.position.set(0,1.65,-.804);placard.rotation.y=Math.PI;shelter.add(placard);
  }
  return {
    update(s: Session) {
      for(const btn of buttons){
       const isOpen=btn.side==="inner"?s.airlock.inner:s.airlock.outer;
       if(btn.mesh.material instanceof T.MeshStandardMaterial)
        btn.mesh.material.color.set(isOpen?"#73e4bf":"#d3ae6c");
      }
      satellite.visible = commanderPresentation(s.missionId,destination).worksite !== "none";
      worksite?.update(s.systems);
      camp.visible = presentation.playerContext === "surface";
      inner.position.x +=
        ((s.airlock.inner ? -1.5 : 0) - inner.position.x) * 0.12;
      outer.position.x +=
        ((s.airlock.outer ? -1.5 : 0) - outer.position.x) * 0.12;
      for (const [id, obj] of Object.entries(parts))
        obj.visible = !!s.camp[id as keyof typeof s.camp];
      connector.visible=s.camp.shelter&&(s.camp.solar||s.camp.battery);
      connectorStand.visible=connector.visible;
      connectorMaterial.color.set(s.camp.broken?"#c56740":s.camp.power>0?"#79a88a":"#c79b54");
      for(const harness of harnesses)harness.mesh.visible=s.camp.shelter&&s.camp[harness.id];
      consoleGroup.visible=s.camp.shelter||s.camp.science>0;
      result.visible = s.camp.science > 0;
    },
    dispose() {
      if(disposed)return;
      disposed=true;
      group.userData.disposed=true;
      referenceLoad?.dispose();
      landerReference?.dispose();
      if(referenceModel){
        referenceModel.removeFromParent();
        disposeObjectResources(referenceModel);
      }
      worksite?.dispose();
      camp.traverse(object=>{if(object instanceof T.InstancedMesh)object.dispose();});
      scene.remove(group);
      surfaceScenery?.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      if(orbitEarth)disposePlanet(orbitEarth);
    },
  };
}

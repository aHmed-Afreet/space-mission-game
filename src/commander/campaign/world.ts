import * as T from "three";
import {makePlanet,disposePlanet} from "../celestial";
import { fieldSites, type Session } from "./engine";
import { type Destination } from "./environments";
import { commanderPresentation } from "../../presentation/missionPresentation";
import { createOrbitalWorksite } from "../../presentation/orbitalWorksite";
import { acceptDownloadedScene, disposeObjectResources } from "../../presentation/resources";
import { assetManifest } from "../../presentation/assetManifest";
import { installSurfaceScenery, type SurfaceQuality } from "./surfaceScenery";
/** Mission-specific 3D environments have offline fallbacks; NASA reference models are optional lazy downloads. */
export function createFieldWorld(scene: T.Scene, destination: Destination, missionId?: string, quality:SurfaceQuality="balanced") {
  const presentation = commanderPresentation(missionId, destination);
  const group = new T.Group();
  group.name = "Commander mission environment";
  group.userData.presentation = presentation;
  scene.add(group);
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
  const orbitEarth=destination==="earth"?makePlanet("earth",17):null;
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
    surfaceScenery=installSurfaceScenery(group,destination,Object.values(fieldSites),quality);
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
   // Optional existing NASA-hosted Hubble reference; asset-specific DigitalSpace
   // terms are tracked in the asset manifest. It is never required for play.
   let disposed=false;
   let referenceModel:T.Group|null=null;
   if(typeof window!=="undefined" && destination==="earth" && presentation.worksite==="telescope"){
     const nasaUrl=assetManifest.hubble.runtimeUrl;
     void import("three/examples/jsm/loaders/GLTFLoader.js").then(({GLTFLoader})=>{
       if(disposed)return;
       new GLTFLoader().load(nasaUrl,gltf=>{
         const model=gltf.scene;
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
       },undefined,()=>{/* Offline: original low-cost model remains visible. */});
     }).catch(()=>{/* No network dependency for mission progress. */});
   }
  const camp = new T.Group();
  camp.name="Unpressurized instrument camp";
  camp.visible=presentation.playerContext==="surface";
  camp.position.set(fieldSites.camp.x, 0, fieldSites.camp.z);
  group.add(camp);
  const parts: Record<string, T.Object3D> = {};
  const shelter = new T.Group();
  camp.add(shelter);
  box(0, 0.72, 0, 2.2, 1.4, 1.6, white, shelter);
  box(0, 1.49, 0, 2.4, 0.14, 1.8, gold, shelter);
  box(0, 0.75, 1.05, 1.7, 0.1, 0.6, alloy, shelter);
  // Mechanical feet, thermal blanket ribs and an access hatch.
  for(const x of [-.92,.92])for(const z of [-.61,.61]){
    box(x,.16,z,.15,.34,.19,dark,shelter);
    box(x,.032,z,.38,.055,.42,gold,shelter);
  }
  for(let x=-.8;x<=.8;x+=.4)
    box(x,1.49,0,.045,.036,1.69,alloy,shelter);
  box(0,.91,.821,.9,.74,.06,dark,shelter);
  box(0,.91,.854,.71,.52,.018,gold,shelter);
  parts.shelter = shelter;
  const panels = new T.Group();
  panels.position.set(2.2, 0.5, 0);
  camp.add(panels);
  box(0, 0, 0, 1.7, 0.08, 1.2, solar, panels);
  box(0, -0.3, 0, 0.06, 0.6, 0.06, alloy, panels);
  const pv=material("#1c4a68",.46,.33),gridline=material("#b7bdbe",.5,.39);
  for(let i=0;i<8;i++)for(let j=0;j<5;j++)
    box(-.74+i*.21,.052,-.48+j*.24,.183,.01,.211,pv,panels);
  for(let i=0;i<=8;i++)box(-.84+i*.21,.065,0,.011,.018,1.18,gridline,panels);
  for(let j=0;j<=5;j++)box(0,.065,-.6+j*.24,1.68,.018,.012,gridline,panels);
  panels.rotation.z = -0.3;
  parts.solar = panels;
  parts.battery = box(-1.6, 0.3, 0, 0.6, 0.6, 0.6, dark, camp);
  const antenna = new T.Group();
  camp.add(antenna);
  box(-1.7, 1.1, -1, 0.045, 2.2, 0.045, alloy, antenna);
  const campDishGeo=new T.SphereGeometry(.35,20,10,0,Math.PI*2,0,Math.PI*.46);
  geometries.push(campDishGeo);
  const campDish=new T.Mesh(campDishGeo,white);
  campDish.position.set(-1.7,2.1,-1);campDish.rotation.x=-.52;antenna.add(campDish);
  for(const x of [-1.98,-1.42])
    box(x,.22,-1,.09,.39,.11,gold,antenna);
  parts.antenna = antenna;
  parts.storage = box(0, 0.3, 1.6, 0.8, 0.6, 0.45, gold, camp);
  parts.sensor = box(1, 0.7, 1.6, 0.1, 1.4, 0.1, alloy, camp);
  for(const [id,object] of Object.entries(parts))object.name=`Camp ${id}`;
  const result = box(0, 0.9, 1.07, 0.45, 0.07, 0.3, solar, camp);
  const connectorMaterial=material("#c79b54",.25,.6);
  const connector=box(-1.12,.31,.48,.24,.21,.17,connectorMaterial,camp);
  connector.name="Camp power connector";
  const harnesses: {id:"solar"|"battery"|"sensor"|"antenna";mesh:T.Mesh}[]=[];
  for(const [id,end] of [
    ["solar",[2.2,.08,0]], ["battery",[-1.6,.08,0]],
    ["sensor",[1,.08,1.6]], ["antenna",[-1.7,.08,-1]],
  ] as const){
    const curve=new T.CatmullRomCurve3([new T.Vector3(-1.12,.13,.48),new T.Vector3(end[0]*.45,.045,end[2]*.5+.28),new T.Vector3(...end)]);
    const geometry=new T.TubeGeometry(curve,quality==="battery"?6:12,.021,5,false);
    geometries.push(geometry);
    const cable=new T.Mesh(geometry,gasket);cable.name=`Camp ${id} cable`;camp.add(cable);harnesses.push({id,mesh:cable});
  }
  for(let k=0;k<3;k++)box(0,.08,-.36+k*.33,.81,.041,.041,alloy,parts.battery);
  box(0,.46,0,3.6,.05,3,white,parts.sensor);
  // The shelter is equipment protection, never a pressurized crew habitat.
  const placardCanvas=document.createElement("canvas");placardCanvas.width=256;placardCanvas.height=64;
  const placardContext=placardCanvas.getContext("2d");
  if(placardContext){
    placardContext.fillStyle="#292b28";placardContext.fillRect(0,0,256,64);
    placardContext.fillStyle="#e5d7a8";placardContext.font="bold 17px sans-serif";
    placardContext.fillText("INSTRUMENT SHELTER",10,25);placardContext.fillText("UNPRESSURIZED",10,50);
    const texture=new T.CanvasTexture(placardCanvas);textures.push(texture);
    const placardMaterial=new T.MeshBasicMaterial({map:texture});materials.push(placardMaterial);
    const geometry=new T.PlaneGeometry(.92,.23);geometries.push(geometry);
    const placard=new T.Mesh(geometry,placardMaterial);placard.position.set(0,1.3,.84);shelter.add(placard);
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
      connectorMaterial.color.set(s.camp.broken?"#c56740":s.camp.power>0?"#79a88a":"#c79b54");
      for(const harness of harnesses)harness.mesh.visible=s.camp.shelter&&s.camp[harness.id];
      result.visible = s.camp.science > 0;
    },
    dispose() {
      if(disposed)return;
      disposed=true;
      group.userData.disposed=true;
      if(referenceModel)disposeObjectResources(referenceModel);
      worksite?.dispose();
      scene.remove(group);
      surfaceScenery?.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      if(orbitEarth)disposePlanet(orbitEarth);
    },
  };
}

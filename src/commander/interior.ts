import type { ShipState } from "./campaign/ship";
import {makePlanet,planetKind,disposePlanet} from "./celestial";
import {createEvaGloves} from "../presentation/evaGloves";
import {attachInteriorAsset,applyInteriorPbr} from "../presentation/interiorAssets";
import {disposeObjectResources} from "../presentation/resources";
import {batchStaticVisuals} from "../presentation/staticBatch";
import {buildPressureShell} from "./pressureShellModel";
import {buildWorkstations} from "../../scripts/interior/workstations";
import * as T from "three";
import {createDisplays,type Telemetry} from "./displays";
import {deck,type Position} from "./layout";
import {sectionDoorLeafX,sectionDoorOpenFraction} from "./doorMotion";
import type {Action,Area} from "./simulation";
export type VisualAction={id:number;action:Action};
/** Manufactured, single-owner cabin presentation. Collision/targets stay in the
 * existing analytic mission systems; static geometry is authored to their units. */
export function createInterior(options:{eva?:boolean;destination?:string;graphics?:"quality"|"balanced"|"battery";onSceneChange?:()=>void}={}){
 const scene=new T.Scene();scene.background=new T.Color("#070c12");scene.fog=null;
 const geometries:T.BufferGeometry[]=[],materials:T.Material[]=[],textures:T.Texture[]=[];
 const box=new T.BoxGeometry(1,1,1),cylinder=new T.CylinderGeometry(1,1,1,14),sphere=new T.SphereGeometry(1,18,12),plane=new T.PlaneGeometry(1,1);
 geometries.push(box,cylinder,sphere,plane);
 const mat=(color:string,metal=.2,rough=.6,emissive?:string)=>{const m=new T.MeshStandardMaterial({color,metalness:metal,roughness:rough,emissive:emissive||"#000000",emissiveIntensity:emissive?.45:0});materials.push(m);return m;};
 const white=mat("#dddcd2",.12,.7),dark=mat("#19262e",.24,.66),silver=mat("#9fa8a9",.7,.4),warm=mat("#b9ad8b",.03,.92),panel=mat("#bac1bf",.25,.6);
 const dynamic=(x:number,y:number,z:number,w:number,h:number,d:number,m:T.Material,geo:T.BufferGeometry=box,parent:T.Object3D=scene)=>{const mesh=new T.Mesh(geo,m);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);parent.add(mesh);return mesh;};
 const label=(text:string,x:number,y:number,z:number,w=.8,h=.1,ry=0)=>{const c=document.createElement('canvas');c.width=768;c.height=96;const ctx=c.getContext('2d')!;ctx.fillStyle='#17232c';ctx.fillRect(0,0,768,96);ctx.fillStyle='#dce2df';ctx.font='500 35px monospace';ctx.textBaseline='middle';ctx.fillText(text,22,50,724);const tx=new T.CanvasTexture(c);tx.colorSpace=T.SRGBColorSpace;textures.push(tx);const m=new T.MeshBasicMaterial({map:tx});materials.push(m);const p=dynamic(x,y,z,w,h,1,m,plane);p.rotation.y=ry;};
 const references:ReturnType<typeof attachInteriorAsset>[]=[];
 const fallbackFinishes:{dispose():void}[]=[],fallbackModels:T.Group[]=[],fallbackBatches:(()=>void)[]=[];
 let disposed=false;
 // Original authored topology is a deliberate offline/failure presentation too.
 // Accepted local GLBs replace it, rather than layering duplicate architecture.
 for(const [key,build]of[["mission-shell",buildPressureShell],["mission-workstations",buildWorkstations]]as const){
  const fallback=build();fallbackBatches.push(batchStaticVisuals(fallback));fallbackModels.push(fallback);scene.add(fallback);const finish=applyInteriorPbr(fallback,options.graphics,options.onSceneChange);fallbackFinishes.push(finish);
  references.push(attachInteriorAsset(scene,key,{extent:1,preserveCoordinates:true,quality:options.graphics,onChange:options.onSceneChange,onLoad:()=>{finish.dispose();fallback.removeFromParent();disposeObjectResources(fallback);}}));
 }
 // Live MFDs remain real simulation data, inset into the authored housings.
 const displays=createDisplays();textures.push(...displays.panels.map(p=>p.texture));materials.push(...displays.panels.map(p=>p.material));
 const screen=(x:number,y:number,z:number,w:number,h:number,role:number,ry=0,rx=0)=>{const mesh=dynamic(x,y,z,w,h,1,displays.panels[role].material,plane);mesh.rotation.set(rx,ry,0);mesh.name='Live '+['flight','science','communications','engineering'][role]+' MFD';return mesh;};
 for(const [i,x]of[-.84,0,.84].entries())screen(x,1.32,-6.485,.7,.45,i===0?3:i===1?0:2,0,-.22).name='Live cockpit MFD '+i;
 screen(-1.765,1.68,-3.1,1,.55,1,Math.PI/2).name="Live science MFD";
 screen(1.765,1.68,-3.1,1,.55,2,-Math.PI/2).name="Live communications MFD";
 screen(-1.765,1.68,.45,.68,.5,3,Math.PI/2).name="Live engineering MFD";
 screen(1.765,1.68,.45,.48,.4,3,-Math.PI/2).name="Live galley MFD";
 screen(1.765,1.68,4.67,.65,.45,1,-Math.PI/2).name="Live repair MFD";
 for(const [z,name]of[[-4.35,'01 / FLIGHT DECK'],[-1.35,'02 / VEHICLE SYSTEMS'],[2.35,'03 / CREW & EVA']]as const)for(const face of[-1,1])label(name,0,2.84,z+face*.15,1.4,.13,face<0?Math.PI:0);
 label('UPLINK / RF ROUTING',3.075,2.65,-3.1,1.02,.11,-Math.PI/2);
 label('ECLSS / RECOVERY',-3.075,2.65,.45,1.02,.11,Math.PI/2);
 label('POTABLE WATER',3.075,2.65,.45,.92,.11,-Math.PI/2);
 label('SAMPLE / ANALYSIS',-3.075,2.65,-3.1,1.08,.11,Math.PI/2);
 label('AIRLOCK / EVA',0,2.78,7.62,.96,.13,Math.PI);
 // Real flight hatch leaves, keyed to exactly the same crossing interlock.
 const rounded=(w:number,h:number,r:number)=>{const s=new T.Shape();const x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;};
 const leafGeo=new T.ExtrudeGeometry(rounded(1.02,2.5,.12),{depth:.075,bevelEnabled:true,bevelSize:.018,bevelThickness:.012,bevelSegments:1,curveSegments:7});geometries.push(leafGeo);
 const hatchLeaves=[-1,1].map(side=>{const leaf=new T.Mesh(leafGeo,panel);leaf.name='Animated flight pressure leaf';leaf.position.set(side*.53,1.28,-4.39);scene.add(leaf);return leaf;});
 const doorKeyMat=mat('#d8e1ce',.1,.6,'#6d927b');doorKeyMat.emissiveIntensity=.65;
 const flightDoorButtons:T.Mesh[]=[];
 for(const face of[-1,1])flightDoorButtons.push(dynamic(.54,1.4,-4.35+face*.15,.29,.37,.075,doorKeyMat));
 // Non-EVA flights still have a sealed, visibly restricted aft closure. EVA
 // missions delegate the same plane to the independently simulated airlock.
 if(!options.eva){
  const g=new T.ExtrudeGeometry(rounded(1.42,2.46,.25),{depth:.08,bevelEnabled:true,bevelSize:.018,bevelThickness:.012,bevelSegments:1,curveSegments:8});g.translate(0,0,-.04);geometries.push(g);
  const hatch=new T.Mesh(g,panel);hatch.name='Restricted EVA pressure hatch';hatch.position.set(0,1.25,7.75);scene.add(hatch);
  const wheelG=new T.TorusGeometry(.15,.024,7,28);geometries.push(wheelG);const wheel=new T.Mesh(wheelG,silver);wheel.position.set(.14,1.12,7.67);scene.add(wheel);
  dynamic(.82,1.35,7.46,.3,.4,.055,dark);dynamic(.82,1.36,7.42,.17,.2,.025,doorKeyMat);
  label('EVA LOCKED',0,2.49,7.65,.86,.12,Math.PI);
 }
 // Existing galley cupboard animation retained inside its new formed niche.
 const foodFrame=new T.Group();foodFrame.position.set(2.68,2.15,1.04);foodFrame.rotation.y=-Math.PI/2;scene.add(foodFrame);
 const cabinetPivot=new T.Group();foodFrame.add(cabinetPivot);
 const cabinetGeo=new T.ExtrudeGeometry(rounded(.66,.6,.09),{depth:.035,bevelEnabled:true,bevelSize:.01,bevelThickness:.01,bevelSegments:1,curveSegments:6});geometries.push(cabinetGeo);
 const door=new T.Mesh(cabinetGeo,panel);door.position.x=.33;cabinetPivot.add(door);
 const mealStores=new T.Group();foodFrame.add(mealStores);
 for(let i=0;i<4;i++){const pack=dynamic(.16+(i%2)*.25,-.14+Math.floor(i/2)*.27,-.045,.2,.2,.055,warm,box,mealStores);pack.rotation.z=(i%2?.06:-.05);}
 const highlights=new Map<Area,T.MeshStandardMaterial>();
 for(const id of Object.keys(deck)as Area[]){const a=deck[id],m=mat('#71898a',.2,.7,'#719193');m.emissiveIntensity=.08;highlights.set(id,m);const p=dynamic(id==='cockpit'?0:a.x>0?1.18:-1.18,.1,id==='cockpit'?-5.9:a.z,id==='cockpit'?1.1:.018,.008,id==='cockpit'?.018:.7,m);p.name='Interaction guidance / '+id;}
 const alarmMat=mat('#7b513e',.1,.8,'#c78555');alarmMat.emissiveIntensity=.1;
 for(const z of[-4.1,2.6])for(const x of[-1.2,1.2])dynamic(x,2.58,z,.06,.035,.055,alarmMat);
 const busIndicators=[mat('#608c78',.1,.6,'#427d61'),mat('#608c78',.1,.6,'#427d61')];
 for(const[i,m]of busIndicators.entries())dynamic(-1.748,1.29,.29+i*.3,.024,.045,.11,m);
 // Broad practical illumination plus low-resolution indirect reflection field.
 const environment=document.createElement('canvas');environment.width=options.graphics==='quality'?256:128;environment.height=environment.width/2;
 const ectx=environment.getContext('2d');if(ectx){const grad=ectx.createLinearGradient(0,0,0,environment.height);grad.addColorStop(0,'#d6d7cc');grad.addColorStop(.42,'#919b9e');grad.addColorStop(.65,'#424f59');grad.addColorStop(1,'#1c2530');ectx.fillStyle=grad;ectx.fillRect(0,0,environment.width,environment.height);ectx.fillStyle='#f4f0de';for(const x of[.13,.53,.84])ectx.fillRect(x*environment.width,environment.height*.22,environment.width*.09,environment.height*.13);const map=new T.CanvasTexture(environment);map.colorSpace=T.SRGBColorSpace;map.mapping=T.EquirectangularReflectionMapping;scene.environment=map;scene.environmentIntensity=.34;textures.push(map);}
 scene.add(new T.HemisphereLight('#e9e8dc','#8c969f',1.5));const sun=new T.DirectionalLight('#dce8ef',1.35);sun.position.set(-1,4,-10);scene.add(sun);
 const practical=new T.PointLight('#fff0db',9,13,2);practical.position.set(0,2.8,.4);scene.add(practical);const aftFill=new T.DirectionalLight('#e5d6be',.5);aftFill.position.set(1,3,9);scene.add(aftFill);
  // Static contact fields soften furniture/deck joins without a mobile shadow pass.
 const contact=document.createElement('canvas');contact.width=contact.height=64;const cc=contact.getContext('2d');
 if(cc&&typeof cc.createRadialGradient==='function'){
  const shade=cc.createRadialGradient(32,32,5,32,32,32);shade.addColorStop(0,'rgba(0,0,0,.42)');shade.addColorStop(1,'rgba(0,0,0,0)');cc.fillStyle=shade;cc.fillRect(0,0,64,64);
  const tx=new T.CanvasTexture(contact);textures.push(tx);const m=new T.MeshBasicMaterial({map:tx,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});materials.push(m);
  for(const [x,z,w,d]of[[-.8,-5.2,1.2,1.4],[.8,-5.2,1.2,1.4],[-2.2,-3.1,1.5,1.6],[2.2,-3.1,1.5,1.6],[-2.2,.45,1.7,1.4],[2.2,.45,1.7,1.4],[-2.2,4.4,1.7,1.4],[2.2,4.4,1.7,1.4]]){const shadow=dynamic(x,.055,z,w,d,1,m,plane);shadow.rotation.x=-Math.PI/2;}
 }
 const spaceMat = new T.MeshBasicMaterial({ color: "#060c16" });
  materials.push(spaceMat);
  dynamic(0, 2, -17, 30, 20, 1, spaceMat, plane);
  const planet=makePlanet(planetKind(options.destination||"earth"),1.48,true,options.onSceneChange,options.graphics);
  planet.position.set(1.8,1.45,-13);planet.rotation.z=.3;
  scene.add(planet);
  const starGeo = new T.BufferGeometry();
  const pts: number[] = [];
  for (let i = 0; i < 580; i++) {
    // Fixed, deterministic panoramic stars outside the forward windows.
    const x=Math.sin(i*78.233)*11.5;
    const y=Math.cos(i*41.71)*7.8;
    pts.push(x,y,-16.5);
  }
  starGeo.setAttribute("position", new T.Float32BufferAttribute(pts, 3));
  geometries.push(starGeo);
  const starMat = new T.PointsMaterial({
    color: "#dae6f6", size: 0.065, sizeAttenuation: true,
  });
  materials.push(starMat);
  scene.add(new T.Points(starGeo, starMat));
  // Cockpit exterior changes with mission phase. Orbital flight shows the
  // textured planet and stars; on the launch pad the forward viewport instead
  // reveals sky, pad service tower and launch structures. On a landed world,
  // show a dark horizon and the proper planetary regolith.
  const groundedWindow=new T.Group();scene.add(groundedWindow);
  const surface=planetKind(options.destination||"earth");
  const backdrop=document.createElement("canvas");backdrop.width=512;backdrop.height=256;
  const bctx=backdrop.getContext("2d");
  if(bctx){
    const gradient=bctx.createLinearGradient(0,0,0,256);
    if(surface==="earth"){
      gradient.addColorStop(0,"#19314d");gradient.addColorStop(.46,"#668bad");
      gradient.addColorStop(.76,"#bed3df");gradient.addColorStop(1,"#9b9c97");
    }else if(surface==="mars"){
      gradient.addColorStop(0,"#281f26");gradient.addColorStop(.62,"#856054");
      gradient.addColorStop(1,"#b48461");
    }else{
      gradient.addColorStop(0,"#060b14");gradient.addColorStop(.76,"#0d1320");
      gradient.addColorStop(1,"#70737a");
    }
    bctx.fillStyle=gradient;bctx.fillRect(0,0,512,256);
    if(surface!=="earth"){
      bctx.fillStyle=surface==="mars"?"#85654f":"#747b7b";
      bctx.beginPath();bctx.moveTo(0,210);
      for(let x=0;x<=512;x+=8)
        bctx.lineTo(x,198+Math.sin(x*.032)*6+Math.sin(x*.1)*2);
      bctx.lineTo(512,256);bctx.lineTo(0,256);bctx.fill();
    }
  }
  const backgroundMap=new T.CanvasTexture(backdrop);
  backgroundMap.colorSpace=T.SRGBColorSpace;textures.push(backgroundMap);
  const backgroundMat=new T.MeshBasicMaterial({map:backgroundMap,side:T.DoubleSide});
  materials.push(backgroundMat);
  dynamic(0,1.8,-16.2,30,16,1,backgroundMat,plane,groundedWindow);
  if(surface==="earth"){
    // Simplified launch-tower silhouette with diagonal truss braces.
    const towerMat=mat("#45515c",.54,.65);
    for(const x of [-4.0,-3.1]){
      dynamic(x,1.7,-13.8,.19,7,.31,towerMat,box,groundedWindow);
      for(let y=-.2;y<4.9;y+=.63){
        const brace=dynamic(x+.45,y,-13.7,1.15,.09,.18,towerMat,box,groundedWindow);
        brace.rotation.z=(y*1.6)%2>.9?.48:-.48;
      }
    }
    for(let y=0;y<4.5;y+=.8)
      dynamic(-3.55,y,-13.65,1.2,.11,.17,towerMat,box,groundedWindow);
    dynamic(1.7,.05,-14.1,3.8,1,.4,towerMat,box,groundedWindow);
  }
  // This foreground only appears during pad and landed phases.
  groundedWindow.visible=false;
  let lastScreen = -1,
    lastFx = 0,
    fxStart = -10,
    action: Action | undefined;
  const handGroup = new T.Group();
  handGroup.visible = false;
  const camera = new T.PerspectiveCamera(65, 1, 0.08, 60);
  // Visible white EVA sleeves and gloved hands anchor the first-person viewpoint
  // when an equipped astronaut moves outside the pressurized vehicle.
  const evaGloves=createEvaGloves(options.graphics);
  const evaHands=evaGloves.group;camera.add(evaHands);evaHands.visible=false;
  camera.position.set(0, 1.63, 6.5);
  camera.rotation.order = "YXZ";
  camera.add(handGroup);
  scene.add(camera);
  const bottle = dynamic(
    0.25,
    -0.29,
    -0.58,
    0.064,
    0.29,
    0.064,
    white,
    cylinder,
    handGroup,
  );
  dynamic(0.25, -0.125, -0.58, 0.045, 0.04, 0.045, dark, cylinder, handGroup);
  const glove = dynamic(
    0.32,
    -0.43,
    -0.57,
    0.11,
    0.1,
    0.08,
    warm,
    sphere,
    handGroup,
  );
  const pack = dynamic(
    0.1,
    -0.28,
    -0.57,
    0.18,
    0.22,
    0.045,
    warm,
    box,
    handGroup,
  );
  const wrenchGroup = new T.Group();
  handGroup.add(wrenchGroup);
  dynamic(0.2, -0.3, -0.58, 0.025, 0.36, 0.02, silver, box, wrenchGroup);
  dynamic(0.2, -0.11, -0.58, 0.09, 0.07, 0.025, silver, box, wrenchGroup);
  dynamic(0.2, -0.37, -0.58, 0.04, 0.16, 0.03, dark, box, wrenchGroup);
  return {
    scene,
    camera,
    update(
      t: number,
      near: Area | undefined,
      alarm: boolean,
      fx: VisualAction | undefined,
      pos: Position,
      telemetry: Telemetry,
      target?: Area | null,
      landed = false,
      world?: ShipState,
      suited = false,
    ) {
      planet.visible = !landed;
      groundedWindow.visible = landed;
      evaHands.visible=suited&&pos.z>10.4;
      if(world){
        const powered=world.switches.busA||world.switches.busB;
        practical.intensity=powered?12:1.6;
        for(const [index,indicator] of busIndicators.entries()){
          const on=world.switches[index===0?"busA":"busB"];
          indicator.color.set(on?"#79a78c":"#756b56");indicator.emissiveIntensity=on?.5:0;
        }
      }
      if (fx && fx.id !== lastFx) {
        lastFx = fx.id;
        fxStart = t;
        action = fx.action;
      }
      for (const [id, m] of highlights)
        m.emissiveIntensity =
          id === near && (target === undefined || target === id) ? 0.65 : 0.08;
      alarmMat.emissiveIntensity = alarm ? 0.3 + Math.sin(t * 3) * 0.2 : 0.06;
      const open = world
        ? Number(world.doors.flight.open)
        : Math.abs(pos.z + 4.35) < 2.5
          ? 1
          : 0;
      // The visible flight door and its controls reach their end state
      // at precisely the same instant as the crossing collision interlock.
      const doorReadyAt=world?.doors.flight.readyAt ?? 0;
      const doorNowMs=Date.now();
      hatchLeaves.forEach((m,i)=>{
        m.position.x=sectionDoorLeafX(!!open,i===0?-1:1,doorReadyAt,doorNowMs);
      });
      const visibleOpen=sectionDoorOpenFraction(!!open,doorReadyAt,doorNowMs);
      for(const key of flightDoorButtons) key.position.x=.54+visibleOpen*1.05;
      const age = t - fxStart;
      mealStores.visible=!!world?.lockers.food;
      cabinetPivot.rotation.y +=
        ((world
          ? world.lockers.food
            ? -0.9
            : 0
          : action === "takeMeal" && age < 2
            ? -0.9
            : 0) -
          cabinetPivot.rotation.y) *
        0.08;
      handGroup.visible =
        age < 1.6 &&
        ["drink", "dispenser", "eat", "takeMeal", "fill", "repair"].includes(
          action || "",
        );
      handGroup.position.y = Math.sin(Math.min(1, age / 1.6) * Math.PI) * 0.14;
      handGroup.rotation.z = Math.sin(age * 3) * 0.035;
      bottle.visible = ["drink", "dispenser", "fill"].includes(action || "");
      pack.visible = !bottle.visible && action !== "repair";
      wrenchGroup.visible = action === "repair";
      glove.visible = handGroup.visible;
      if (Math.floor(t * 1.5) !== lastScreen) {
        lastScreen = Math.floor(t * 1.5);
        displays.draw(telemetry, t, pos, world);
      }
    },
    dispose() {
      if(disposed)return;disposed=true;
      references.forEach(handle=>handle.dispose());fallbackFinishes.forEach(handle=>handle.dispose());
      evaGloves.dispose();
      disposePlanet(planet);
      fallbackModels.forEach(model=>disposeObjectResources(model));fallbackBatches.forEach(dispose=>dispose());
      geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
    },
  };
}

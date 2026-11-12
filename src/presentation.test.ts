import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { commanderPresentation, commanderPresentations, storyPresentation, presentationBudgets } from "./presentation/missionPresentation";
import { createOrbitalWorksite } from "./presentation/orbitalWorksite";
import { acceptDownloadedScene, disposeObjectResources } from "./presentation/resources";
import { assetManifest, inheritedPlanetaryImages } from "./presentation/assetManifest";
import { missions, missionById } from "./commander/campaign/definitions";
import { createSession, emptyProgress } from "./commander/campaign/engine";
import { defaultDesign, defaultLife } from "./commander/simulation";
import { createFieldWorld } from "./commander/campaign/world";
import { craterRelief, terrainRelief, visualCraters } from "./commander/campaign/surfaceScenery";
import { makePlanet, disposePlanet } from "./commander/celestial";
import { createDisplays } from "./commander/displays";
import { createInterior } from "./commander/interior";
import { createHistoricVehicle } from "./history/historicVehicles";
import { historyMissions } from "./history/missionHistory";
import { createStoryScenario } from "./history/storyScenarios";
import { createStoryScene, validStoryWorldSnapshot, type StoryWorldSnapshot } from "./history/storyWorld";

/** Geometry/state tests have no WebGL or network. Browser image comparison and
 * reachability remain separate acceptance evidence. */
function withCanvas<R>(run:(labels:string[])=>R):R {
  const previous=globalThis.document,labels:string[]=[];
  const context=new Proxy({
    createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)}),
    createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),
    fillText:(text:string)=>labels.push(text),measureText:()=>({width:100}),
  } as Record<string,unknown>,{get:(target,key)=>target[String(key)]??(()=>{})});
  globalThis.document={
    createElement:()=>({width:0,height:0,getContext:()=>context}),
    createElementNS:()=>({addEventListener(){},removeEventListener(){},set src(_value:string){}}),
  } as unknown as Document;
  try{return run(labels);}finally{globalThis.document=previous;}
}

test("presentation routes every Commander mission without granting destination landings",()=>{
  assert.equal(commanderPresentations.length,18);
  for(const mission of missions){
    const p=commanderPresentation(mission.id,mission.destination);
    assert.equal(p.destination,mission.destination,mission.id);
    assert.equal(p.playerContext==="surface",mission.surface,mission.id);
    if(mission.level>=13)assert.equal(p.terrain,"none");
  }
  assert.equal(commanderPresentation("mission-2","earth").worksite,"satellite");
  assert.equal(commanderPresentation("mission-8","earth").worksite,"telescope");
  assert.equal(commanderPresentation("mission-12","earth").worksite,"relay");
  assert.equal(commanderPresentation("unsupported","mars").terrain,"none");
  for(const mission of historyMissions){
    const scenario=createStoryScenario(mission),p=storyPresentation(scenario);
    if(scenario.role==="mission operator")assert.equal(p.playerContext,"mission-control");
    assert.equal(p.historicCabin,false);
  }
});

test("all three orbital worksites render at the existing service position and follow repair state",()=>withCanvas(()=>{
  for(const level of [2,8,12]){
    const scene=new T.Scene(),mission=missionById(`mission-${level}`);
    const effect=createFieldWorld(scene,"earth",mission.id,"battery");
    const environment=scene.children[0],worksite=environment.children.find(c=>c.userData.worksiteProfile)!;
    assert.ok(worksite,mission.id);assert.deepEqual(worksite.position.toArray(),[2.4,0,15]);
    // Visual fixture only: no completion or unlock is synthesized.
    const s={...createSession(missionById("mission-1"),defaultDesign,defaultLife,[],emptyProgress()),missionId:mission.id};
    effect.update(s);assert.equal(worksite.visible,true);
    const indicator=worksite.getObjectByName("live service status") as T.Mesh;
    const status=indicator.material as T.MeshBasicMaterial,initial=status.color.getHex();
    s.systems.satelliteRepaired=true;effect.update(s);assert.notEqual(status.color.getHex(),initial);
    s.systems.satelliteOnline=true;effect.update(s);assert.equal(status.color.getHexString(),"8cd3ad");
    effect.dispose();effect.dispose();assert.equal(scene.children.length,0);
  }
}));

test("camp hardware and cables use deployment/fault state; remote missions construct no terrain",()=>withCanvas(()=>{
  const session=createSession(missionById("mission-1"),defaultDesign,defaultLife,[],emptyProgress());
  for(const [missionId,destination] of [["mission-11","moon"],["mission-15","mars"],["mission-17","asteroid"]] as const){
    const scene=new T.Scene(),world=createFieldWorld(scene,destination,missionId,"battery");
    const environment=scene.children[0],camp=environment.getObjectByName("Unpressurized instrument camp")!;
    const s={...session,missionId,camp:{...session.camp,shelter:false,solar:false,battery:false}};
    world.update(s);assert.equal(camp.visible,destination==="moon");
    if(destination!=="moon")assert.equal(environment.children.some(c=>c instanceof T.Mesh&&c.geometry instanceof T.PlaneGeometry),false);
    if(destination==="moon"){
      const solar=camp.getObjectByName("Camp solar")!,cable=camp.getObjectByName("Camp solar cable")!;
      assert.equal(solar.visible,false);assert.equal(cable.visible,false);
      s.camp.shelter=true;s.camp.solar=true;s.camp.power=.5;world.update(s);
      assert.equal(solar.visible,true);assert.equal(cable.visible,true);
      const connector=camp.getObjectByName("Camp power connector") as T.Mesh;
      assert.equal((connector.material as T.MeshStandardMaterial).color.getHexString(),"79a88a");
      s.camp.broken=true;world.update(s);assert.equal((connector.material as T.MeshStandardMaterial).color.getHexString(),"c56740");
    }
    world.dispose();
  }
}));

test("worksite construction keeps bounded meshes and geometry in every tier",()=>{
  for(const tier of ["battery","balanced","quality"] as const)for(const profile of ["satellite","telescope","relay"] as const){
    const worksite=createOrbitalWorksite(profile,tier);let meshes=0,triangles=0;
    worksite.group.traverse(object=>{if(object instanceof T.Mesh){meshes++;triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3*(object instanceof T.InstancedMesh?object.count:1);}});
    assert.ok(meshes<=45,`${profile}/${tier}: ${meshes} meshes`);
    assert.ok(triangles<12000,`${profile}/${tier}: ${triangles} triangles`);
    assert.ok(presentationBudgets[tier].worksiteSegments<=28);
    worksite.dispose();assert.equal(worksite.group.userData.disposed,true);
  }
});

test("all cabin tiers retain live MFDs, authored architecture and independently animated hatch leaves",()=>withCanvas((labels)=>{
  const budgets:{triangles:number;drawables:number}[]=[],shellBudgets:number[]=[];
  for(const graphics of ["battery","balanced","quality"] as const){
    const cabin=createInterior({eva:true,destination:"mars",graphics});
    let triangles=0,drawables=0;
    cabin.scene.traverse(object=>{if(object instanceof T.Mesh){drawables++;triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3*(object instanceof T.InstancedMesh?object.count:1);}});
    budgets.push({triangles,drawables});
    assert.ok(cabin.camera instanceof T.PerspectiveCamera);
    const shell=cabin.scene.getObjectByName("ORBITAL / manufactured pressure module");assert.ok(shell,"immediate original authored hull works offline");
    let shellTriangles=0;shell!.traverse(o=>{if(o instanceof T.Mesh)shellTriangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});shellBudgets.push(shellTriangles);
    for(const [name,pos]of [["Live communications MFD",[1.765,1.68,-3.1]],["Live engineering MFD",[-1.765,1.68,.45]]]as const){
      assert.deepEqual(cabin.scene.getObjectByName(name)?.position.toArray(),[...pos]);
    }
    assert.equal(cabin.scene.children.filter(o=>o.name==="Animated flight pressure leaf").length,2);
    for(const title of["01 / FLIGHT DECK","02 / VEHICLE SYSTEMS","03 / CREW & EVA","UPLINK / RF ROUTING","ECLSS / RECOVERY","POTABLE WATER","SAMPLE / ANALYSIS"])assert.ok(labels.includes(title),title);
    const textures=new Set<T.Texture>();
    cabin.scene.traverse(o=>{if(o instanceof T.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])for(const value of Object.values(m))if(value instanceof T.Texture)textures.add(value);});
    let releases=0;for(const tx of textures)tx.addEventListener("dispose",()=>releases++);
    cabin.dispose();cabin.dispose();assert.equal(releases,textures.size,"idempotent owner releases every map exactly once");
  }
  for(const budget of budgets){assert.ok(budget.triangles<160000,JSON.stringify(budget));assert.ok(budget.drawables<90,JSON.stringify(budget));}
  assert.equal(shellBudgets[0],shellBudgets[2],"graphics choices retain the complete authored architecture");
  assert.ok(budgets[0].triangles<=budgets[2].triangles,"EVA glove detail can scale independently");
}));

test("crater bowls deform terrain while hatch and sample approaches stay clear",()=>{
  for(const crater of visualCraters){
    assert.ok(craterRelief(crater.x,crater.z)<-.3);
    assert.ok(craterRelief(crater.x+crater.radius*.86,crater.z)>0);
    assert.equal(craterRelief(crater.x+crater.radius*1.5,crater.z),0);
  }
  for(const [x,z] of [[0,9],[0,12],[3,16],[-6,23],[6,26],[-7,32]]){
    assert.equal(craterRelief(x,z),0);assert.ok(Math.abs(terrainRelief(x,z))<.3);
  }
});

test("GPU disposal deduplicates materials/maps and releases late and invalid scene downloads",()=>{
  const root=new T.Group(),geometry=new T.BoxGeometry(),texture=new T.Texture();
  const material=new T.MeshStandardMaterial({map:texture,bumpMap:texture});
  root.add(new T.Mesh(geometry,material),new T.Mesh(geometry,material),new T.Line(geometry,new T.LineBasicMaterial()));
  let geometries=0,maps=0,mats=0;geometry.addEventListener("dispose",()=>geometries++);texture.addEventListener("dispose",()=>maps++);material.addEventListener("dispose",()=>mats++);
  disposeObjectResources(root);disposeObjectResources(root);
  assert.deepEqual([geometries,maps,mats],[1,1,1]);
  const late=new T.Group(),lateGeometry=new T.BoxGeometry();late.add(new T.Mesh(lateGeometry,new T.MeshBasicMaterial()));
  let lateDisposals=0;lateGeometry.addEventListener("dispose",()=>lateDisposals++);
  assert.equal(acceptDownloadedScene(root,late),false);assert.equal(lateDisposals,1);
  const live=new T.Group(),invalid=new T.Group();
  assert.equal(acceptDownloadedScene(live,invalid,false),false);assert.equal(invalid.userData.disposed,true);
});

test("late planetary image completion disposes the downloaded texture after scene disposal",()=>withCanvas(()=>{
  const load=T.TextureLoader.prototype.load;
  let complete:Parameters<T.TextureLoader["load"]>[1];
  T.TextureLoader.prototype.load=function(_url,onLoad){complete=onLoad;return new T.Texture();};
  try{
    const body=makePlanet("earth",2,false);disposePlanet(body);
    const late=new T.Texture<HTMLImageElement>();let released=0;late.addEventListener("dispose",()=>released++);
    complete!(late);assert.equal(released,1);
  }finally{T.TextureLoader.prototype.load=load;}
}));

test("accepted cabin, orbital and lunar planet images invalidate only after material replacement; disposed scenes stay idle",()=>withCanvas(()=>{
  const load=T.TextureLoader.prototype.load;
  const pending:NonNullable<Parameters<T.TextureLoader["load"]>[1]>[]=[];
  T.TextureLoader.prototype.load=function(_url,onLoad){if(onLoad)pending.push(onLoad);return new T.Texture();};
  const factories=[
    (changed:()=>void)=>{const cabin=createInterior({destination:"moon",graphics:"battery",onSceneChange:changed});return {root:cabin.scene,dispose:()=>cabin.dispose()};},
    (changed:()=>void)=>{const root=new T.Scene(),world=createFieldWorld(root,"earth","mission-2","battery",changed);return {root,dispose:()=>world.dispose()};},
    (changed:()=>void)=>{const root=new T.Scene(),world=createFieldWorld(root,"moon","mission-4","battery",changed);return {root,dispose:()=>world.dispose()};},
  ];
  try{
    for(const create of factories)for(const live of [true,false]){
      let changes=0;
      const image=new T.Texture<HTMLImageElement>();let imageDisposals=0;
      image.addEventListener("dispose",()=>imageDisposals++);
      const mapsBefore=new Set<T.Texture>();
      const scene=create(()=>{
        let accepted=false;
        scene.root.traverse(object=>{if(object instanceof T.Mesh)for(const material of Array.isArray(object.material)?object.material:[object.material]){
          if("map" in material&&material.map===image)accepted=true;
        }});
        assert.equal(accepted,true,"redraw notification observes the installed image, not an incomplete load");changes++;
      });
      scene.root.traverse(object=>{if(object instanceof T.Mesh)for(const material of Array.isArray(object.material)?object.material:[object.material]){
        if("map" in material&&material.map instanceof T.Texture)mapsBefore.add(material.map);
      }});
      const complete=pending.pop();assert.ok(complete);assert.equal(pending.length,0);
      assert.equal(changes,0,"construction does not issue spurious asynchronous notifications");
      if(!live)scene.dispose();
      complete(image);
      assert.equal(changes,live?1:0);
      if(live){
        assert.equal(image.colorSpace,T.SRGBColorSpace);assert.equal(image.anisotropy,2);
        assert.ok(!mapsBefore.has(image));assert.equal(imageDisposals,0);
        scene.dispose();
      }
      assert.equal(imageDisposals,1,"accepted and rejected late images each retain exactly one resource owner");
    }
  }finally{T.TextureLoader.prototype.load=load;}
}));

test("only an accepted live telescope model requests a paused redraw; invalid and late models are disposed",async()=>{
  const load=GLTFLoader.prototype.load,previousWindow=globalThis.window;
  const pending:Parameters<GLTFLoader["load"]>[1][]=[];
  GLTFLoader.prototype.load=function(_url,onLoad){pending.push(onLoad);};
  globalThis.window={} as Window&typeof globalThis;
  try{
    for(const outcome of ["accepted","invalid","late"] as const){
      let changes=0;
      const root=new T.Scene();
      const world=withCanvas(()=>createFieldWorld(root,"earth","mission-8","battery",()=>{
        assert.ok(root.getObjectByName("Accepted test telescope"),"model is attached before requesting its redraw");changes++;
      }));
      await import("./presentation/referenceModelLoader");
      for(let tries=0;!pending.length&&tries<10;tries++)await new Promise<void>(resolve=>setImmediate(resolve));
      const complete=pending.shift();assert.ok(complete,"the real lazy loader requests the optional reference model");
      const model=new T.Group();model.name="Accepted test telescope";
      const geometry=new T.BoxGeometry(),material=new T.MeshBasicMaterial();let releases=0;
      if(outcome!=="invalid")model.add(new T.Mesh(geometry,material));
      else{geometry.dispose();material.dispose();}
      geometry.addEventListener("dispose",()=>releases++);
      if(outcome==="late")world.dispose();
      complete({scene:model} as GLTF);
      assert.equal(changes,outcome==="accepted"?1:0);
      assert.equal(!!root.getObjectByName(model.name),outcome==="accepted");
      if(outcome==="accepted")world.dispose();
      else if(outcome==="invalid")world.dispose();
      assert.equal(model.userData.disposed,true);
      if(outcome!=="invalid")assert.equal(releases,1);
    }
  }finally{GLTFLoader.prototype.load=load;globalThis.window=previousWindow;}
});

test("physical displays show actual isolation/fault state without fabricated live telemetry",()=>withCanvas(labels=>{
  const displays=createDisplays(),s=createSession(missionById("mission-1"),defaultDesign,defaultLife,[],emptyProgress());
  displays.draw(s.state,0,s.position,s.world);
  assert.ok(labels.includes("SIMULATED TRACE / SCIENCE POINTS"));
  s.world.switches.busA=false;s.world.switches.busB=false;labels.length=0;
  displays.draw(s.state,1,s.position,s.world);
  assert.equal(labels.filter(t=>t==="BUS POWER ISOLATED").length,4);assert.ok(!labels.some(t=>t.includes("SCIENCE RETURN")));
  displays.panels.forEach(p=>{p.texture.dispose();p.material.dispose();});
}));

test("historical copies own their materials and preserve characteristic shuttle engine count",()=>{
  const scenario=createStoryScenario(historyMissions.find(m=>m.title==="STS-1")!);
  const first=createHistoricVehicle(scenario),second=createHistoricVehicle(scenario);
  const firstMesh=first.children.find(c=>c instanceof T.Mesh) as T.Mesh,secondMesh=second.children.find(c=>c instanceof T.Mesh) as T.Mesh;
  assert.notEqual(firstMesh.material,secondMesh.material);
  assert.equal(first.children.filter(c=>c.name==="Shuttle main engine").length,3);
  let secondDisposed=0;(secondMesh.material as T.Material).addEventListener("dispose",()=>secondDisposed++);
  disposeObjectResources(first);assert.equal(secondDisposed,0);disposeObjectResources(second);
});

test("Story scenes preserve black lunar sky and remote Mars operator context",()=>withCanvas(()=>{
  for(const title of ["Apollo 11","Curiosity"]){
    const scenario=createStoryScenario(historyMissions.find(m=>m.title===title)!);
    const world=createStoryScene(scenario);
    assert.equal((world.scene.background as T.Color).getHex(),0);
    assert.equal(world.dusty,title==="Apollo 11");
    assert.equal(world.scene.userData.presentation.playerContext,title==="Apollo 11"?"surface":"mission-control");
    disposeObjectResources(world.scene);
  }
}));

test("Story pose validation rejects unearned surface/remote positions and invalid inertia",()=>{
  const indoor:StoryWorldSnapshot={version:1,outside:false,position:[0,1.65,5.9],yaw:0,pitch:0,motion:[0,0,0],jumpHeight:0,jumpSpeed:0,movement:[0,0]};
  assert.equal(validStoryWorldSnapshot(indoor,{role:"astronaut",setting:"moon"}),true);
  const lunar={...indoor,outside:true,position:[0,2.65,17] as [number,number,number],jumpHeight:1,jumpSpeed:.3};
  assert.equal(validStoryWorldSnapshot(lunar,{role:"astronaut",setting:"moon"}),true);
  assert.equal(validStoryWorldSnapshot(lunar,{role:"mission operator",setting:"mars"}),false);
  for(const bad of [{...indoor,position:[99,1.65,5.9]},{...indoor,motion:[NaN,0,0]},{...indoor,movement:[2,0]},{...lunar,jumpHeight:99}])assert.equal(validStoryWorldSnapshot(bad,{role:"astronaut",setting:"moon"}),false);
  const orbit={...indoor,outside:true,position:[1,2,14] as [number,number,number],motion:[.1,.2,.3] as [number,number,number]};
  assert.equal(validStoryWorldSnapshot(orbit,{role:"astronaut",setting:"orbit"}),true);
  assert.equal(validStoryWorldSnapshot({...orbit,position:[0,1.65,50]},{role:"astronaut",setting:"orbit"}),false);
});

test("Hubble remains pinned and active image rights are separate from archived unresolved images",()=>{
  assert.match(assetManifest.hubble.sourceUrl,new RegExp(assetManifest.hubble.version));
  assert.match(assetManifest.hubble.runtimeUrl,/^\.\/assets\/models\/hubble-11ebb4ee-e5ba4de15c7d\.glb$/);
  assert.equal(assetManifest.hubble.sha256.length,64);assert.equal(assetManifest.hubble.bytes,1694988);
  assert.match(assetManifest.hubble.attribution,/DigitalSpace/);
  for(const asset of [assetManifest.earth,assetManifest.moon]){
    assert.match(asset.terms,/NASA SVS explicitly releases/);assert.ok(asset.fallback);
    assert.match(asset.runtimeUrl,/^\.\/assets\/planetary\//);
  }
  for(const archived of Object.values(inheritedPlanetaryImages))assert.match(archived.rights,/unresolved; no longer requested at runtime/);
});

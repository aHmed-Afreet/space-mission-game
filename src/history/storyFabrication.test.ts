import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { consoleHousing, fabricationMaterials, finishFabrication } from "./storyFabrication";
import { installStoryBridge } from "./storyBridge";
import { historyMissions } from "./missionHistory";
import { createStoryScenario } from "./storyScenarios";
import { disposeObjectResources } from "../presentation/resources";

test("formed console architecture stays within the existing historical camera collision footprint",()=>{
 for(const family of["apollo","early-capsule","shuttle","station","ground-control"] as const){
  const group=new T.Group();consoleHousing(group,2.14,fabricationMaterials(family),family);
  const box=new T.Box3().setFromObject(group);
  assert.ok(box.min.x>=-1.36&&box.max.x<=1.36);
  assert.ok(box.min.z>=-.86&&box.max.z<=.86);
  assert.ok(box.max.y<2.45,"instruments clear the cabin pressure lining");
  assert.ok(group.children.some(child=>child instanceof T.Mesh&&child.geometry instanceof T.ExtrudeGeometry),"purpose-drawn housing has a real shaped side elevation");
  const before=group.children.length;finishFabrication(group);
  assert.ok(group.children.length<before,"static equipment is consolidated instead of adding per-frame draws");
  const batched=new T.Box3().setFromObject(group);
  assert.ok(batched.min.distanceTo(box.min)<1e-6&&batched.max.distanceTo(box.max)<1e-6,"batching preserves the physical envelope within Float32 precision");
  disposeObjectResources(group);
 }
});

test("historical pressure architecture remains finite, bounded and distinct from terrestrial robotic operations",()=>{
 for(const title of["Apollo 11","STS-1","Voyager 1","Vostok 1","ISS"]){
  const mission=historyMissions.find(m=>m.title===title)||historyMissions.find(m=>m.title.includes(title));assert.ok(mission,title);
  const scenario=createStoryScenario(mission!),root=new T.Group();installStoryBridge(root,scenario);
  let calls=0,triangles=0;
  root.traverse(object=>{if(object instanceof T.Mesh){calls++;const position=object.geometry.attributes.position;for(let i=0;i<position.array.length;i++)assert.ok(Number.isFinite(position.array[i]));triangles+=(object.geometry.index?.count??position.count)/3;}});
  assert.ok(calls<20,`${title}: ${calls} static material batches`);
  assert.ok(triangles<90000,`${title}: ${triangles} triangles`);
  assert.equal(root.userData.bridgeRole,scenario.role==="astronaut"?"CREW VEHICLE":"GROUND MISSION CONTROL");
  disposeObjectResources(root);
 }
});

test("recessed historical displays stay in front of their actual opaque fascia",async()=>{
 const previous=globalThis.document;
 const context=new Proxy({createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),measureText:()=>({width:100})}as Record<string,unknown>,{get:(o,k)=>o[String(k)]??(()=>{})});
 globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>context}),createElementNS:()=>({addEventListener(){},removeEventListener(){},set src(_v:string){}})}as unknown as Document;
 try{
  const {createStoryScene}=await import('./storyWorld');
  for(const title of ['Apollo 11','STS-1','Voyager 1']){
   const mission=historyMissions.find(m=>m.title===title)!;assert.ok(mission);
   const built=createStoryScene(createStoryScenario(mission));built.scene.updateMatrixWorld(true);
   for(const [id,station]of Object.entries(built.stationMeshes)){
    const display=station.getObjectByName('Historical live '+id+' display') as T.Mesh;assert.ok(display);
    const center=display.getWorldPosition(new T.Vector3()),normal=new T.Vector3(0,0,1).applyQuaternion(display.getWorldQuaternion(new T.Quaternion()));
    const ray=new T.Raycaster(center.clone().add(normal),normal.clone().negate(),.001,1.5),hits:T.Intersection[]=[];
    station.traverse(object=>{if(object instanceof T.Mesh)T.Mesh.prototype.raycast.call(object,ray,hits);});hits.sort((a,b)=>a.distance-b.distance);
    assert.equal(hits[0]?.object,display,title+' / '+id+' fascia must not blank its instrument screen');
   }
   built.references.forEach(r=>r.dispose());disposeObjectResources(built.scene);
  }
 }finally{if(previous===undefined)delete(globalThis as {document?:Document}).document;else globalThis.document=previous;}
});

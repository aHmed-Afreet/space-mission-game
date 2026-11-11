import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { installPressureCabin } from "./pressureCabin";
import { stepLocomotion, type LocomotionState } from "./locomotion";

test("pressure-frame optics own and restore scene resources without altering existing fixtures", () => {
  const original = globalThis.document;
  const gradient = {addColorStop(){}};
  globalThis.document = {createElement:()=>({width:0,height:0,getContext:()=>({createLinearGradient:()=>gradient,createRadialGradient:()=>gradient,fillRect(){}})})} as unknown as Document;
  try {
    const scene = new T.Scene(), fixture = new T.Group(), old = new T.Texture();
    scene.add(fixture); scene.environment = old; scene.environmentIntensity = .7;
    const dispose = installPressureCabin(scene,"quality");
    const reflections = scene.environment!;
    assert.notEqual(reflections, old);
    const owned = scene.children.find(child=>child!==fixture)!;
    const instances: T.InstancedMesh[] = [];
    owned.traverse(object=>{if(object instanceof T.InstancedMesh)instances.push(object);});
    assert.equal(instances.length, 3, "curved frames and contact fields stay within three draw calls");
    let released=0; reflections.addEventListener("dispose",()=>released++);
    dispose(); dispose();
    assert.equal(released,1);
    assert.equal(scene.environment,old); assert.equal(scene.environmentIntensity,.7);
    assert.deepEqual(scene.children,[fixture]);
  } finally {
    if(original===undefined) delete (globalThis as {document?:Document}).document;
    else globalThis.document=original;
  }
});

test("floating EVA never receives a walking head bob, and reduced motion remains level", () => {
  for(const reduced of [false,true]){
    const state:LocomotionState={position:{x:0,y:1.63,z:13},movement:{forward:.6,sideways:0},jump:{height:.5,velocity:0}};
    stepLocomotion(state,{forward:1,sideways:0,yaw:0,sprint:true,lift:0},{movement:1.7,gravity:0},1/60,()=>true,.3,reduced);
    assert.equal(state.position.y,1.63+state.jump.height);
  }
});

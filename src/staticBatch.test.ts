import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {batchStaticVisuals} from "./presentation/staticBatch";

test("static batching preserves transformed scenery and excludes moving doors, instances and alpha surfaces",()=>{
  const scene=new T.Scene(),root=new T.Group();root.position.set(7,2,-3);root.rotation.y=.4;scene.add(root);
  const sub=new T.Group();sub.position.set(2,0,1);sub.rotation.z=.3;root.add(sub);
  const geometry=new T.BoxGeometry(),material=new T.MeshStandardMaterial();
  const sources=[new T.Mesh(geometry,material),new T.Mesh(geometry,material)];sources[1].position.set(3,1,0);sub.add(...sources);
  const door=new T.Group(),leaf=new T.Mesh(geometry,material);door.add(leaf);root.add(door);
  const instanced=new T.InstancedMesh(geometry,material,1);root.add(instanced);
  const alpha=new T.Mesh(geometry,new T.MeshBasicMaterial({transparent:true}));root.add(alpha);
  scene.updateMatrixWorld(true);
  const before=new T.Box3().setFromObject(sources[0]).union(new T.Box3().setFromObject(sources[1]));
  const release=batchStaticVisuals(root,[door]);scene.updateMatrixWorld(true);
  const merged=root.children.find(object=>object.name==="batched static cabin fittings")!;
  const after=new T.Box3().setFromObject(merged);
  assert.ok(before.min.distanceTo(after.min)<1e-5);assert.ok(before.max.distanceTo(after.max)<1e-5);
  assert.equal(leaf.parent,door);assert.equal(instanced.parent,root);assert.equal(alpha.parent,root);
  door.position.x=4;assert.equal(leaf.parent!.position.x,4,"moving subtree remains independent");
  assert.deepEqual(root.userData.staticBatch,{before:2,after:1});
  let count=0;(merged as T.Mesh).geometry.addEventListener("dispose",()=>count++);release();assert.equal(count,1);
  geometry.dispose();material.dispose();(alpha.material as T.Material).dispose();instanced.dispose();
});

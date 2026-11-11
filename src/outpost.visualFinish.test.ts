import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {batchOutpostStructure,outpostTerrainHeight} from "./outpost/visualFinish";

test("outpost scenery stays level throughout the walkable square and grounded beyond it",()=>{
 for(let x=-29;x<=29;x+=2)for(let z=-29;z<=29;z+=2)assert.equal(outpostTerrainHeight(x,z),-.1);
 let range=0;
 for(let x=-110;x<=110;x+=7)for(let z=-110;z<=110;z+=7){
  const height=outpostTerrainHeight(x,z);assert.ok(Number.isFinite(height));assert.ok(Math.abs(height)<10);range=Math.max(range,Math.abs(height));
 }
 assert.ok(range>2,"distant terrain should have actual elevation");
});

test("static outpost batching preserves world bounds and independently animated doors",()=>{
 const world=new T.Group(),material=new T.MeshStandardMaterial(),geometry=new T.BoxGeometry(1,1,1);
 const frame=new T.Group();frame.position.set(3,2,-4);frame.rotation.y=.4;world.add(frame);
 for(let i=0;i<9;i++){const panel=new T.Mesh(geometry,material);panel.position.x=i*.6;frame.add(panel);}
 const door=new T.Mesh(geometry,material);door.position.set(2,1,4);world.add(door);
 world.updateMatrixWorld(true);const before=new T.Box3().setFromObject(world);
 const release=batchOutpostStructure(world,[door]);world.updateMatrixWorld(true);
 const after=new T.Box3().setFromObject(world);
 assert.ok(before.min.distanceTo(after.min)<1e-5);assert.ok(before.max.distanceTo(after.max)<1e-5);
 assert.equal(door.parent,world);door.position.x+=1;assert.equal(door.position.x,3);
 let draws=0;world.traverse(object=>{if(object instanceof T.Mesh)draws++;});assert.equal(draws,2);
 release();world.traverse(object=>{if(object instanceof T.Mesh)object.geometry.dispose();});material.dispose();
});

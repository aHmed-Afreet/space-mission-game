import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {rigAstronautModel} from './presentation/astronautRig';

test('self-hosted realism references have complete provenance, hashes and mobile budgets',()=>{
 const root=new URL('../public/assets/realism/',import.meta.url);
 const manifest=JSON.parse(readFileSync(new URL('manifest.json',root),'utf8'));
 const credits=readFileSync(new URL('ATTRIBUTION.md',root),'utf8');
 let total=0;
 for(const model of manifest.models){
  const data=readFileSync(new URL(`${model.key}.glb`,root));total+=data.length;
  assert.equal(data.readUInt32LE(0),0x46546c67);assert.equal(data.readUInt32LE(4),2);
  assert.equal(data.length,model.runtimeBytes);assert.equal(createHash('sha256').update(data).digest('hex'),model.runtimeSha256);
  assert.match(model.url,/^https:\/\/raw\.githubusercontent\.com\/nasa\/NASA-3D-Resources\/[a-f0-9]{40}\//);
  assert.match(model.sourceSha256,/^[a-f0-9]{64}$/);assert.ok(credits.includes(`${model.key}.glb`));
  assert.ok(model.runtimePrimitives<=8);assert.ok(model.runtimeTriangles<80000);assert.ok(data.length<250000);
  const json=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());
  assert.ok(!json.animations?.length);assert.ok(json.extensionsRequired.includes('KHR_draco_mesh_compression'));
  assert.ok(!json.images?.some((image:{uri?:string})=>image.uri));
 }
 assert.ok(total<1500000);
 for(const file of manifest.terrain.files){const data=readFileSync(new URL(file.file,root));assert.equal(createHash('sha256').update(data).digest('hex'),file.sha256);}
 assert.equal(manifest.terrain.license,'CC0-1.0');
});

test('EVA reference rig keeps finite normalized skin weights and supports idle and gait',()=>{
 const parent=new T.Group();parent.position.set(20,1,-8);parent.rotation.y=1.7;parent.scale.setScalar(.9);
 const model=new T.Group();parent.add(model);
 const torso=new T.Mesh(new T.BoxGeometry(1,2,.4),new T.MeshStandardMaterial());torso.position.y=1;model.add(torso);
 model.scale.setScalar(.75);
 parent.updateMatrixWorld(true);
 const rig=rigAstronautModel(model);
 const skins:T.SkinnedMesh[]=[];model.traverse(o=>{if(o instanceof T.SkinnedMesh)skins.push(o);});assert.equal(skins.length,1);
 parent.updateMatrixWorld(true);skins[0].skeleton.update();
 const positions=skins[0].geometry.getAttribute('position');
 for(let i=0;i<positions.count;i++){
  const source=new T.Vector3().fromBufferAttribute(positions,i);
  assert.ok(skins[0].getVertexPosition(i,new T.Vector3()).distanceTo(source)<1e-4,'rest-pose skin must preserve geometry under translated/rotated parent');
 }
 rig.update(2,.7);
 const weights=skins[0].geometry.getAttribute('skinWeight');
 for(let i=0;i<weights.count;i++)assert.ok(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)<1e-5);
 model.updateMatrixWorld(true);skins[0].skeleton.update();
 for(const value of skins[0].skeleton.boneMatrices!)assert.ok(Number.isFinite(value));
 assert.notEqual(skins[0].skeleton.bones[3].rotation.x,0);
 rig.update(3,0);assert.equal(skins[0].skeleton.bones[3].rotation.x,0);
 rig.dispose();rig.dispose();
});

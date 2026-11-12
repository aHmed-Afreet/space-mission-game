import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as T from "three";
import {disposeObjectResources} from "./presentation/resources";
import { attachInteriorAsset, applyInteriorPbr } from "./presentation/interiorAssets";

test("new authentic interior hardware and CC0 maps match their exact provenance and tablet budgets", () => {
  const root = "public/assets/interior/";
  const manifest = JSON.parse(readFileSync(root + "manifest.json", "utf8"));
  assert.equal(manifest.models.length, 5);
  assert.equal(manifest.textures.length, 7);
  let total = 0;
  for (const item of [...manifest.models, ...manifest.textures]) {
    const filename = item.file || item.key + ".glb", bytes = readFileSync(root + filename);
    total += bytes.length;
    assert.equal(bytes.length, item.runtimeBytes, filename);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), item.runtimeSha256, filename);
    if (item.file) {
      assert.equal(item.license, "CC0-1.0");
      assert.deepEqual(item.dimensions, [1024, 1024]);
    } else {
      assert.match(item.sourceUrl, /^https:\/\/raw\.githubusercontent\.com\/nasa\/NASA-3D-Resources\/11ebb4ee/);
      const jsonLength = bytes.readUInt32LE(12), gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
      assert.equal(gltf.asset.version, "2.0");
      assert.ok(!gltf.buffers.some((buffer: {uri?: string}) => buffer.uri), "self-contained geometry");
      assert.ok(!gltf.images?.some((image: {uri?: string}) => image.uri), "self-contained images");
      assert.ok(item.runtimePrimitives <= 6 && item.runtimeTriangles < 30000);
    }
  }
  assert.ok(total < 3_000_000, "hardware plus PBR maps stay below 3MB transfer");
});

test("interior decoration construction stays offline in Node and preserves ownership/coordinates", () => {
  const owner = new T.Group();
  const asset = attachInteriorAsset(owner, "mission-shell", {extent: 1, preserveCoordinates: true, position: [1,2,3]});
  assert.equal(owner.children[0], asset.root);
  assert.deepEqual(asset.root.position.toArray(), [1,2,3]);
  const maps = applyInteriorPbr(owner);
  assert.doesNotThrow(() => { maps.dispose(); maps.dispose(); asset.dispose(); asset.dispose(); });
  assert.equal(owner.children.length, 0);
});

test("authored pressure shell and purpose-built workstations retain semantic PBR names within the mobile geometry budget", () => {
  const root = "public/assets/interior/";
  const manifest = JSON.parse(readFileSync(root + "manifest.json", "utf8"));
  assert.deepEqual(manifest.authoredModels.map((item: {key: string}) => item.key), ["mission-shell", "mission-workstations"]);
  let bytesTotal = 0, trianglesTotal = 0;
  for (const item of manifest.authoredModels) {
    const bytes = readFileSync(root + item.key + ".glb");
    bytesTotal += bytes.length; trianglesTotal += item.runtimeTriangles;
    assert.equal(createHash("sha256").update(bytes).digest("hex"), item.runtimeSha256);
    const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    assert.match(item.authorship, /Original ORBITAL/);
    assert.equal(gltf.asset.version, "2.0");
    assert.ok(item.runtimePrimitives <= 12);
    for(const mesh of gltf.meshes)for(const primitive of mesh.primitives){
      const name=gltf.materials[primitive.material]?.name||"";
      if(/^(paint|fabric|rubber|metal|foil)/.test(name))assert.ok(primitive.attributes.TEXCOORD_0!==undefined,item.key+" / "+name+" must retain UVs for runtime PBR maps");
    }
    assert.ok(gltf.materials.every((material: {name: string}) => /^(paint|fabric|rubber|metal|light|glass|foil) \//.test(material.name)), "compression preserves authored PBR routing names");
    assert.ok(gltf.extensionsRequired.includes("KHR_draco_mesh_compression"));
  }
  assert.ok(bytesTotal < 750_000);
  assert.ok(trianglesTotal < 130_000);
});


test("original quilted liner maps retain their source provenance and bounded texture size",()=>{
 const root="public/assets/interior/",manifest=JSON.parse(readFileSync(root+"manifest.json","utf8"));
 assert.equal(manifest.authoredTextures.length,2);
 for(const item of manifest.authoredTextures){const bytes=readFileSync(root+item.file);assert.equal(bytes.length,item.runtimeBytes);assert.equal(createHash("sha256").update(bytes).digest("hex"),item.runtimeSha256);assert.deepEqual(item.dimensions,[512,512]);assert.match(item.source,/CC0-1.0/);assert.ok(bytes.length<300000);}
});


test("interior PBR ownership releases maps once and late downloads cannot invalidate a disposed cabin",()=>{
 const oldWindow=globalThis.window,oldDocument=globalThis.document,load=T.TextureLoader.prototype.load;
 const requested:{texture:T.Texture<HTMLImageElement>;onLoad?:((texture:T.Texture<HTMLImageElement>)=>void)}[]=[];
 globalThis.window={} as Window&typeof globalThis;globalThis.document={}as Document;
 T.TextureLoader.prototype.load=function(_url,onLoad){const texture=new T.Texture<HTMLImageElement>();requested.push({texture,onLoad});return texture;};
 try{
  const root=new T.Group(),material=new T.MeshStandardMaterial({name:"fabric / ivory liner"});root.add(new T.Mesh(new T.PlaneGeometry(),material));
  let changed=0,released=0;const finish=applyInteriorPbr(root,"balanced",()=>changed++);
  assert.equal(requested.length,3);assert.ok(material.map&&material.normalMap&&material.roughnessMap);
  for(const entry of requested)entry.texture.addEventListener("dispose",()=>released++);
  requested[0].onLoad?.(requested[0].texture);assert.equal(changed,1);
  finish.dispose();finish.dispose();disposeObjectResources(root);assert.equal(released,3);
  const late=new T.Texture<HTMLImageElement>();let lateReleased=0;late.addEventListener("dispose",()=>lateReleased++);requested[1].onLoad?.(late);
  assert.equal(changed,1);assert.equal(lateReleased,1);
 }finally{T.TextureLoader.prototype.load=load;if(oldWindow===undefined)delete(globalThis as {window?:unknown}).window;else globalThis.window=oldWindow;if(oldDocument===undefined)delete(globalThis as {document?:unknown}).document;else globalThis.document=oldDocument;}
});


test("Battery and Balanced model variants preserve UVs and reduce vertex work without changing their material contract",()=>{
 const root="public/assets/interior/",manifest=JSON.parse(readFileSync(root+"manifest.json","utf8"));
 for(const model of manifest.authoredModels){const lod=model.balancedVariant,bytes=readFileSync(root+lod.file),gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  assert.equal(bytes.length,lod.runtimeBytes);assert.equal(createHash("sha256").update(bytes).digest("hex"),lod.runtimeSha256);assert.ok(lod.runtimeTriangles<model.runtimeTriangles);
  assert.match(lod.modifications,/borders locked/);
  for(const mesh of gltf.meshes)for(const primitive of mesh.primitives)if(/^(paint|fabric|rubber|metal|foil)/.test(gltf.materials[primitive.material].name))assert.ok(primitive.attributes.TEXCOORD_0!==undefined);
 }
});

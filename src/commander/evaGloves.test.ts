import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { createEvaGloves, type GloveQuality } from "../presentation/evaGloves";

function meshes(group:T.Object3D) {
  const found:T.Mesh[]=[]; group.traverse(object=>{if(object instanceof T.Mesh)found.push(object);});return found;
}
function partBounds(hand:T.Object3D,name:string) {
  const box=new T.Box3();let vertices=0;
  for(const mesh of meshes(hand)) {
    const range=mesh.geometry.userData.parts.find((part:{name:string})=>part.name===name);
    if(!range)continue;
    const positions=mesh.geometry.getAttribute("position");
    for(let i=range.first;i<range.first+range.count;i++){box.expandByPoint(new T.Vector3().fromBufferAttribute(positions,i));vertices++;}
  }
  assert.ok(vertices>0,`${name}: real merged vertices exist`);return box;
}
for(const quality of ["battery","balanced","quality"] as GloveQuality[]) {
  test(`${quality} EVA gloves have segmented fingers, opposed thumbs and a bounded smooth mesh`,()=>{
    const gloves=createEvaGloves(quality);const all=meshes(gloves.group);
    assert.equal(all.length,6,"three merged materials per hand, no per-finger draw calls");
    const triangles=all.reduce((sum,mesh)=>sum+(mesh.geometry.index?.count??mesh.geometry.getAttribute("position").count)/3,0);
    assert.ok(triangles<(quality==="battery"?4000:8000),`${quality}: ${triangles} constructed triangles`);
    assert.equal(new Set(all.map(mesh=>mesh.material)).size,3,"pair shares three materials");
    for(const [index,hand] of gloves.group.children.entries()) {
      const side=index===0?-1:1;
      const palm=partBounds(hand,"palm pressure bladder");
      assert.ok(palm.max.z-palm.min.z>.18,"rounded palm is volumetric, not a flat decal");
      const knuckles:number[]=[];
      for(const finger of ["index","middle","ring","little"]) {
        const proximal=partBounds(hand,`${finger} proximal`),distal=partBounds(hand,`${finger} distal`);
        assert.ok(distal.min.z<proximal.min.z,"each finger extends toward its tip");
        assert.ok(distal.min.y<proximal.min.y,"distal segment curves down naturally");
        assert.ok(distal.max.x-distal.min.x>.02,"finger has real rounded thickness");
        knuckles.push(proximal.getCenter(new T.Vector3()).x*side);
        partBounds(hand,`${finger} fingertip pad`);partBounds(hand,`${finger} joint seam`);
      }
      assert.ok(knuckles.every((x,i)=>i===0||x>knuckles[i-1]),"four separate fingers in anatomical order");
      const thumb=partBounds(hand,"opposed thumb distal").getCenter(new T.Vector3());
      assert.ok(thumb.x*side<knuckles[0]-.04,"thumb opposes inward, rather than forming a fifth parallel finger");
      partBounds(hand,"rounded pressure sleeve");
      for(let ring=1;ring<=3;ring++)partBounds(hand,`wrist restraint ${ring}`);
      const bound=new T.Box3().setFromObject(hand);
      assert.ok(side<0?bound.max.x<-.18:bound.min.x>.18,"central workpoint remains clear");
      assert.ok(bound.max.y<-.36,"hardware stays below the centre of the camera");
      assert.ok(bound.min.z> -1.18&&bound.max.z<-.25,"no near-plane intersection or excessive reach");
    }
    for(const mesh of all){
      const normal=mesh.geometry.getAttribute("normal");
      for(let i=0;i<normal.count;i++)assert.ok(Math.abs(new T.Vector3().fromBufferAttribute(normal,i).length()-1)<1e-5,"merged surface normals stay normalized");
    }
    gloves.dispose();
  });
  test(`${quality} EVA gloves leave central camera rays clear while remaining visible`,()=>{
    const gloves=createEvaGloves(quality);gloves.group.updateMatrixWorld(true);
    const ray=new T.Raycaster();
    for(const x of [-.15,0,.15])for(const y of [-.12,0,.12]) {
      ray.set(new T.Vector3(),new T.Vector3(x,y,-1).normalize());
      assert.equal(ray.intersectObject(gloves.group,true).length,0,"centre aiming and instrument view are not covered");
    }
    for(const side of [-1,1]){
      ray.set(new T.Vector3(),new T.Vector3(side*.34,-.432,-.938).normalize());
      assert.ok(ray.intersectObject(gloves.group,true).length>0,"actual lower-corner glove geometry is visible to the camera");
    }
    const left=new T.Box3().setFromObject(gloves.group.children[0]),right=new T.Box3().setFromObject(gloves.group.children[1]);
    assert.ok(Math.abs(left.min.x+right.max.x)<.003&&Math.abs(left.max.x+right.min.x)<.003,"hand placements and silhouettes mirror");
    gloves.dispose();
  });
}
test("EVA glove cleanup releases shared resources exactly once and leaves independent scenes intact",()=>{
  const first=createEvaGloves("battery"),other=createEvaGloves("battery"),parent=new T.Group();
  parent.add(first.group);
  const all=meshes(first.group),geometries=new Set(all.map(mesh=>mesh.geometry)),materials=new Set(all.flatMap(mesh=>Array.isArray(mesh.material)?mesh.material:[mesh.material]));
  const calls=new Map<T.EventDispatcher,number>();
  for(const resource of [...geometries,...materials]){calls.set(resource,0);resource.addEventListener("dispose",()=>calls.set(resource,calls.get(resource)!+1));}
  const untouched=meshes(other.group).map(mesh=>Array.from(mesh.geometry.getAttribute("position").array));
  first.dispose();first.dispose();
  assert.equal(parent.children.length,0);assert.ok(first.group.userData.resourcesDisposed);
  assert.ok([...calls.values()].every(count=>count===1),"six geometries and three shared materials each dispose once");
  assert.deepEqual(meshes(other.group).map(mesh=>Array.from(mesh.geometry.getAttribute("position").array)),untouched,"constructing/disposal never mutates another scene's presentation");
  assert.ok(meshes(other.group).every(mesh=>!mesh.userData.disposed));other.dispose();
});

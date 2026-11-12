import * as T from "three";
import {mergeGeometries} from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** For explicitly static, noninteractive scenery roots only. Transparent panels,
 * instanced details, skins and material arrays retain their original draw/order.
 * Never pass a root containing moving doors, hands, or interaction targets. */
export function batchStaticVisuals(root:T.Group, excluded:readonly T.Object3D[]=[]){
  root.updateMatrixWorld(true);
  const inverse=root.matrixWorld.clone().invert();
  const batches=new Map<T.Material,T.Mesh[]>();
  const moving=new Set(excluded);
  const visit=(object:T.Object3D)=>{
    if(moving.has(object)||object.userData.dynamicVisual||!object.visible)return;
    if(object instanceof T.Mesh&&!(object instanceof T.InstancedMesh)&&!(object instanceof T.SkinnedMesh)&&!Array.isArray(object.material)&&!object.material.transparent&&!object.children.length){
      const list=batches.get(object.material)??[];list.push(object);batches.set(object.material,list);
    }
    object.children.forEach(visit);
  };
  visit(root);
  const owned:T.BufferGeometry[]=[];
  let before=0,after=0;
  for(const [material,meshes] of batches){
    before+=meshes.length;
    if(meshes.length<2){after+=meshes.length;continue;}
    const copies=meshes.map(mesh=>{
      const copy=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
      copy.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld));return copy;
    });
    const merged=mergeGeometries(copies,false);copies.forEach(copy=>copy.dispose());
    if(!merged){after+=meshes.length;continue;}
    merged.computeBoundingSphere();owned.push(merged);
    const mesh=new T.Mesh(merged,material);mesh.name="batched static cabin fittings";
    mesh.raycast=()=>{};root.add(mesh);meshes.forEach(source=>source.removeFromParent());after++;
  }
  root.userData.staticBatch={before,after};
  return ()=>owned.forEach(geometry=>geometry.dispose());
}

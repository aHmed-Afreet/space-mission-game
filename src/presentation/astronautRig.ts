import * as T from "three";

/** Add a compact four-limb GPU rig to the imported NASA static EVA suit.
 * The suit's source A-pose is weighted by anatomical region; this is an original
 * educational locomotion animation, not recorded astronaut motion or a NASA clip.
 * Source meshes/materials remain under the model so ordinary scene disposal owns
 * all resources. Only the new skeleton textures require explicit disposal here. */
export function rigAstronautModel(model: T.Group) {
  model.updateMatrixWorld(true);
  const inverse = model.matrixWorld.clone().invert();
  const meshes: T.Mesh[] = [];
  model.traverse(object => { if (object instanceof T.Mesh && !(object instanceof T.SkinnedMesh)) meshes.push(object); });
  const bounds = new T.Box3();
  const prepared = meshes.map(mesh => {
    const geometry = mesh.geometry.clone();
    geometry.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld));
    geometry.computeBoundingBox(); bounds.union(geometry.boundingBox!);
    return { mesh, geometry };
  });
  const height = bounds.max.y - bounds.min.y;
  if (!meshes.length || !Number.isFinite(height) || height <= 0) {
    prepared.forEach(({ geometry }) => geometry.dispose());
    return { update(_time: number, _speed: number) {}, dispose() {} };
  }
  const center = bounds.getCenter(new T.Vector3());
  const root = new T.Bone(); root.name = "eva-pelvis";
  const shoulderY = bounds.min.y + height * .765;
  const hipY = bounds.min.y + height * .46;
  const leftArm = new T.Bone(), rightArm = new T.Bone(), leftLeg = new T.Bone(), rightLeg = new T.Bone();
  leftArm.name = "eva-left-arm"; rightArm.name = "eva-right-arm";
  leftLeg.name = "eva-left-leg"; rightLeg.name = "eva-right-leg";
  leftArm.position.set(center.x + height * .155, shoulderY, center.z);
  rightArm.position.set(center.x - height * .155, shoulderY, center.z);
  leftLeg.position.set(center.x + height * .09, hipY, center.z);
  rightLeg.position.set(center.x - height * .09, hipY, center.z);
  root.add(leftArm, rightArm, leftLeg, rightLeg); model.add(root);
  model.updateMatrixWorld(true);
  const skeleton = new T.Skeleton([root, leftArm, rightArm, leftLeg, rightLeg]);
  const smooth = (a: number, b: number, x: number) => T.MathUtils.smoothstep(x, a, b);
  for (const { mesh, geometry } of prepared) {
    const positions = geometry.getAttribute("position");
    const indices = new Uint16Array(positions.count * 4), weights = new Float32Array(positions.count * 4);
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i) - center.x, y = (positions.getY(i) - bounds.min.y) / height;
      const arm = smooth(.14, .205, Math.abs(x) / height) * smooth(.43, .59, y);
      const leg = (1 - smooth(.40, .49, y)) * (1 - arm);
      indices[i * 4] = 0; indices[i * 4 + 1] = x >= 0 ? 1 : 2; indices[i * 4 + 2] = x >= 0 ? 3 : 4;
      weights[i * 4] = Math.max(0, 1 - arm - leg); weights[i * 4 + 1] = arm; weights[i * 4 + 2] = leg;
    }
    geometry.setAttribute("skinIndex", new T.Uint16BufferAttribute(indices, 4));
    geometry.setAttribute("skinWeight", new T.Float32BufferAttribute(weights, 4));
    const skinned = new T.SkinnedMesh(geometry, mesh.material);
    skinned.name = "articulated-EVA-suit"; skinned.castShadow = mesh.castShadow; skinned.receiveShadow = mesh.receiveShadow;
    skinned.raycast = () => {};
    // Animated bounds are tiny; disable static culling to avoid disappearing feet.
    skinned.frustumCulled = false;
    model.add(skinned); skinned.bind(skeleton);
    mesh.visible = false;
  }
  let disposed = false;
  return {
    update(timeSeconds: number, speed01: number) {
      if (disposed) return;
      const speed = T.MathUtils.clamp(speed01, 0, 1), step = Math.sin(timeSeconds * (3.6 + speed * 3.2));
      const breathe = Math.sin(timeSeconds * 1.3) * .012;
      leftArm.rotation.set(step * speed * .22, .04, -.75 + breathe);
      rightArm.rotation.set(-step * speed * .22, -.04, .75 - breathe);
      leftLeg.rotation.x = -step * speed * .32;
      rightLeg.rotation.x = step * speed * .32;
    },
    dispose() { if (!disposed) { disposed = true; skeleton.dispose(); } },
  };
}

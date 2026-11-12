import * as T from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createReferenceModelLoader } from "./referenceModelLoader";
import { disposeObjectResources } from "./resources";

export const interiorAssetKeys = ["crew-lock-bag", "pistol-grip-tool", "infrared-camera", "docking-system", "flight-support", "mission-shell", "mission-workstations"] as const;
export type InteriorAssetKey = typeof interiorAssetKeys[number];
export type InteriorQuality = "battery" | "balanced" | "quality";
export type InteriorAssetOptions = {
  extent: number;
  position?: readonly [number, number, number];
  rotation?: readonly [number, number, number];
  centered?: boolean;
  quality?: InteriorQuality;
  /** For authored cabin models whose coordinates already match the simulator. */
  preserveCoordinates?: boolean;
  onLoad?: (model: T.Group, gltf: GLTF) => void;
  onError?: () => void;
  onChange?: () => void;
};
const assetUrl = (name: string) => `${import.meta.env?.BASE_URL ?? "./"}assets/interior/${name}`;

/** Owned, self-hosted references. Models never alter target rays or collision
 * geometry. Late downloads are released after a scene switch, including maps. */
export function attachInteriorAsset(parent: T.Object3D, key: InteriorAssetKey, options: InteriorAssetOptions) {
  const root = new T.Group(); root.name = `interior-${key}`;
  if (options.position) root.position.fromArray(options.position);
  if (options.rotation) root.rotation.set(...options.rotation);
  parent.add(root);
  let disposed = false;
  let finish: { dispose(): void } | undefined;
  // Unit tests can construct the same cabin geometry without a browser/network.
  if (typeof window === "undefined") return { root, dispose() { disposed = true; root.removeFromParent(); } };
  const request = createReferenceModelLoader();
  const fail = () => { request.dispose(); if (!disposed) options.onError?.(); };
  try {
    const authored=key==="mission-shell"||key==="mission-workstations";
    const filename=authored&&options.quality!=="quality"?`${key}-balanced.glb`:`${key}.glb`;
    request.loader.load(assetUrl(filename), gltf => {
      request.dispose();
      if (disposed || parent.userData.disposed || parent.userData.resourcesDisposed) { disposeObjectResources(gltf.scene); return; }
      const model = gltf.scene;
      if (!options.preserveCoordinates) {
        model.updateMatrixWorld(true);
        const bounds = new T.Box3().setFromObject(model), size = bounds.getSize(new T.Vector3());
        const extent = Math.max(size.x, size.y, size.z);
        if (!Number.isFinite(extent) || extent < 1e-6) { disposeObjectResources(model); options.onError?.(); return; }
        const scale = options.extent / extent, center = bounds.getCenter(new T.Vector3());
        model.scale.multiplyScalar(scale);
        model.position.sub(new T.Vector3(center.x, options.centered ? center.y : bounds.min.y, center.z).multiplyScalar(scale));
      }
      model.traverse(object => {
        if (!(object instanceof T.Mesh)) return;
        object.raycast = () => {};
        object.castShadow = false; object.receiveShadow = false;
        for (const material of Array.isArray(object.material) ? object.material : [object.material])
          if (material instanceof T.MeshStandardMaterial) material.envMapIntensity = .45;
      });
      root.add(model);
      finish = applyInteriorPbr(model, options.quality, options.onChange);
      root.userData.assetLoaded = key;
      try { options.onLoad?.(model, gltf); options.onChange?.(); }
      catch (error) { finish.dispose(); disposeObjectResources(model); model.removeFromParent(); options.onError?.(); console.error("Interior model initialization failed", error); }
    }, undefined, fail);
  } catch { fail(); }
  return {
    root,
    dispose() {
      if (disposed) return;
      disposed = true; request.dispose(); finish?.dispose(); root.removeFromParent(); disposeObjectResources(root);
    },
  };
}

/** PBR material naming is part of the authored GLB contract: fabric*, metal*,
 * paint*, rubber* and foil*. NASA hardware retains its own source materials.
 * Maps are loaded once per owned root, shared across materials, and optional.
 * No callback can resurrect a released scene; accepted textures invalidate
 * paused views through onChange. Battery mode omits normal-map sampling. */
export function applyInteriorPbr(root: T.Object3D, quality: InteriorQuality = "balanced", onChange?: () => void) {
  if (typeof window === "undefined" || typeof document === "undefined") return { dispose() {} };
  const textures = new Map<string, T.Texture>();
  let disposed = false;
  const loader = new T.TextureLoader();
  const map = (name: string, color = false, repeat = 3) => {
    let texture = textures.get(name);
    if (texture) return texture;
    texture = loader.load(assetUrl(name), value => { if (disposed || root.userData.disposed) value.dispose(); else onChange?.(); }, undefined, () => { /* Authored material remains functional when a decorative map fails. */ });
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.repeat.set(repeat, repeat); texture.anisotropy = quality === "quality" ? 4 : quality === "battery" ? 1 : 2;
    if (color) texture.colorSpace = T.SRGBColorSpace;
    textures.set(name, texture); return texture;
  };
  const materials = new Set<T.MeshStandardMaterial>();
  root.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) if (material instanceof T.MeshStandardMaterial) materials.add(material);
  });
  for (const material of materials) {
    const kind = material.name.toLowerCase().match(/^(fabric|metal|paint|rubber|foil)/)?.[1];
    if (!kind) continue;
    material.envMapIntensity = kind === "metal" || kind === "foil" ? .5 : .25;
    if (kind === "fabric") {
      const quilted=material.name.toLowerCase().includes("liner");
      material.map = map(quilted?"quilt-base.webp":"fabric-base.webp", true); material.roughnessMap = map("fabric-roughness.webp");
      material.roughness = .92; material.metalness = 0;
      if (quality !== "battery") { material.normalMap = map(quilted?"quilt-normal.webp":"fabric-normal.webp"); material.normalScale.set(quilted ? .6 : .35,quilted ? .6 : .35); }
    } else if (kind === "rubber") {
      material.metalness = 0; material.roughness = .94;
      if (quality !== "battery") { material.normalMap = map("fabric-normal.webp"); material.normalScale.set(.08, .08); }
    } else {
      material.roughnessMap = map("metal-roughness.webp");
      if (kind === "metal") { material.map = map("metal-base.webp", true); material.metalnessMap = map("metal-metallic.webp"); material.metalness = .78; material.roughness = .56; }
      if (kind === "paint") { material.metalness = .12; material.roughness = .78; }
      if (kind === "foil") { material.metalness = .92; material.roughness = .46; }
      if (quality !== "battery") { material.normalMap = map("metal-normal.webp"); const strength = kind === "paint" ? .08 : kind === "foil" ? .32 : .18; material.normalScale.set(strength, strength); }
    }
    material.needsUpdate = true;
  }
  return { dispose() {
    if (disposed) return; disposed = true;
    // This handle owns its maps; detach them before the object owner releases
    // materials, so GLB replacement and scene disposal do not release them twice.
    const owned=new Set(textures.values());
    for(const material of materials)for(const key of Object.keys(material)){
      const record=material as unknown as Record<string,unknown>;
      if(record[key] instanceof T.Texture&&owned.has(record[key] as T.Texture))record[key]=null;
    }
    textures.forEach(texture => texture.dispose()); textures.clear();
  } };
}

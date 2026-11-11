import * as T from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createReferenceModelLoader } from "./referenceModelLoader";
import { disposeObjectResources } from "./resources";

/** Self-hosted, mobile derivatives of NASA's educational 3D resource collection.
 * These are visual references, never collision meshes or mission state. */
export const realismModelKeys = ["lander", "astronaut", "capsule", "shuttle", "station", "probe", "rover", "rocket", "habitat", "habitatInterior", "equipment", "controlRoom", "apolloSoyuz"] as const;
export type RealismModelKey = typeof realismModelKeys[number];
type ModelOptions = {
  extent: number;
  position?: readonly [number, number, number];
  rotation?: readonly [number, number, number];
  /** Centre all three axes for orbital/assembly views, otherwise stand on y=0. */
  centered?: boolean;
  shadows?: boolean;
  onLoad?: (model: T.Group, gltf: GLTF) => void;
  onError?: () => void;
};

/** A separate owned request per scene keeps cancellation and GPU disposal safe.
 * Models are Draco compressed and fetched only when this scene is entered.
 * Call dispose before disposing the parent. No shared GPU materials are retained. */
export function attachRealismModel(parent: T.Object3D, key: RealismModelKey, options: ModelOptions) {
  const root = new T.Group();
  root.name = `reference-${key}`;
  if (options.position) root.position.fromArray(options.position);
  if (options.rotation) root.rotation.set(...options.rotation);
  parent.add(root);
  // Mission architecture tests run in Node without a DOM/network runtime.
  if (typeof window === "undefined") return { root, dispose() { root.removeFromParent(); disposeObjectResources(root); } };
  const request = createReferenceModelLoader();
  let disposed = false;
  request.loader.load(`${(import.meta.env?.BASE_URL ?? "./")}assets/realism/${key}.glb`, gltf => {
    request.dispose();
    if (disposed || parent.userData.disposed) { disposeObjectResources(gltf.scene); return; }
    const model = gltf.scene;
    model.updateMatrixWorld(true);
    const bounds = new T.Box3().setFromObject(model);
    const size = bounds.getSize(new T.Vector3());
    const scale = options.extent / Math.max(size.x, size.y, size.z, 1e-5);
    const center = bounds.getCenter(new T.Vector3());
    model.scale.multiplyScalar(scale);
    model.position.sub(new T.Vector3(center.x, options.centered ? center.y : bounds.min.y, center.z).multiplyScalar(scale));
    model.traverse(object => {
      if (!(object instanceof T.Mesh)) return;
      object.castShadow = options.shadows !== false;
      object.receiveShadow = options.shadows !== false;
      // Reference geometry must not intercept the game's authored interaction rays.
      object.raycast = () => {};
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) if (material instanceof T.MeshStandardMaterial) {
        material.envMapIntensity = .75;
        material.roughness = Math.max(.26, material.roughness);
      }
    });
    root.add(model);
    root.userData.assetLoaded = key;
    try { options.onLoad?.(model, gltf); } catch {
      disposeObjectResources(root); root.clear(); options.onError?.();
    }
  }, undefined, error => {
    request.dispose();
    if (!disposed) { root.userData.assetError = String(error); console.warn(`Reference asset ${key} unavailable`, error); options.onError?.(); }
  });
  return {
    root,
    dispose() {
      if (disposed) return;
      disposed = true;
      request.dispose();
      root.removeFromParent();
      disposeObjectResources(root);
    },
  };
}

/** Terrestrial CC0 rock scan used as an artistic regolith analogue; it is not
 * lunar or Martian measured surface data. 1k maps, repeated to avoid stretched UVs. */
export function createRegolithMaterial(body: "moon" | "mars", repeat = 32, onSceneChange?: () => void): T.MeshStandardMaterial {
  if (typeof window === "undefined") return new T.MeshStandardMaterial({ color: body === "mars" ? 0xc18c68 : 0xb0b0b0, roughness: .97 });
  const loader = new T.TextureLoader();
  const maps: T.Texture[] = [];
  let disposed = false;
  const load = (name: string, color = false) => {
    const texture = loader.load(`${(import.meta.env?.BASE_URL ?? "./")}assets/realism/terrain-${name}.jpg`, loaded => {
      if (disposed) { loaded.dispose(); return; }
      loaded.needsUpdate = true; onSceneChange?.();
    });
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.repeat.set(repeat, repeat);
    if (color) texture.colorSpace = T.SRGBColorSpace;
    maps.push(texture);
    return texture;
  };
  const material = new T.MeshStandardMaterial({
    color: body === "mars" ? 0xc18c68 : 0xb0b0b0,
    map: load("base", true), normalMap: load("normal"), roughnessMap: load("roughness"),
    normalScale: new T.Vector2(.7, .7), roughness: .97, metalness: 0,
  });
  if (body === "moon") {
    material.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\n diffuseColor.rgb = vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))); ");
    };
    material.customProgramCacheKey = () => "orbital-regolith-monochrome";
  }
  material.addEventListener("dispose", () => { disposed = true; maps.forEach(map => map.dispose()); });
  return material;
}

/** Original, lightweight panel/fabric microstructure. No image downloads. */
export function createTechnicalMaterial(kind: "panel" | "fabric" | "foil", color: T.ColorRepresentation = 0xc4c7c8) {
  if (typeof document === "undefined") return new T.MeshStandardMaterial({ color, roughness: .6, metalness: kind === "fabric" ? 0 : .7 });
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#8b8b8b"; ctx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 2) {
    ctx.strokeStyle = y % 4 ? "#777" : "#a0a0a0";
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(128, y); ctx.stroke();
  }
  if (kind !== "panel") for (let x = 0; x < 128; x += kind === "fabric" ? 3 : 17) {
    ctx.strokeStyle = kind === "fabric" ? "#999" : "#555";
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + (kind === "foil" ? 14 : 0), 128); ctx.stroke();
  }
  const bump = new T.CanvasTexture(canvas); bump.wrapS = bump.wrapT = T.RepeatWrapping; bump.repeat.set(3, 3);
  const material = new T.MeshStandardMaterial({ color, bumpMap: bump, bumpScale: kind === "foil" ? .018 : .004,
    metalness: kind === "fabric" ? .05 : .7, roughness: kind === "fabric" ? .92 : kind === "foil" ? .34 : .48 });
  material.addEventListener("dispose", () => bump.dispose());
  return material;
}

export { rigAstronautModel } from "./astronautRig";

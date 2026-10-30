import * as T from "three";

/** Dispose each GPU resource once, including lines and maps outside `map`.
 * Mark every descendant before release so late texture callbacks can refuse it. */
export function disposeObjectResources(root: T.Object3D): void {
  if(root.userData.resourcesDisposed)return;
  root.userData.resourcesDisposed=true;
  const geometry = new Set<T.BufferGeometry>(), materials = new Set<T.Material>(), textures = new Set<T.Texture>();
  root.traverse(object => { object.userData.disposed = true; });
  root.traverse(object => {
    const renderable = object as T.Mesh;
    if (renderable.geometry instanceof T.BufferGeometry) geometry.add(renderable.geometry);
    if (!renderable.material) return;
    for (const material of Array.isArray(renderable.material) ? renderable.material : [renderable.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof T.Texture) textures.add(value);
    }
  });
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
  for (const item of geometry) item.dispose();
}

/** A downloaded scene belongs either to its live owner or to immediate disposal.
 * This handles downloads that complete after a scene switch or fail validation. */
export function acceptDownloadedScene(owner: T.Object3D, downloaded: T.Object3D, valid = true): boolean {
  if (owner.userData.disposed || !valid) { disposeObjectResources(downloaded); return false; }
  return true;
}

import * as T from "three";

type Quality = "quality" | "balanced" | "battery";

/** Curved load-bearing pressure frames and a low-resolution area-light reflection
 * field. This is cabin illumination, not an exterior sky or extra realtime lights.
 * The camera aisle, hatch planes and interactive equipment remain unchanged. */
export function installPressureCabin(scene: T.Scene, quality: Quality) {
  const root = new T.Group();
  root.name = "Continuous pressure frames and cabin optical finishes";
  scene.add(root);
  const geometry: T.BufferGeometry[] = [];
  const materials: T.Material[] = [];
  const textures: T.Texture[] = [];
  const previousEnvironment = scene.environment;
  const previousIntensity = scene.environmentIntensity;
  const canvas = document.createElement("canvas");
  canvas.width = quality === "battery" ? 256 : 512;
  canvas.height = canvas.width / 2;
  const ctx = canvas.getContext("2d");
  if (ctx && quality === "quality") {
    // Broad white practical lamps create soft readable specular reflections on
    // metal. A dark lower hemisphere grounds the cabin without neon rim lights.
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#b8c3ca");
    gradient.addColorStop(.32, "#63676a");
    gradient.addColorStop(.52, "#333c43");
    gradient.addColorStop(1, "#090e13");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f3eee0";
    for (const fraction of [.08, .33, .58, .83])
      ctx.fillRect(canvas.width * fraction, canvas.height * .22, canvas.width * .105, canvas.height * .07);
    const environment = new T.CanvasTexture(canvas);
    environment.colorSpace = T.SRGBColorSpace;
    environment.mapping = T.EquirectangularReflectionMapping;
    textures.push(environment);
    scene.environment = environment;
    scene.environmentIntensity = .48;
  }

  const aluminum = new T.MeshStandardMaterial({color: "#c0c5c2", metalness: .72, roughness: .38});
  const gasket = new T.MeshStandardMaterial({color: "#282c2c", metalness: .05, roughness: .91});
  materials.push(aluminum, gasket);
  // Real continuous rounded frame profile: the cabin reads as a pressure hull,
  // with load paths turning through the shoulders instead of terminating boxes.
  const points = [
    [-3.07, .15], [-3.07, 1.95], [-3.02, 2.28], [-2.87, 2.53],
    [-2.59, 2.68], [-2.2, 2.72], [0, 2.72], [2.2, 2.72],
    [2.59, 2.68], [2.87, 2.53], [3.02, 2.28], [3.07, 1.95], [3.07, .15],
  ];
  const curve = new T.CatmullRomCurve3(points.map(([x, y]) => new T.Vector3(x, y, 0)), false, "centripetal");
  const frame = new T.TubeGeometry(curve, quality === "battery" ? 28 : 56, .044, quality === "battery" ? 5 : 8, false);
  const seal = new T.TubeGeometry(curve, quality === "battery" ? 28 : 56, .058, 5, false);
  geometry.push(frame, seal);
  const locations = [-7.35, -5.8, -2.75, .75, 4.9, 7.35];
  const backing = new T.InstancedMesh(seal, gasket, locations.length);
  const ribs = new T.InstancedMesh(frame, aluminum, locations.length);
  const transform = new T.Object3D();
  locations.forEach((z, index) => {
    transform.position.z = z - .038; transform.updateMatrix();
    backing.setMatrixAt(index, transform.matrix);
    transform.position.z = z; transform.updateMatrix();
    ribs.setMatrixAt(index, transform.matrix);
  });
  root.add(backing, ribs);

  // Soft contact occlusion is static and costs no shadow pass on mobile GPUs.
  const contact = document.createElement("canvas");
  contact.width = 64; contact.height = 64;
  const cctx = contact.getContext("2d");
  if (cctx && typeof cctx.createRadialGradient === "function") {
    const fade = cctx.createRadialGradient(32, 32, 4, 32, 32, 32);
    fade.addColorStop(0, "rgba(0,0,0,.5)"); fade.addColorStop(1, "rgba(0,0,0,0)");
    cctx.fillStyle = fade; cctx.fillRect(0, 0, 64, 64);
    const texture = new T.CanvasTexture(contact); textures.push(texture);
    const shadow = new T.MeshBasicMaterial({map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1});
    materials.push(shadow);
    const plane = new T.PlaneGeometry(1, 1); geometry.push(plane);
    const placements = [[-.8,-5.2,1.1,1.3],[.8,-5.2,1.1,1.3],[-2.2,-3.1,2,.95],[2.2,-3.1,2,.95],[-2.2,.45,2,.95],[2.2,.45,2,.95],[-2.2,4.4,2,1.5],[2.2,4.4,2,.95]];
    const mesh = new T.InstancedMesh(plane, shadow, placements.length);
    placements.forEach(([x,z,w,d], index) => {
      transform.rotation.set(-Math.PI / 2, 0, 0);
      transform.position.set(x, .039, z); transform.scale.set(w, d, 1);
      transform.updateMatrix(); mesh.setMatrixAt(index, transform.matrix);
    });
    root.add(mesh);
  }
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    if (scene.environment === textures[0]) {
      scene.environment = previousEnvironment;
      scene.environmentIntensity = previousIntensity;
    }
    root.traverse(object => { if (object instanceof T.InstancedMesh) object.dispose(); });
    root.removeFromParent();
    geometry.forEach(item => item.dispose());
    materials.forEach(item => item.dispose());
    textures.forEach(item => item.dispose());
  };
}

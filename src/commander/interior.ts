import type { ShipState } from "./campaign/ship";
import {makePlanet,planetKind,disposePlanet} from "./celestial";
import {installShipArchitecture} from "./shipArchitecture";
import * as T from "three";
import { createDisplays, type Telemetry } from "./displays";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { deck, type Position } from "./layout";
import type { Action, Area } from "./simulation";
export type VisualAction = { id: number; action: Action };
/** Shared primitive geometry and instanced static fittings keep the cabin inexpensive. */
export function createInterior(
  options: { eva?: boolean; destination?: string; graphics?: "quality" | "balanced" | "battery" } = {},
) {
  const scene = new T.Scene();
  scene.background = new T.Color("#070c15");
  // A cabin is pressurized and clear: previous distance fog washed out the 3D geometry.
  scene.fog = null;
  const geometries: T.BufferGeometry[] = [],
    materials: T.Material[] = [],
    textures: T.Texture[] = [];
  const box = new RoundedBoxGeometry(1, 1, 1, 1, 0.035),
    cylinder = new T.CylinderGeometry(1, 1, 1, 12),
    sphere = new T.SphereGeometry(1, 20, 12),
    plane = new T.PlaneGeometry(1, 1);
  geometries.push(box, cylinder, sphere, plane);
  const mat = (color: string, metal = 0.2, rough = 0.6, emissive?: string) => {
    const m = new T.MeshStandardMaterial({
      color,
      metalness: metal,
      roughness: rough,
      emissive: emissive || "#000000",
      emissiveIntensity: emissive ? 0.6 : 0,
    });
    materials.push(m);
    return m;
  };
  const shell = mat("#2c3844", 0.56, 0.39),
    panel = mat("#526574", 0.44, 0.42),
    dark = mat("#101b27", 0.24, 0.56),
    floor = mat("#222e38", 0.36, 0.68),
    silver = mat("#a0b0b8", 0.72, 0.31),
    fabric = mat("#263b47", 0.05, 0.91),
    warm = mat("#b9a588", 0.2, 0.69),
    white = mat("#9caab0", 0.24, 0.55),
    glass = mat("#112b38", 0.35, 0.13),
    light = mat("#d6e4dd", 0, 0.4, "#c2d9cf"),
    amber = mat("#8c6040", 0.3, 0.5, "#c48c50"),
    mint = mat("#41716b", 0.2, 0.5, "#3f827c");
  // Quality-mode fine-grain hull microstructure. One tiny repeatable texture
  // creates subtle brushed materials, rather than expensive 4K surfaces on iPads.
  if (options.graphics === "quality") {
    const textureCanvas=document.createElement("canvas");
    textureCanvas.width=128;textureCanvas.height=128;
    const context=textureCanvas.getContext("2d");
    if(context){
      const pixels=context.createImageData(128,128);
      for(let y=0;y<128;y++)for(let x=0;x<128;x++){
        // Fine industrial horizontal brushed-grain and deterministic micro-noise.
        const grain=Math.sin(y*2.43)*15+
          (Math.sin(x*14.61+y*3.33)*Math.cos(y*6.92+x*2.67))*12;
        const grey=Math.max(50,Math.min(217,Math.round(143+grain)));
        const p=(y*128+x)*4;
        pixels.data[p]=grey;pixels.data[p+1]=grey;
        pixels.data[p+2]=grey;pixels.data[p+3]=255;
      }
      context.putImageData(pixels,0,0);
      const brushed=new T.CanvasTexture(textureCanvas);
      brushed.wrapS=T.RepeatWrapping;brushed.wrapT=T.RepeatWrapping;
      brushed.repeat.set(4,3);brushed.anisotropy=2;
      textures.push(brushed);
      for(const mat of [shell,panel,floor]){
        mat.bumpMap=brushed;mat.bumpScale=.025;mat.needsUpdate=true;
      }
    }
  }
  const batch = new Map<
    string,
    { geometry: T.BufferGeometry; material: T.Material; matrices: T.Matrix4[] }
  >();
  const dummy = new T.Object3D();
  function part(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    m: T.Material = panel,
    rotation: [number, number, number] = [0, 0, 0],
    geo: T.BufferGeometry = box,
  ) {
    dummy.position.set(x, y, z);
    dummy.rotation.set(...rotation);
    dummy.scale.set(w, h, d);
    dummy.updateMatrix();
    const key = geo.uuid + m.uuid;
    let list = batch.get(key);
    if (!list) {
      list = { geometry: geo, material: m, matrices: [] };
      batch.set(key, list);
    }
    list.matrices.push(dummy.matrix.clone());
  }
  function dynamic(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    m: T.Material,
    geo: T.BufferGeometry = box,
    parent: T.Object3D = scene,
  ) {
    const mesh = new T.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    parent.add(mesh);
    return mesh;
  }
  function pipe(
    from: T.Vector3,
    to: T.Vector3,
    r: number,
    m: T.Material = silver,
  ) {
    const mid = from.clone().add(to).multiplyScalar(0.5);
    dummy.position.copy(mid);
    dummy.quaternion.setFromUnitVectors(
      new T.Vector3(0, 1, 0),
      to.clone().sub(from).normalize(),
    );
    dummy.scale.set(r, from.distanceTo(to), r);
    dummy.updateMatrix();
    const key = cylinder.uuid + m.uuid;
    let list = batch.get(key);
    if (!list) {
      list = { geometry: cylinder, material: m, matrices: [] };
      batch.set(key, list);
    }
    list.matrices.push(dummy.matrix.clone());
  }
  glass.transparent = true;
  glass.opacity = 0.13;
  glass.depthWrite = false;
  const label = (
    text: string,
    x: number,
    y: number,
    z: number,
    w = 0.55,
    h = 0.11,
  ) => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 96;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#27323a";
    ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = "#c0cac9";
    ctx.font = "600 30px sans-serif";
    ctx.fillText(text, 18, 59);
    const tx = new T.CanvasTexture(c);
    tx.colorSpace = T.SRGBColorSpace;
    textures.push(tx);
    const m = new T.MeshBasicMaterial({ map: tx });
    materials.push(m);
    dynamic(x, y, z, w, h, 1, m, plane);
  };
  const displays = createDisplays();
  textures.push(...displays.panels.map((p) => p.texture));
  materials.push(...displays.panels.map((p) => p.material));
  function screen(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    role = 0,
  ) {
    part(x, y, z, w + 0.07, h + 0.07, 0.055, dark);
    dynamic(x, y, z + 0.031, w, h, 1, displays.panels[role].material, plane);
  }
  function console(x: number, z: number, caption: string) {
    part(x, 0.65, z, 1.64, 1.25, 0.74, dark);
    part(x, 0.13, z, 1.68, 0.16, 0.82, shell);
    part(x, 1.23, z, 1.66, 0.1, 0.85, silver);
    part(x, 1.32, z + 0.13, 1.6, 0.08, 0.5, dark, [-0.15, 0, 0]);
    for (let i = 0; i < 8; i++) {
      part(
        x - 0.64 + i * 0.18,
        1.38,
        z + 0.17,
        0.09,
        0.025,
        0.08,
        i === 2 ? amber : panel,
      );
      part(
        x - 0.64 + i * 0.18,
        1.38,
        z + 0.3,
        0.065,
        0.03,
        0.06,
        i === 3 ? mint : dark,
      );
    }
    for (let i = 0; i < 3; i++)
      part(x - 0.51 + i * 0.5, 0.61, z + 0.385, 0.39, 0.7, 0.025, panel);
    label(caption, x, 1.04, z + 0.405, 0.84, 0.12);
  }
  // Compact pressure hull with chamfered upper wall panels.
  part(0, -0.13, 0.1, 6.6, 0.25, 15.8, shell);
  part(0, 2.91, 0.1, 6.6, 0.18, 15.8, shell);
  for (let z = -7; z < 8; z += 1.25) {
    for (let x = -2.4; x < 3; x += 1.2) {
      part(x, 0.015, z, 1.16, 0.035, 1.2, floor);
      part(x, 2.805, z, 1.16, 0.055, 1.17, panel);
    }
    for (const side of [-1, 1]) {
      part(side * 3.25, 1.35, z, 0.15, 2.7, 1.22, shell);
      part(side * 3.13, 1.25, z, 0.07, 1.6, 1.12, panel);
      part(side * 2.96, 2.56, z, 0.58, 0.12, 1.2, shell, [0, 0, side * 0.75]);
      part(side * 2.67, 2.77, z, 0.33, 0.02, 0.76, light);
      part(side * 2.98, 0.18, z, 0.12, 0.025, 0.65, light);
      for (let v = 0; v < 4; v++)
        part(side * 3.075, 2.04, z - 0.35 + v * 0.12, 0.025, 0.16, 0.06, dark);
    }
  }
  for (let z = -7.5; z <= 7.5; z += 1.9) {
    part(0, 2.71, z, 5.8, 0.08, 0.1, silver);
    for (const side of [-1, 1]) {
      part(side * 3.02, 1.35, z, 0.12, 2.7, 0.1, shell);
      for (let y = 0.35; y < 2.6; y += 0.65)
        part(side * 3.1, y, z + 0.06, 0.04, 0.035, 0.025, silver);
    }
  }
  for (const side of [-1, 1]) {
    pipe(
      new T.Vector3(side * 2.95, 2.38, -7.4),
      new T.Vector3(side * 2.95, 2.38, 7.6),
      0.045,
      silver,
    );
    pipe(
      new T.Vector3(side * 2.88, 2.24, -7.4),
      new T.Vector3(side * 2.88, 2.24, 7.6),
      0.022,
      dark,
    );
    for (let z = -7; z < 8; z += 1.9) {
      part(side * 2.96, 2.32, z, 0.14, 0.2, 0.045, dark);
      pipe(
        new T.Vector3(side * 2.88, 0.9, z),
        new T.Vector3(side * 2.88, 1.3, z),
        0.025,
        silver,
      );
    }
  }
  // Functional modules separated by pressure bulkheads, not an empty open corridor.
  const hatchLeaves: T.Mesh[] = [];
  for (const z of [-4.35, -1.35, 2.35]) {
    for (const side of [-1, 1]) {
      part(side * 2.2, 1.35, z, 2.08, 2.7, 0.18, shell);
      part(side * 1.12, 1.3, z, 0.15, 2.6, 0.26, silver);
      part(side * 1.27, 1.35, z + 0.11, 0.1, 0.45, 0.035, dark);
      part(side * 1.27, 1.48, z + 0.14, 0.04, 0.1, 0.025, mint);
    }
    part(0, 2.58, z, 2.28, 0.3, 0.27, panel);
    part(0, 0.03, z, 2.25, 0.035, 0.3, silver);
    part(0, 2.43, z + 0.16, 0.6, 0.025, 0.025, light);
  }
  for (const side of [-1, 1]) {
    const m = dynamic(side * 0.53, 1.28, -4.35, 1.02, 2.5, 0.08, panel);
    hatchLeaves.push(m);
    part(side * 1.35, 2.4, -4.2, 0.12, 0.055, 0.025, amber);
  }
  // Two large lit buttons, one on each side of the moving flight-deck leaf.
  // They track the actual leaf position when it slides open.
  const doorKeyMat=mat("#e8fff3",.15,.26,"#72e8c0");
  doorKeyMat.emissiveIntensity=1.6;
  const flightDoorButtons:T.Mesh[]=[];
  for(const face of [-1,1]){
    flightDoorButtons.push(dynamic(.54,1.4,-4.35+face*.15,.29,.37,.075,doorKeyMat));
  }
  label("FLIGHT DECK / 01", 0, 2.57, -4.18, 0.78, 0.105);
  label("LIFE SUPPORT / 02", 0, 2.57, -1.18, 0.83, 0.105);
  label("HABITATION / 03", 0, 2.57, 2.52, 0.98, 0.105);
  // Aft pressure hatch, integrated hardware and emergency lamps.
  if (options.eva) {
    part(-2.07, 1.4, 7.85, 2.46, 2.9, 0.15, shell);
    part(2.07, 1.4, 7.85, 2.46, 2.9, 0.15, shell);
    part(0, 2.73, 7.85, 1.7, 0.25, 0.15, shell);
    label("AIRLOCK / EVA", 0, 2.6, 7.72, 0.55, 0.08);
  } else {
    part(0, 1.4, 7.85, 6.6, 2.9, 0.15, shell);
    part(0, 1.25, 7.72, 1.5, 2.3, 0.12, dark);
    part(0, 1.25, 7.63, 1.22, 2.05, 0.08, panel);
    // Restricted exterior bulkhead on non-EVA missions: real visible control,
    // but its button only displays why an unsuited flight cannot exit.
    part(.82,1.35,7.46,.37,.5,.085,dark);
    part(.82,1.36,7.40,.26,.28,.055,amber);
    label("EVA LOCKED", 0,2.48,7.44,.9,.15);
    dynamic(0, 1.35, 7.55, 0.24, 0.035, 0.24, silver, cylinder).rotation.x =
      Math.PI / 2;
  }
  for (const side of [-1, 1])
    part(side * 0.9, 2.5, 7.65, 0.15, 0.07, 0.04, amber);
  // Flight deck: layered console, two upholstered seats and an actual forward viewport.
  part(0, 1.03, -6.6, 3.35, 0.22, 1, dark, [-0.13, 0, 0]);
  part(0, 0.58, -6.8, 2.4, 0.85, 0.52, panel);
  screen(-0.93, 1.48, -6.78, 0.8, 0.45, 3);
  screen(0, 1.48, -6.78, 0.82, 0.45);
  screen(0.93, 1.48, -6.78, 0.8, 0.45, 2);
  for (let i = 0; i < 16; i++)
    part(
      -1.47 + i * 0.19,
      1.2,
      -6.2,
      0.08,
      0.025,
      0.07,
      i % 5 === 0 ? amber : panel,
    );
  label("FC-01 / FLIGHT CONTROL", 0, 0.97, -6.06, 0.65, 0.065);
  for (const x of [-0.8, 0.8]) {
    part(x, 0.37, -5.2, 0.56, 0.1, 0.68, dark);
    part(x, 0.51, -5.2, 0.57, 0.2, 0.61, fabric);
    part(x, 0.96, -4.91, 0.57, 0.91, 0.15, fabric, [-0.12, 0, 0]);
    part(x, 1.48, -4.84, 0.4, 0.21, 0.16, fabric);
    pipe(
      new T.Vector3(x, 0.08, -5.2),
      new T.Vector3(x, 0.32, -5.2),
      0.09,
      silver,
    );
    for (const s of [-1, 1]) {
      part(x + s * 0.35, 0.77, -5.15, 0.1, 0.09, 0.63, dark);
      part(x + s * 0.35, 0.63, -4.99, 0.05, 0.3, 0.05, silver);
    }
  }
  part(0, 2.65, -7.75, 6.5, 0.45, 0.2, shell);
  part(0, 0.75, -7.75, 6.5, 1.5, 0.2, shell);
  for (const x of [-2.85, 2.85]) part(x, 1.9, -7.75, 0.85, 1.4, 0.2, shell);
  part(0, 1.96, -7.74, 4.9, 1.34, 0.05, glass);
  for (const x of [-2.45, 0, 2.45])
    part(x, 1.96, -7.67, 0.07, 1.4, 0.13, silver);
  const spaceMat = new T.MeshBasicMaterial({ color: "#060c16" });
  materials.push(spaceMat);
  dynamic(0, 2, -17, 30, 20, 1, spaceMat, plane);
  const planet=makePlanet(planetKind(options.destination||"earth"),1.48);
  planet.position.set(1.8,1.45,-13);planet.rotation.z=.3;
  scene.add(planet);
  const starGeo = new T.BufferGeometry();
  const pts: number[] = [];
  for (let i = 0; i < 180; i++)
    pts.push(Math.sin(i * 14.35) * 12, Math.cos(i * 4.8) * 8, -16.5);
  starGeo.setAttribute("position", new T.Float32BufferAttribute(pts, 3));
  geometries.push(starGeo);
  const starMat = new T.PointsMaterial({ color: "#c5d6e7", size: 0.018 });
  materials.push(starMat);
  scene.add(new T.Points(starGeo, starMat));
  // Science laboratory, microscope, sample carousel and restrained glass enclosure.
  console(-2.2, -3.1, "SCIENCE LAB");
  screen(-2.2, 1.85, -3.36, 1.16, 0.55, 1);
  part(-2.2, 1.82, -3.43, 1.25, 0.72, 0.11, dark);
  screen(-2.2, 1.85, -3.35, 1.16, 0.55, 1);
  pipe(
    new T.Vector3(-2.67, 1.35, -3),
    new T.Vector3(-2.67, 1.78, -3),
    0.035,
    silver,
  );
  part(-2.63, 1.78, -3, 0.21, 0.07, 0.25, white);
  dynamic(-2.62, 1.65, -2.94, 0.07, 0.18, 0.07, dark, cylinder);
  for (let i = 0; i < 4; i++) {
    dynamic(-1.8 + i * 0.1, 1.46, -2.97, 0.035, 0.22, 0.035, white, cylinder);
    part(-1.8 + i * 0.1, 1.59, -2.97, 0.055, 0.025, 0.055, amber);
  }
  part(-1.66, 1.36, -2.97, 0.6, 0.08, 0.25, dark);
  // Communications rack, waveform display, receiver modules and headset on a hook.
  console(2.2, -3.1, "COMMUNICATIONS");
  screen(2.2, 1.82, -3.35, 1.1, 0.5, 2);
  for (let i = 0; i < 4; i++) {
    part(2.2, 0.35 + i * 0.2, -2.71, 1.38, 0.14, 0.055, dark);
    for (let j = 0; j < 7; j++)
      part(
        1.65 + j * 0.12,
        0.36 + i * 0.2,
        -2.67,
        0.03,
        0.035,
        0.025,
        j === 0 ? mint : panel,
      );
  }
  pipe(
    new T.Vector3(2.7, 1.4, -3.2),
    new T.Vector3(2.7, 2.1, -3.2),
    0.015,
    dark,
  );
  // Service bay: ventilated power modules, breakers and life-support tank plumbing.
  console(-2.2, 0.45, "ECLSS / POWER DISTRIBUTION");
  screen(-2.48, 1.91, 0.19, 0.58, 0.54, 3);
  for (let i = 0; i < 4; i++) {
    part(-2.8 + i * 0.39, 0.65, 0.85, 0.27, 0.76, 0.05, silver);
    for (let j = 0; j < 5; j++)
      part(-2.8 + i * 0.39, 0.39 + j * 0.12, 0.89, 0.2, 0.025, 0.02, dark);
  }
  for (let i = 0; i < 3; i++) {
    part(-1.76, 1.65 + i * 0.18, 0.24, 0.2, 0.12, 0.12, dark);
    part(-1.76, 1.65 + i * 0.18, 0.31, 0.07, 0.045, 0.05, amber);
  }
  for (const x of [-2.7, -2.22]) {
    dynamic(x, 1.8, 0.09, 0.12, 0.6, 0.12, white, cylinder);
    pipe(
      new T.Vector3(x, 2.1, 0.09),
      new T.Vector3(x, 2.31, -0.3),
      0.025,
      silver,
    );
  }
  label("O₂ / RECOVERY", -2.45, 2.25, 0.17, 0.72, 0.09);
  // Galley: enclosed food bins, dispenser niche, metal tap and bottle.
  console(2.2, 0.45, "GALLEY / FOOD & WATER");
  part(2.2, 1.94, 0.16, 1.58, 1.04, 0.34, panel);
  part(2.56, 1.88, 0.36, 0.49, 0.73, 0.04, dark);
  part(2.56, 1.49, 0.48, 0.56, 0.04, 0.35, silver);
  pipe(
    new T.Vector3(2.56, 2.09, 0.4),
    new T.Vector3(2.56, 1.93, 0.58),
    0.025,
    silver,
  );
  dynamic(2.56, 1.68, 0.5, 0.055, 0.28, 0.055, white, cylinder);
  label("H₂O / POTABLE", 2.55, 2.21, 0.35, 0.44, 0.075);
  const cabinetPivot = new T.Group();
  cabinetPivot.position.set(1.46, 1.93, 0.36);
  scene.add(cabinetPivot);
  dynamic(0.38, 0, 0, 0.74, 0.86, 0.06, panel, box, cabinetPivot);
  dynamic(0.66, 0, 0.06, 0.025, 0.23, 0.04, silver, box, cabinetPivot);
  for (let i = 0; i < 4; i++)
    part(1.68 + i * 0.12, 1.82, 0.19, 0.09, 0.25, 0.06, warm);
  // The food cupboard is stocked with secured ration packs, visible only when open.
  const mealStores=new T.Group();scene.add(mealStores);
  for(let i=0;i<6;i++){
   const ration=dynamic(1.68+(i%3)*.16,1.72+Math.floor(i/3)*.26,.11,.12,.19,.08,
    i%3===0?warm:i%3===1?white:mint,box,mealStores);
   ration.rotation.z=(i%2?-.08:.08);
   dynamic(ration.position.x,ration.position.y+.042,.16,.09,.025,.013,dark,box,mealStores);
  }
  label("MEALS / 05", 1.88, 2.26, 0.4, 0.54, 0.085);
  // Sleeping alcove: bed, cushions, restraint straps, personal recess and privacy partition.
  part(-2.2, 0.44, 4.4, 1.75, 0.6, 1.16, dark);
  part(-2.2, 0.81, 4.4, 1.65, 0.2, 1.04, fabric);
  part(-2.75, 0.95, 4.4, 0.4, 0.13, 0.78, white);
  for (const z of [4.1, 4.7]) part(-2.02, 0.93, z, 1.02, 0.025, 0.08, warm);
  part(-3.03, 1.65, 4.4, 0.06, 1.35, 1.4, panel);
  part(-2.2, 1.85, 3.91, 1.65, 0.08, 0.13, dark);
  part(-2.2, 1.8, 3.98, 1.15, 0.025, 0.03, light);
  label("CREW BERTH / 06", -2.2, 0.54, 5, 0.65, 0.11);
  part(-1.27, 1.5, 4.38, 0.05, 0.45, 1.12, fabric);
  // Repair bay: tool board, machined parts and latched storage lockers.
  console(2.2, 4.4, "EQUIPMENT STORAGE");
  part(2.2, 1.95, 4.17, 1.55, 1.05, 0.12, dark);
  for (let i = 0; i < 5; i++) {
    pipe(
      new T.Vector3(1.65 + i * 0.23, 1.59, 4.25),
      new T.Vector3(1.65 + i * 0.23, 2.13, 4.25),
      0.022,
      silver,
    );
    part(1.65 + i * 0.23, 2.16, 4.25, 0.13, 0.08, 0.05, silver);
  }
  for (let i = 0; i < 2; i++) {
    part(2.02 + i * 0.48, 1.4, 4.51, 0.37, 0.14, 0.29, warm);
    part(2.02 + i * 0.48, 1.49, 4.51, 0.3, 0.025, 0.025, dark);
  }
  for (const side of [-1, 1]) {
    part(side * 2.3, 1.1, 6.2, 1.5, 2.04, 0.55, panel);
    for (let i = 0; i < 2; i++) {
      part(side * 2.3 + (i - 0.5) * 0.68, 1.11, 6.5, 0.64, 1.88, 0.04, dark);
      part(side * 2.3 + (i - 0.5) * 0.68, 1.11, 6.53, 0.04, 0.3, 0.06, silver);
    }
    label(
      side === 1 ? "SPARES / 07" : "PERSONAL / 06",
      side * 2.3,
      2.23,
      6.51,
      0.95,
      0.105,
    );
  }
  // Rich instanced spacecraft structure and cockpit, without moving gameplay stations.
  installShipArchitecture(part,pipe,screen,label,mat,options.graphics||"balanced");
  // Interactive edges are almost invisible until in reach.
  const highlights = new Map<Area, T.MeshStandardMaterial>();
  for (const id of Object.keys(deck) as Area[]) {
    const a = deck[id];
    const m = mat("#32464a", 0.4, 0.5, "#477e78");
    m.emissiveIntensity = 0.1;
    highlights.set(id, m);
    dynamic(a.x, 1.27, a.z + 0.47, id === "cockpit" ? 3 : 1.45, 0.015, 0.02, m);
  }
  const alarmMat = mat("#3e241c", 0.2, 0.5, "#c66038");
  alarmMat.emissiveIntensity = 0.15;
  for (const z of [-4.1, 2.6])
    for (const x of [-1.2, 1.2])
      dynamic(x, 2.38, z, 0.065, 0.04, 0.06, alarmMat);
  // Ambient fill and bounded practical lights. No real-time shadows or post-processing.
  scene.add(new T.HemisphereLight("#bed7e4", "#101821", 1.35));
  const sun = new T.DirectionalLight("#d9ecfa", 1.75);
  sun.position.set(-2, 4, -10);
  scene.add(sun);
  // One bounded practical and two broad fills avoid a large per-fragment light loop.
  const practical = new T.PointLight("#c9f4fc", 12, 12, 2);
  practical.position.set(0, 2.5, 0.5);
  scene.add(practical);
  const aftFill = new T.DirectionalLight("#dfd4bd", 0.75);
  aftFill.position.set(0, 3, 8);
  scene.add(aftFill);
  // Flush all repeated fittings into instanced draw calls.
  for (const b of batch.values()) {
    const mesh = new T.InstancedMesh(b.geometry, b.material, b.matrices.length);
    b.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  }
  let lastScreen = -1,
    lastFx = 0,
    fxStart = -10,
    action: Action | undefined;
  const handGroup = new T.Group();
  handGroup.visible = false;
  const camera = new T.PerspectiveCamera(65, 1, 0.08, 60);
  // Visible white EVA sleeves and gloved hands anchor the first-person viewpoint
  // when an equipped astronaut moves outside the pressurized vehicle.
  const evaHands=new T.Group();camera.add(evaHands);evaHands.visible=false;
  const suitFabric=mat("#e1e6e2",.08,.8),suitJoint=mat("#9baab1",.3,.55),suitGlove=mat("#b3babe",.2,.6);
  for(const side of [-1,1]){
   const cuff=dynamic(side*.37,-.43,-.67,.23,.4,.47,suitFabric,box,evaHands);
   cuff.rotation.x=-.38;
   dynamic(side*.36,-.62,-.92,.21,.16,.23,suitGlove,box,evaHands);
   dynamic(side*.37,-.35,-.74,.25,.085,.28,suitJoint,box,evaHands);
  }
  camera.position.set(0, 1.63, 6.5);
  camera.rotation.order = "YXZ";
  camera.add(handGroup);
  scene.add(camera);
  const bottle = dynamic(
    0.25,
    -0.29,
    -0.58,
    0.064,
    0.29,
    0.064,
    white,
    cylinder,
    handGroup,
  );
  dynamic(0.25, -0.125, -0.58, 0.045, 0.04, 0.045, dark, cylinder, handGroup);
  const glove = dynamic(
    0.32,
    -0.43,
    -0.57,
    0.11,
    0.1,
    0.08,
    warm,
    sphere,
    handGroup,
  );
  const pack = dynamic(
    0.1,
    -0.28,
    -0.57,
    0.18,
    0.22,
    0.045,
    warm,
    box,
    handGroup,
  );
  const wrenchGroup = new T.Group();
  handGroup.add(wrenchGroup);
  dynamic(0.2, -0.3, -0.58, 0.025, 0.36, 0.02, silver, box, wrenchGroup);
  dynamic(0.2, -0.11, -0.58, 0.09, 0.07, 0.025, silver, box, wrenchGroup);
  dynamic(0.2, -0.37, -0.58, 0.04, 0.16, 0.03, dark, box, wrenchGroup);
  return {
    scene,
    camera,
    update(
      t: number,
      near: Area | undefined,
      alarm: boolean,
      fx: VisualAction | undefined,
      pos: Position,
      telemetry: Telemetry,
      target?: Area | null,
      landed = false,
      world?: ShipState,
      suited = false,
    ) {
      planet.visible = !landed;
      evaHands.visible=suited&&pos.z>10.4;
      if (fx && fx.id !== lastFx) {
        lastFx = fx.id;
        fxStart = t;
        action = fx.action;
      }
      for (const [id, m] of highlights)
        m.emissiveIntensity =
          id === near && (target === undefined || target === id) ? 0.65 : 0.08;
      alarmMat.emissiveIntensity = alarm ? 0.3 + Math.sin(t * 3) * 0.2 : 0.06;
      const open = world
        ? Number(world.doors.flight.open)
        : Math.abs(pos.z + 4.35) < 2.5
          ? 1
          : 0;
      hatchLeaves.forEach((m, i) => {
        const target = (i === 0 ? -1 : 1) * (0.53 + open * 1.05);
        m.position.x += (target - m.position.x) * 0.08;
      });
      for(const key of flightDoorButtons){
        const target=.54+open*1.05;
        key.position.x+=(target-key.position.x)*.08;
      }
      const age = t - fxStart;
      mealStores.visible=!!world?.lockers.food;
      cabinetPivot.rotation.y +=
        ((world
          ? world.lockers.food
            ? -0.9
            : 0
          : action === "takeMeal" && age < 2
            ? -0.9
            : 0) -
          cabinetPivot.rotation.y) *
        0.08;
      handGroup.visible =
        age < 1.6 &&
        ["drink", "dispenser", "eat", "takeMeal", "fill", "repair"].includes(
          action || "",
        );
      handGroup.position.y = Math.sin(Math.min(1, age / 1.6) * Math.PI) * 0.14;
      handGroup.rotation.z = Math.sin(age * 3) * 0.035;
      bottle.visible = ["drink", "dispenser", "fill"].includes(action || "");
      pack.visible = !bottle.visible && action !== "repair";
      wrenchGroup.visible = action === "repair";
      glove.visible = handGroup.visible;
      if (Math.floor(t * 1.5) !== lastScreen) {
        lastScreen = Math.floor(t * 1.5);
        displays.draw(telemetry, t, pos);
      }
    },
    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      disposePlanet(planet);
    },
  };
}

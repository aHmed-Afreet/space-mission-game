import * as T from "three";
import type { GraphicsTier, WorksiteProfile } from "./missionPresentation";
import { presentationBudgets } from "./missionPresentation";
import { disposeObjectResources } from "./resources";

/** Original educational service hardware. The survey target, repair reach and
 * collision footprint remain the simulator's existing ones. */
export function createOrbitalWorksite(profile: Exclude<WorksiteProfile, "none">, quality: GraphicsTier) {
  const group = new T.Group(); group.name = `${profile} service worksite`;
  group.userData.worksiteProfile = profile;
  const segments = presentationBudgets[quality].worksiteSegments;
  const cube = new T.BoxGeometry(1, 1, 1);
  const alloy = new T.MeshStandardMaterial({ color: "#a6afb1", metalness: .78, roughness: .34 });
  const blanket = new T.MeshStandardMaterial({ color: "#b49b61", metalness: .55, roughness: .61 });
  const white = new T.MeshStandardMaterial({ color: "#c8c7bc", metalness: .12, roughness: .76 });
  const dark = new T.MeshStandardMaterial({ color: "#101b21", metalness: .28, roughness: .82 });
  const solar = new T.MeshStandardMaterial({ color: "#183b59", metalness: .38, roughness: .4 });
  const trace = new T.MeshStandardMaterial({ color: "#678793", metalness: .72, roughness: .33 });
  const status = new T.MeshBasicMaterial({ color: "#d7a65d" });
  let serviceFace=false;
  function mesh(geometry: T.BufferGeometry, material: T.Material, x: number, y: number, z: number) {
    const object = new T.Mesh(geometry, material); object.position.set(x, y, z);object.userData.serviceFace=serviceFace;group.add(object);return object;
  }
  function box(x: number, y: number, z: number, w: number, h: number, d: number, material: T.Material) {
    const o = mesh(cube, material, x, y, z); o.scale.set(w, h, d); return o;
  }
  const tubeLength = profile === "telescope" ? 2.35 : .95;
  const radius = profile === "telescope" ? .57 : .43;
  const barrel = mesh(new T.CylinderGeometry(radius, radius, tubeLength, segments), profile === "telescope" ? alloy : blanket, 0, 1.2, tubeLength * .5 - .36);
  barrel.rotation.x = Math.PI / 2;
  for (const z of [-.36, tubeLength - .36]) mesh(new T.TorusGeometry(radius + .016, .035, 6, segments), alloy, 0, 1.2, z);
  if (profile === "telescope") {
    const aperture = mesh(new T.CylinderGeometry(radius * .9, radius * .9, .055, segments), dark, 0, 1.2, tubeLength - .31); aperture.rotation.x = Math.PI / 2;
    const door = box(0, 1.77, tubeLength - .3, radius * 1.8, .04, .8, white); door.rotation.x = -.42;
    for (const x of [-.35, .35]) box(x, 1.2, .65, .025, .9, 1.75, dark);
  }
  // White radiator, vent fins and replaceable electronics at the near service end.
  serviceFace=true;
  box(0, 1.2, -.43, .67, .73, .12, white);
  box(-.28, 1.2, -.505, .2, .47, .025, dark);
  const indicator = box(-.28, 1.37, -.527, .11, .055, .02, status);
  indicator.name = "live service status";
  for (let i = 0; i < 4; i++) box(.04 + i * .085, 1.18, -.515, .031, .45, .02, alloy);
  for (const x of [-.28, .28]) for (const y of [.92, 1.48]) box(x, y, -.53, .04, .04, .025, blanket);
  // Grab handles and attachment lugs are within the original platform envelope.
  for (const x of [-.5, .5]) {
    box(x, 1.2, -.38, .035, .65, .035, alloy);
    for (const y of [.91, 1.49]) box(x * .92, y, -.38, .1, .035, .035, alloy);
  }
  const cells: T.Matrix4[] = [], dummy = new T.Object3D();
  serviceFace=false;
  const wingLength = profile === "relay" ? 1.8 : 1.45;
  for (const side of [-1, 1]) {
    const centre = side * (.52 + wingLength / 2);
    box(centre, 1.14, .35, wingLength, .055, .92, solar);
    for (const z of [-.14, .84]) box(centre, 1.19, z, wingLength + .06, .03, .025, alloy);
    const columns = quality === "battery" ? 4 : 7;
    for (let column = 0; column < columns; column++) for (let row = 0; row < 3; row++) {
      dummy.position.set(side * (.56 + (column + .5) * wingLength / columns), 1.178, -.08 + row * .3);
      dummy.scale.set(wingLength / columns - .026, .008, .255); dummy.updateMatrix(); cells.push(dummy.matrix.clone());
    }
  }
  const array = new T.InstancedMesh(cube, trace, cells.length); cells.forEach((matrix, i) => array.setMatrixAt(i, matrix)); group.add(array);
  if (profile !== "telescope") {
    const r = profile === "relay" ? .65 : .33;
    const dish = mesh(new T.SphereGeometry(r, segments, Math.max(6, segments / 2), 0, Math.PI * 2, 0, Math.PI * .39), white, 0, 2.04, .2); dish.rotation.x = -.65;
    box(0, 1.69, .2, .055, .65, .055, alloy);
    box(0, 2.25, -.08, .025, .32, .025, alloy);
    if (profile === "relay") for (const x of [-.41, .41]) box(x, 1.72, .55, .035, .95, .035, alloy);
  }
  let disposed = false;
  return {
    group,
    update(systems: { satelliteOnline: boolean; satelliteRepaired: boolean }) {
      status.color.set(systems.satelliteOnline ? "#8cd3ad" : systems.satelliteRepaired ? "#8eb9cf" : "#d7a65d");
    },
    dispose() { if (disposed) return; disposed = true; disposeObjectResources(group); group.removeFromParent(); },
  };
}

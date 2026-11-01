import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { missions } from "./definitions";
import { createSession, emptyCamp, emptyProgress, fieldSites, makeReport, type Camp } from "./engine";
import { defaultDesign, defaultLife } from "../simulation";
import { terrainRelief } from "./surfaceScenery";
import { createFieldWorld } from "./world";

// Geometry-only fixtures. Canvas calls are retained so safety text can be
// checked; there is no WebGL renderer, completed browser mission or live image.
function withCanvas(run: () => void) {
  const previous = globalThis.document;
  globalThis.document = {
    createElement: () => {
      const text: string[] = [];
      const context = new Proxy({
        fillText: (value: string) => text.push(value),
        createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        createLinearGradient: () => ({ addColorStop() {} }),
        createRadialGradient: () => ({ addColorStop() {} }),
      } as Record<string, unknown>, { get: (target, key) => target[String(key)] ?? (() => {}) });
      return { width: 0, height: 0, text, getContext: () => context };
    },
    createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, set src(_value: string) {} }),
  } as unknown as Document;
  try { run(); } finally {
    if (previous === undefined) delete (globalThis as { document?: Document }).document;
    else globalThis.document = previous;
  }
}

function named<O extends T.Object3D>(root: T.Object3D, name: string): O {
  const object = root.getObjectByName(name);
  assert.ok(object, `${name} must be constructed offline`);
  return object as O;
}
function visible(object: T.Object3D): boolean {
  return object.visible && (!object.parent || visible(object.parent));
}
function meshes(root: T.Object3D): T.Mesh[] {
  const result: T.Mesh[] = [];
  root.traverse(object => { if (object instanceof T.Mesh) result.push(object); });
  return result;
}
function matrices(mesh: T.Mesh): T.Matrix4[] {
  if (!(mesh instanceof T.InstancedMesh)) return [mesh.matrixWorld];
  return Array.from({ length: mesh.count }, (_, i) => {
    const matrix = new T.Matrix4(); mesh.getMatrixAt(i, matrix);
    return matrix.premultiply(mesh.matrixWorld);
  });
}
function bounds(mesh: T.Mesh, matrix = mesh.matrixWorld): T.Box3 {
  mesh.geometry.computeBoundingBox();
  return mesh.geometry.boundingBox!.clone().applyMatrix4(matrix);
}
// Test actual triangles after instance/world transforms. A cable's large
// bounding box alone would incorrectly claim that the workpoint is obstructed.
function overlaps(mesh: T.Mesh, box: T.Box3): boolean {
  const position = mesh.geometry.getAttribute("position"), index = mesh.geometry.index;
  const triangle = new T.Triangle();
  for (const matrix of matrices(mesh)) {
    if (!bounds(mesh, matrix).intersectsBox(box)) continue;
    for (let i = 0; i < (index?.count ?? position.count); i += 3) {
      for (const [offset, vertex] of [[0, triangle.a], [1, triangle.b], [2, triangle.c]] as const)
        vertex.fromBufferAttribute(position, index ? index.getX(i + offset) : i + offset).applyMatrix4(matrix);
      if (box.intersectsTriangle(triangle)) return true;
    }
  }
  return false;
}
function firstHit(origin: T.Vector3, target: T.Vector3, objects: T.Mesh[]) {
  const direction = target.clone().sub(origin);
  return new T.Raycaster(origin, direction.clone().normalize(), 0, direction.length() + .01)
    .intersectObjects(objects.filter(visible), false)[0];
}
function resources(root: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>(), textures = new Set<T.Texture>();
  for (const mesh of meshes(root)) {
    geometries.add(mesh.geometry);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof T.Texture) textures.add(value);
    }
  }
  return { geometries, materials, textures };
}

const gear = ["shelter", "solar", "battery", "antenna", "storage", "sensor"] as const;
const wired = ["solar", "battery", "sensor", "antenna"] as const;
const lunarMissions = missions.filter(mission => mission.surface);
assert.deepEqual(lunarMissions.map(mission => mission.id), [3, 4, 5, 7, 9, 11].map(n => `mission-${n}`));

for (const tier of ["battery", "balanced", "quality"] as const) for (const mission of lunarMissions) {
  test(`${tier} ${mission.id}: accessible, exposed, grounded camp with bounded resources`, () => withCanvas(() => {
    // Explicit seeded unlock fixture, unrelated to native acceptance evidence.
    const progress = emptyProgress();
    const seed = createSession(missions[0], defaultDesign, defaultLife, [], progress);
    const report = makeReport(seed, true);
    progress.completed = Object.fromEntries(missions.map(m => [m.id, { ...report, missionId: m.id, success: true }]));
    const session = createSession(mission, defaultDesign, defaultLife, mission.requiredEquipment, progress);
    const definitionsBefore = structuredClone(missions), sitesBefore = structuredClone(fieldSites);
    session.camp = { ...emptyCamp(), shelter: true, solar: true, battery: true, antenna: true, storage: true, sensor: true, power: .5, science: 30 };
    const scene = new T.Scene(), world = createFieldWorld(scene, mission.destination, mission.id, tier);
    const environment = scene.children[0], camp = named<T.Group>(environment, "Unpressurized instrument camp");
    const owned = resources(environment);
    try {
      const before = structuredClone(session);
      world.update(session); scene.updateMatrixWorld(true);
      assert.deepEqual(session, before, "render updates cannot change saved/gameplay state");
      assert.deepEqual(missions, definitionsBefore); assert.deepEqual(fieldSites, sitesBefore);
      assert.deepEqual(camp.position.toArray(), [6, 0, 26], "retain the exact existing workpoint");
      assert.equal(visible(camp), true);
      const campMeshes = meshes(camp), deployed = campMeshes.filter(visible);
      const workpoint = new T.Vector3(fieldSites.camp.x, 1.63, fieldSites.camp.z);
      const clearSpace = new T.Box3(new T.Vector3(5.65, -.05, 25.65), new T.Vector3(6.35, 1.9, 26.35));
      for (const mesh of deployed) assert.equal(overlaps(mesh, clearSpace), false, `${mesh.name || mesh.type} obstructs the astronaut's work space`);
      // A suit-width approach from the ship, including the actual eye height.
      const arrival = new T.Vector3(0, 0, 10.5), approach = workpoint.clone().setY(0).sub(arrival);
      const right = new T.Vector3(approach.z, 0, -approach.x).normalize();
      for (const x of [-.3, 0, .3]) for (const y of [.25, .9, 1.63]) {
        const start = arrival.clone().addScaledVector(right, x).setY(y);
        const end = workpoint.clone().addScaledVector(right, x).setY(y);
        assert.equal(firstHit(start, end, deployed), undefined, "ship-to-workpoint approach must be clear");
      }
      const shelter = named<T.Group>(camp, "Camp shelter"), roof = named<T.Mesh>(shelter, "Camp shelter roof");
      assert.equal(bounds(named(shelter, "Camp shelter body")).containsPoint(workpoint), false);
      const roofTop = bounds(roof).max.y, ribs = named<T.InstancedMesh>(shelter, "Camp exposed roof ribs");
      assert.ok(ribs.count >= 4, "keep readable roof relief at every tier");
      for (const [i, matrix] of matrices(ribs).entries()) {
        const rib = bounds(ribs, matrix), centre = rib.getCenter(new T.Vector3());
        assert.ok(rib.min.y <= roofTop && rib.max.y >= roofTop + .025, "ribs must attach to and protrude above the real roof");
        const hit = firstHit(centre.clone().setY(roofTop + .5), centre, deployed);
        assert.equal(hit?.object, ribs); assert.equal(hit?.instanceId, i);
        const exposedTip = new T.Vector3(centre.x, rib.max.y - .001, rib.min.z + .005);
        assert.equal(firstHit(workpoint, exposedTip, deployed)?.object, ribs, "arriving astronauts see the exposed leading rib tips");
      }
      const placard = named<T.Mesh<T.PlaneGeometry, T.MeshBasicMaterial>>(camp, "Camp arrival safety placard");
      const canvas = placard.material.map!.image as { text: string[] };
      assert.ok(canvas.text.includes("UNPRESSURIZED")); assert.ok(canvas.text.includes("INSTRUMENT SHELTER"));
      const nearArrival = arrival.clone().addScaledVector(approach, .8).setY(1.63);
      for (const face of [placard, named<T.Mesh>(camp, "Camp exposed service face")]) {
        const centre = bounds(face).getCenter(new T.Vector3());
        for (const eye of [nearArrival, workpoint]) assert.equal(firstHit(eye, centre, deployed)?.object, face, `${face.name} must face arriving astronauts without occlusion`);
      }
      for (const x of [-.65, .65]) for (const y of [-.14, .14]) {
        const corner = placard.localToWorld(new T.Vector3(x, y, 0));
        for (const eye of [nearArrival, workpoint]) assert.equal(firstHit(eye, corner, deployed)?.object, placard, "the complete safety label stays readable from arrival");
      }
      // Both pad and post bottoms meet the true local terrain, with neither
      // floating nor buried feet. Check each instance rather than group bounds.
      for (const name of ["solar ground supports", "battery ground supports", "antenna ground supports", "antenna stabilizer feet", "storage ground supports", "sensor ground supports", "console ground supports", "connector ground supports"]) {
        const supports = named<T.InstancedMesh>(camp, `Camp ${name}`);
        for (const matrix of matrices(supports)) {
          const foot = bounds(supports, matrix), centre = foot.getCenter(new T.Vector3());
          assert.ok(Math.abs(foot.min.y - terrainRelief(centre.x, centre.z)) < 1e-6, `${name} foot must meet its actual generated ground`);
          assert.ok(foot.max.y > foot.min.y);
        }
      }
      const frame = named<T.InstancedMesh>(camp, "Camp exposed shelter frame");
      for (const matrix of matrices(frame).slice(0, 8)) {
        const foot = bounds(frame, matrix), centre = foot.getCenter(new T.Vector3());
        assert.ok(Math.abs(foot.min.y - terrainRelief(centre.x, centre.z)) < 1e-6, "shelter feet meet the local terrain");
      }
      const connector = named<T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>>(camp, "Camp power connector");
      assert.equal(firstHit(workpoint, bounds(connector).getCenter(new T.Vector3()), deployed)?.object, connector, "the live fault indicator is exposed to the working astronaut");
      for (const id of wired) {
        const cable = named<T.Mesh<T.TubeGeometry>>(camp, `Camp ${id} cable`), path = cable.geometry.parameters.path;
        const toWorld = (point: T.Vector3) => camp.localToWorld(point);
        assert.ok(bounds(connector).containsPoint(toWorld(path.getPoint(0))), "cable starts inside the power connector");
        assert.ok(bounds(named(camp, `Camp ${id} cable socket`)).containsPoint(toWorld(path.getPoint(1))), `${id} cable ends at a physical socket`);
        const vertices = cable.geometry.getAttribute("position");
        const { radialSegments, tubularSegments } = cable.geometry.parameters;
        for (const [ring, socket] of [[0, connector], [tubularSegments, named<T.Mesh>(camp, `Camp ${id} cable socket`)]] as const) {
          const centre = new T.Vector3();
          for (let j = 0; j < radialSegments; j++) centre.add(new T.Vector3().fromBufferAttribute(vertices, ring * (radialSegments + 1) + j));
          assert.ok(bounds(socket).containsPoint(toWorld(centre.divideScalar(radialSegments))), "constructed tube rings actually enter their sockets");
        }
        for (let i = 0; i < vertices.count; i++) {
          const point = toWorld(new T.Vector3().fromBufferAttribute(vertices, i));
          assert.ok(point.y >= terrainRelief(point.x, point.z) - .005, "constructed cable stays above the dust");
        }
        for (let i = 10; i <= 50; i++) {
          const point = toWorld(path.getPoint(i / 60));
          assert.ok(Math.abs(point.y - terrainRelief(point.x, point.z) - .025) < 1e-6, "cable mid-run follows the real dust height");
          assert.ok(Math.hypot(point.x - 6, point.z - 26) > .6, "cables stay out of the workpoint");
        }
      }
      for (const [broken, power, color] of [[false, .5, "79a88a"], [true, .5, "c56740"], [true, 0, "c56740"], [false, 0, "c79b54"]] as const) {
        session.camp = { ...session.camp, broken, power }; world.update(session);
        assert.equal(connector.material.color.getHexString(), color, "indicator must reflect the actual connector fault and energy");
      }
      const scenarios: Camp[] = [emptyCamp(), { ...emptyCamp(), shelter: true }, { ...emptyCamp(), science: 30 },
        ...gear.map(id => ({ ...emptyCamp(), [id]: true })),
        ...gear.map(id => ({ ...before.camp, [id]: false })), before.camp];
      for (const state of scenarios) {
        session.camp = state; const original = structuredClone(session); world.update(session);
        for (const id of gear) assert.equal(visible(named(camp, `Camp ${id}`)), state[id], `only deployed ${id} is visible`);
        for (const id of wired) assert.equal(visible(named(camp, `Camp ${id} cable`)), state.shelter && state[id]);
        assert.equal(visible(connector), state.shelter && (state.solar || state.battery));
        assert.equal(visible(named(camp, "Camp connector ground supports")), visible(connector));
        assert.equal(visible(named(camp, "Camp retained science indicator")), state.science > 0);
        assert.equal(visible(named(camp, "Camp service console")), state.shelter || state.science > 0);
        assert.deepEqual(session, original);
      }
      // Construction ceilings protect low-power devices from per-detail draw
      // calls and unbounded meshes/textures; these are not frame-rate claims.
      const campResources = resources(camp);
      const triangles = campMeshes.reduce((sum, mesh) => sum + (mesh.geometry.index?.count ?? mesh.geometry.getAttribute("position").count) / 3 * (mesh instanceof T.InstancedMesh ? mesh.count : 1), 0);
      assert.ok(campMeshes.length <= 50, `camp draw budget exceeded: ${campMeshes.length}`);
      assert.ok(triangles <= 4000, `camp triangle budget exceeded: ${triangles}`);
      assert.ok(campResources.geometries.size <= 10);
      assert.ok(campResources.materials.size <= 15);
      assert.equal(campResources.textures.size, 2, "share one foil map and one safety placard");
      assert.ok(campMeshes.filter(mesh => mesh instanceof T.InstancedMesh).length >= 10);
      assert.equal(campMeshes.some(mesh => mesh.castShadow), false);
      const releases = new Map<object, number>();
      const register = (resource: object) => {
        releases.set(resource, 0);
        return () => releases.set(resource, releases.get(resource)! + 1);
      };
      for (const resource of owned.geometries) resource.addEventListener("dispose", register(resource));
      for (const resource of owned.materials) resource.addEventListener("dispose", register(resource));
      for (const resource of owned.textures) resource.addEventListener("dispose", register(resource));
      for (const resource of campMeshes) if (resource instanceof T.InstancedMesh) resource.addEventListener("dispose", register(resource));
      world.dispose(); world.dispose();
      assert.equal(scene.children.length, 0);
      for (const count of releases.values()) assert.equal(count, 1, "every constructed geometry, material and texture disposes exactly once");
    } finally { world.dispose(); }
  }));
}

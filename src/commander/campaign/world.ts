import * as T from "three";
import {makePlanet,disposePlanet} from "../celestial";
import { fieldSites, type Session } from "./engine";
import { environments, type Destination } from "./environments";
/** Only the active destination is constructed. No remote models, giant textures or other worlds. */
export function createFieldWorld(scene: T.Scene, destination: Destination) {
  const env = environments[destination],
    group = new T.Group();
  scene.add(group);
  const geometries: T.BufferGeometry[] = [],
    materials: T.Material[] = [];
  const cube = new T.BoxGeometry(1, 1, 1),
    cylinder = new T.CylinderGeometry(1, 1, 1, 10),
    rock = new T.IcosahedronGeometry(1, 0);
  geometries.push(cube, cylinder, rock);
  const material = (color: string, metalness = 0.2, roughness = 0.7) => {
    const m = new T.MeshStandardMaterial({ color, metalness, roughness });
    materials.push(m);
    return m;
  };
  const alloy = material("#74848a", 0.65, 0.4),
    white = material("#a5aca8", 0.2, 0.7),
    dark = material("#23333d"),
    solar = material("#1d354a", 0.4, 0.38),
    ground = material("#726f65", 0, 0.96),
    rockMat = material("#8b877c", 0, 0.94),
    gold = material("#a18f69", 0.3, 0.7);
  function box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    m: T.Material = alloy,
    parent: T.Object3D = group,
  ) {
    const a = new T.Mesh(cube, m);
    a.position.set(x, y, z);
    a.scale.set(w, h, d);
    parent.add(a);
    return a;
  }
  function rod(
    x: number,
    y: number,
    z: number,
    r: number,
    h: number,
    m: T.Material = alloy,
  ) {
    const a = new T.Mesh(cylinder, m);
    a.position.set(x, y, z);
    a.scale.set(r, h, r);
    group.add(a);
    return a;
  }
  // A physical two-hatch airlock is attached to the existing aft opening.
  box(0, -0.08, 9, 0.1 + 1.55, 0.16, 3.3, dark);
  box(-0.84, 1.3, 9, 0.12, 2.6, 3.3, white);
  box(0.84, 1.3, 9, 0.12, 2.6, 3.3, white);
  box(0, 2.6, 9, 1.8, 0.12, 3.3, white);
  for (const z of [7.75, 10.25]) {
    box(-0.78, 1.25, z, 0.12, 2.5, 0.17, alloy);
    box(0.78, 1.25, z, 0.12, 2.5, 0.17, alloy);
  }
  const inner = box(0, 1.25, 7.75, 1.42, 2.46, 0.1, white),
    outer = box(0, 1.25, 10.25, 1.42, 2.46, 0.1, white);
  // Each pressure hatch has the same physical button inside and outside,
  // letting the player reach it after exiting the spacecraft.
  const buttons:{mesh:T.Mesh;side:"inner"|"outer"}[]=[];
  for(const [id,z] of [["inner",7.75],["outer",10.25]] as const)
   for(const face of [-1,1]){
    box(.67,1.36,z+face*.19,.26,.35,.06,dark);
    const m=material("#d2a45e",.15,.45);
    const control=box(.67,1.36,z+face*.24,.14,.19,.07,m);
    buttons.push({mesh:control,side:id});
   }
  box(0.72, 1.4, 8.8, 0.04, 0.37, 0.35, dark);
  box(0.68, 1.4, 8.8, 0.015, 0.2, 0.25, solar);
  // Exterior pressure shell and landing feet do not change the existing cabin geometry.
  box(-3.35, 1.4, 0.2, 0.2, 2.9, 15.5, white);
  box(3.35, 1.4, 0.2, 0.2, 2.9, 15.5, white);
  box(0, 3.02, 0.2, 6.9, 0.15, 15.5, white);
  for (const x of [-2.9, 2.9])
    for (const z of [-5.5, 5.5]) {
      rod(x, -0.02, z, 0.18, 0.25, alloy);
      box(x, -0.04, z, 0.75, 0.08, 0.85, dark);
    }
  for (let z = -6; z < 7; z += 2)
    for (const x of [-3.48, 3.48]) box(x, 1.4, z, 0.06, 2.5, 0.08, alloy);
  const orbitEarth=destination==="earth"?makePlanet("earth",17):null;
  if(orbitEarth){orbitEarth.position.set(-20,-12,43);group.add(orbitEarth);}
  if (destination === "earth") {
    // Zero-ground orbital EVA scene: worksite and tether points on the hull,
    // not an impossible runway floating in Earth's orbit.
    for(const x of [-2.7,2.7]){
      box(x,1.65,13,.1,.1,5.8,alloy);
      for(let z=11.5;z<17;z+=1.3)
       box(x,1.65,z,.22,.21,.28,gold);
    }
    for(let z=11.8;z<=17.1;z+=1.35)
      box(0,2.82,z,5.5,.07,.07,alloy);
    box(0,1.3,18,2.1,1.8,.58,white);
    for(let x=-.8;x<=.8;x+=.4)box(x,1.9,17.65,.18,.22,.08,solar);
  } else {
    // Low-amplitude relief avoids empty flat-colour maps while preserving a clear walking path.
    const terrain = new T.PlaneGeometry(64, 64, 38, 38);
    terrain.rotateX(-Math.PI / 2);
    const a = terrain.attributes.position;
    for (let i = 0; i < a.count; i++) {
      const x = a.getX(i),
        z = a.getZ(i) + 14;
      const h =
        (Math.sin(x * 0.38) * Math.cos(z * 0.31) +
          Math.sin(x * 0.7 + z * 0.23) * 0.4) *
        0.13;
      const path = Math.abs(x) < 2 && z < 13;
      a.setY(i, path ? -0.06 : Math.min(0.06, h) - 0.1);
    }
    terrain.computeVertexNormals();
    geometries.push(terrain);
    const mesh = new T.Mesh(terrain, ground);
    mesh.position.z = 14;
    group.add(mesh);
    const count = 95,
      rocks = new T.InstancedMesh(rock, rockMat, count),
      dummy = new T.Object3D();
    for (let i = 0; i < count; i++) {
      const x = Math.sin(i * 37.1) * 20,
        z = 12 + ((i * 7.31) % 30);
      const nearTarget = Object.values(fieldSites).some(
        (p) => Math.hypot(p.x - x, p.z - z) < 2.7,
      );
      dummy.position.set(nearTarget ? x + 3 : x, -0.08, z);
      dummy.rotation.set(i * 0.3, i * 0.9, i * 0.1);
      const size = 0.18 + (i % 5) * 0.12;
      dummy.scale.set(size, size * 0.55, size * 0.8);
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
    }
    group.add(rocks);
    const craterGeo = new T.TorusGeometry(2.3, 0.12, 5, 28);
    geometries.push(craterGeo);
    const crater = new T.Mesh(craterGeo, rockMat);
    crater.rotation.x = Math.PI / 2;
    crater.position.set(-6, -0.05, 23);
    group.add(crater);
    for (const p of Object.values(fieldSites)) {
      rod(p.x, 0.23, p.z, 0.025, 0.5, gold);
      box(p.x, 0.48, p.z, 0.27, 0.12, 0.03, gold);
    }
    const sun = new T.DirectionalLight("#fff0ce", 1.6);
    sun.position.set(-6, 12, 10);
    group.add(sun);
  }
  const satellite = new T.Group();
  satellite.position.set(2.4, 0, 15);
  group.add(satellite);
  box(0, 1.2, 0, 0.8, 0.8, 0.8, gold, satellite);
  box(0, 1.2, 0, 3.7, 0.04, 0.8, solar, satellite);
  box(0, 1.9, 0, 0.035, 0.7, 0.035, alloy, satellite);
  const dishGeometry = new T.CylinderGeometry(0.42, 0.12, 0.12, 12);
  geometries.push(dishGeometry);
  const dish = new T.Mesh(dishGeometry, white);
  dish.position.set(0, 2.2, 0);
  dish.rotation.x = 0.35;
  satellite.add(dish);
  const serviceMaterial = new T.MeshBasicMaterial({ color: "#d0a265" });
  materials.push(serviceMaterial);
  box(-0.42, 1.2, 0.2, 0.04, 0.12, 0.12, serviceMaterial, satellite);
  const camp = new T.Group();
  camp.position.set(fieldSites.camp.x, 0, fieldSites.camp.z);
  group.add(camp);
  const parts: Record<string, T.Object3D> = {};
  const shelter = new T.Group();
  camp.add(shelter);
  box(0, 0.72, 0, 2.2, 1.4, 1.6, white, shelter);
  box(0, 1.49, 0, 2.4, 0.14, 1.8, gold, shelter);
  box(0, 0.75, 1.05, 1.7, 0.1, 0.6, alloy, shelter);
  parts.shelter = shelter;
  const panels = new T.Group();
  panels.position.set(2.2, 0.5, 0);
  camp.add(panels);
  box(0, 0, 0, 1.7, 0.08, 1.2, solar, panels);
  box(0, -0.3, 0, 0.06, 0.6, 0.06, alloy, panels);
  panels.rotation.z = -0.3;
  parts.solar = panels;
  parts.battery = box(-1.6, 0.3, 0, 0.6, 0.6, 0.6, dark, camp);
  const antenna = new T.Group();
  camp.add(antenna);
  box(-1.7, 1.1, -1, 0.045, 2.2, 0.045, alloy, antenna);
  box(-1.7, 2.1, -1, 0.7, 0.25, 0.5, white, antenna);
  parts.antenna = antenna;
  parts.storage = box(0, 0.3, 1.6, 0.8, 0.6, 0.45, gold, camp);
  parts.sensor = box(1, 0.7, 1.6, 0.1, 1.4, 0.1, alloy, camp);
  const result = box(0, 0.9, 1.07, 0.45, 0.07, 0.3, solar, camp);
  return {
    update(s: Session) {
      for(const btn of buttons){
       const isOpen=btn.side==="inner"?s.airlock.inner:s.airlock.outer;
       if(btn.mesh.material instanceof T.MeshStandardMaterial)
        btn.mesh.material.color.set(isOpen?"#73e4bf":"#d3ae6c");
      }
      satellite.visible = s.missionId === "mission-2";
      serviceMaterial.color.set(
        s.systems.satelliteOnline
          ? "#a5d3ba"
          : s.systems.satelliteRepaired
            ? "#aac6d5"
            : "#d0a265",
      );
      inner.position.x +=
        ((s.airlock.inner ? -1.5 : 0) - inner.position.x) * 0.12;
      outer.position.x +=
        ((s.airlock.outer ? -1.5 : 0) - outer.position.x) * 0.12;
      for (const [id, obj] of Object.entries(parts))
        obj.visible = !!s.camp[id as keyof typeof s.camp];
      result.visible = s.camp.science > 0;
    },
    dispose() {
      scene.remove(group);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      if(orbitEarth)disposePlanet(orbitEarth);
    },
  };
}

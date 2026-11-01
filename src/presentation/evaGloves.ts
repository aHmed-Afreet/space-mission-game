import * as T from "three";
import { disposeObjectResources } from "./resources";

export type GloveQuality = "battery" | "balanced" | "quality";
type Part = { name: string; geometry: T.BufferGeometry };
type Range = { name: string; first: number; count: number };

/** Original, simplified pressure-glove geometry. These are generic training
 * gloves, not a measured reconstruction of a particular flight suit. All
 * fingers are real curved geometry; static parts merge to six draws per pair.
 * Geometry stays in the lower corners of the camera, clear of the aiming ray. */
export function createEvaGloves(quality: GloveQuality = "balanced") {
  const root = new T.Group();
  root.name = "EVA pressure gloves";
  const low = quality === "battery", radial = low ? 6 : 10, caps = low ? 2 : 3;
  const fabric = new T.MeshStandardMaterial({ color: 0xd6ddd9, roughness: .91, metalness: .015 });
  const grip = new T.MeshStandardMaterial({ color: 0x7c8c90, roughness: .86, metalness: .02 });
  const restraint = new T.MeshStandardMaterial({ color: 0x9aa8ac, roughness: .54, metalness: .48 });
  const materials = [fabric, grip, restraint];
  for (const side of [-1, 1]) {
    const hand = new T.Group(); hand.name = side < 0 ? "left pressure glove" : "right pressure glove";
    const parts: Part[][] = [[], [], []];
    const point = (x: number, y: number, z: number) => new T.Vector3(side * x, y, z);
    const add = (category: number, name: string, geometry: T.BufferGeometry, center: T.Vector3, rotation = new T.Quaternion(), scale = new T.Vector3(1,1,1)) => {
      geometry.applyMatrix4(new T.Matrix4().compose(center, rotation, scale));
      parts[category].push({ name, geometry });
    };
    const capsule = (category: number, name: string, a: T.Vector3, b: T.Vector3, radius: number) => {
      const direction = b.clone().sub(a), length = direction.length();
      add(category, name, new T.CapsuleGeometry(radius, Math.max(0, length - 2 * radius), caps, radial),
        a.clone().add(b).multiplyScalar(.5), new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0), direction.normalize()));
    };
    const ellipsoid = (category: number, name: string, center: T.Vector3, scale: T.Vector3) => {
      add(category, name, new T.SphereGeometry(1, low ? 8 : 12, low ? 5 : 7), center, new T.Quaternion(), scale);
    };
    const wrist = point(.34,-.445,-.85), sleeveStart = point(.43,-.68,-.38);
    const sleeveDirection = wrist.clone().sub(sleeveStart);
    add(0,"rounded pressure sleeve",new T.CylinderGeometry(.079,.103,sleeveDirection.length(),low ? 8 : 12,1),
      wrist.clone().add(sleeveStart).multiplyScalar(.5),new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),sleeveDirection.clone().normalize()));
    const ringRotation = new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),sleeveDirection.clone().normalize());
    for (const [index, distance] of [.005,.035,.064].entries()) {
      const center = wrist.clone().addScaledVector(sleeveDirection.clone().normalize(),-distance);
      add(index === 1 ? 2 : 1,`wrist restraint ${index + 1}`,new T.TorusGeometry(.082, index === 1 ? .009 : .004,low ? 3 : 4,low ? 12 : 16),center,ringRotation);
    }
    ellipsoid(0,"palm pressure bladder",point(.34,-.432,-.938),new T.Vector3(.075,.043,.105));
    ellipsoid(1,"palm reinforcement",point(.34,-.468,-.94),new T.Vector3(.057,.012,.077));
    for (const [index, offset] of [-.052,-.017,.018,.050].entries()) {
      const finger = ["index","middle","ring","little"][index];
      const length = [.130,.145,.135,.112][index];
      const a = point(.34 + offset,-.426,-1.006);
      const b = point(.34 + offset * 1.1,-.422,-1.006-length*.52);
      const c = point(.34 + offset * 1.13,-.452,-1.006-length);
      const radius = index === 3 ? .014 : .016;
      capsule(0,`${finger} proximal`,a,b,radius);
      capsule(0,`${finger} distal`,b,c,radius*.94);
      ellipsoid(1,`${finger} fingertip pad`,c.clone().add(new T.Vector3(0,-.009,.003)),new T.Vector3(radius*.78,.007,radius*.95));
      // A restrained dorsal joint seam reads as a flexible pressure garment.
      ellipsoid(1,`${finger} joint seam`,b.clone().add(new T.Vector3(0,.011,0)),new T.Vector3(radius*.92,.004,.006));
    }
    const thumbBase = point(.282,-.439,-.920), thumbJoint = point(.235,-.453,-.955), thumbTip = point(.221,-.470,-1.002);
    capsule(0,"opposed thumb proximal",thumbBase,thumbJoint,.023);
    capsule(0,"opposed thumb distal",thumbJoint,thumbTip,.019);
    ellipsoid(1,"thumb tip pad",thumbTip.clone().add(new T.Vector3(0,-.009,0)),new T.Vector3(.014,.008,.018));
    for (const [category, list] of parts.entries()) {
      const positions: number[] = [], normals: number[] = [], ranges: Range[] = [];
      for (const part of list) {
        const expanded = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry;
        const first = positions.length / 3;
        positions.push(...expanded.getAttribute("position").array);
        normals.push(...expanded.getAttribute("normal").array);
        ranges.push({ name: part.name, first, count: expanded.getAttribute("position").count });
        if (expanded !== part.geometry) expanded.dispose();
        part.geometry.dispose();
      }
      const geometry = new T.BufferGeometry();
      geometry.setAttribute("position",new T.Float32BufferAttribute(positions,3));
      geometry.setAttribute("normal",new T.Float32BufferAttribute(normals,3));
      geometry.userData.parts = ranges;
      geometry.computeBoundingSphere();
      const mesh = new T.Mesh(geometry,materials[category]);
      mesh.name = `${hand.name} ${["fabric","reinforcement","wrist metal"][category]}`;
      hand.add(mesh);
    }
    root.add(hand);
  }
  return { group: root, dispose() { root.removeFromParent(); disposeObjectResources(root); } };
}

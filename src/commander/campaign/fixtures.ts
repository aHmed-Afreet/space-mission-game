import * as T from "three";
import type { Session } from "./engine";
import { doors, lockers, equipmentLocker, type LockerId } from "./ship";
export function createFixtures(scene: T.Scene) {
  const root = new T.Group();
  scene.add(root);
  const geo = new T.BoxGeometry(1, 1, 1),
    extraGeometry: T.BufferGeometry[] = [],
    materials: T.Material[] = [],
    textures: T.Texture[] = [];
  const mat = (color: string) => {
    const m = new T.MeshStandardMaterial({
      color,
      metalness: 0.4,
      roughness: 0.65,
    });
    materials.push(m);
    return m;
  };
  const panel = mat("#56616b"),
    dark = mat("#18242e"),
    silver = mat("#91a1a8"),
    itemMat = mat("#b6aa8e");

  const box = (
    parent: T.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    m = panel,
  ) => {
    const o = new T.Mesh(geo, m);
    o.position.set(x, y, z);
    o.scale.set(w, h, d);
    parent.add(o);
    return o;
  };
  // Round illuminated WORK targets on actual hatch control panels.
  const buttonMaterial = new T.MeshBasicMaterial({color:"#83d6c5"});
  materials.push(buttonMaterial);
  const buttonGeometry = new T.CylinderGeometry(.065,.065,.018,20);
  extraGeometry.push(buttonGeometry);
  for (const d of Object.values(doors)) for (const x of [-.98,.98]) {
    box(root,x,1.35,d.z+.13,.2,.28,.055,dark);
    const button = new T.Mesh(buttonGeometry,buttonMaterial);
    button.rotation.x=Math.PI/2;
    button.position.set(x,1.35,d.z+.175);
    root.add(button);
  }
  const leaves: Record<string, T.Mesh[]> = {};
  for (const [id, d] of Object.entries(doors)) {
    if (id === "flight") continue;
    leaves[id] = [-1, 1].map((side) =>
      box(root, side * 0.53, 1.28, d.z, 1.02, 2.5, 0.08),
    );
  }
  const positions: Partial<Record<LockerId, [number, number, number]>> = {
    water: [2.7, 2, 0.75],
    science: [-2.45, 2, -2.7],
    samples: [-2.45, 2, -3.7],
    equipment: [2.4, 1.8, 5.7],
    eva: [2.45, 2, 3.8],
    repair: [2.45, 2, 4.8],
    emergency: [1.5, 1.8, 6.1],
    maintenance: [-2.4, 2, 0.75],
  };
  const cabinets: Partial<
    Record<LockerId, { pivot: T.Group; items: T.Mesh[] }>
  > = {};
  for (const [id, p] of Object.entries(positions)) {
    const key = id as LockerId,
      [x, y, z] = p;
    box(root, x, y, z, 0.63, 0.7, 0.24, dark);
    const pivot = new T.Group();
    pivot.position.set(x - 0.32, y, z + 0.15);
    root.add(pivot);
    box(pivot, 0.32, 0, 0, 0.63, 0.68, 0.035, panel);
    box(pivot, 0.55, 0, 0.03, 0.025, 0.2, 0.035, silver);
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 64;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#17232b";
    ctx.fillRect(0, 0, 512, 64);
    ctx.fillStyle = "#c1d4ce";
    ctx.font = "22px sans-serif";
    ctx.fillText(lockers[key].name.toUpperCase(), 12, 40);
    const texture = new T.CanvasTexture(c);
    textures.push(texture);
    const labelMat = new T.MeshBasicMaterial({ map: texture });
    materials.push(labelMat);
    const labelGeometry = new T.PlaneGeometry(0.55, 0.07);
    extraGeometry.push(labelGeometry);
    const label = new T.Mesh(labelGeometry, labelMat);
    label.position.set(0.32, 0.22, 0.024);
    pivot.add(label);
    const items = [0, 1, 2].map((i) =>
      box(
        root,
        x - 0.2 + i * 0.2,
        y - 0.13,
        z + 0.02,
        0.12,
        0.23,
        0.13,
        itemMat,
      ),
    );
    cabinets[key] = { pivot, items };
  }
  return {
    update(s: Session) {
      for (const [id, mesh] of Object.entries(leaves))
        mesh.forEach((o, i) => {
          const target =
            (i ? 1 : -1) *
            (0.53 + (s.world.doors[id as keyof typeof doors].open ? 1.05 : 0));
          o.position.x += (target - o.position.x) * 0.15;
        });
      for (const [id, c] of Object.entries(cabinets)) {
        const key = id as LockerId;
        c.pivot.rotation.y +=
          ((s.world.lockers[key] ? -1.5 : 0) - c.pivot.rotation.y) * 0.14;
        const count =
          key === "water"
            ? Math.ceil(s.state.water / 6)
            : key === "repair"
              ? s.world.partsStored +
                (s.world.stored.includes("repair") ? 1 : 0)
              : key === "samples"
                ? s.world.storedSamples.length
                : key === "eva"
                  ? s.suit.equipped
                    ? 0
                    : 1
                  : s.world.stored.filter((g) => equipmentLocker(g) === key)
                      .length;
        c.items.forEach(
          (o, i) => (o.visible = s.world.lockers[key] && i < count),
        );
      }
    },
    dispose() {
      scene.remove(root);
      geo.dispose();
      extraGeometry.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}

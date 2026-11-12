import * as T from "three";
import {createStowageFabrication} from "../stowageFabrication";
import type { Session } from "./engine";
import { doors, lockers, equipmentLocker, type LockerId } from "./ship";
import { sectionDoorLeafX, sectionDoorOpenFraction } from "../doorMotion";
export function createFixtures(scene: T.Scene, onSceneChange:()=>void=()=>{}) {
  const root = new T.Group();
  root.name="Mission interior interactive fixtures";
  scene.add(root);
  const fabrication=createStowageFabrication(root,onSceneChange);
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
  const panel = mat("#c6c9c2"), dark = mat("#293238");

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
  const buttonGeometry = new T.CylinderGeometry(.065,.065,.018,20);
  extraGeometry.push(buttonGeometry);
  // Physical electronic hatch buttons are reachable from BOTH bulkhead faces.
  const hatchButtons:{mesh:T.Mesh;id:keyof typeof doors}[]=[];
  for (const [id,d] of Object.entries(doors) as [keyof typeof doors,{name:string;z:number}][])
   for (const side of [-1,1])for (const face of [-1,1]){
    box(root,side*.98,1.35,d.z+face*.19,.24,.32,.05,dark);
    const m=new T.MeshBasicMaterial({color:0xe4ad6a});
    materials.push(m);
    const button=new T.Mesh(buttonGeometry,m);button.rotation.x=Math.PI/2;
    button.position.set(side*.98,1.35,d.z+face*.232);root.add(button);
    hatchButtons.push({mesh:button,id});
   }
  // Large illuminated panels physically attached to each moving hatch.
  const hatchPlate=mat("#142b35"),hatchGreen=new T.MeshStandardMaterial({
    color:"#c1d5c7",emissive:"#688777",emissiveIntensity:.25,metalness:.2,roughness:.24
  });
  materials.push(hatchGreen);
  const leafSwitches:{door:keyof typeof doors;plate:T.Mesh;key:T.Mesh}[]=[];
  for(const [id,d] of Object.entries(doors) as [keyof typeof doors,{name:string;z:number}][])
    for(const face of [-1,1]){
      const plate=box(root,.54,1.38,d.z+face*.12,.43,.55,.08,hatchPlate);
      const key=box(root,.54,1.4,d.z+face*.19,.26,.3,.055,hatchGreen);
      leafSwitches.push({door:id,plate,key});
    }
  const leaves: Record<string, T.Mesh[]> = {};
  for (const [id, d] of Object.entries(doors)) {
    if (id === "flight") continue;
    leaves[id] = [-1, 1].map((side) =>
      fabrication.hatchLeaf(root, side * 0.53, 1.28, d.z, id, side),
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
  const cabinets: Partial<Record<LockerId, { pivot: T.Group; items: T.Object3D[]; empty: T.Mesh }>> = {};
  for (const [id, p] of Object.entries(positions)) {
    const key = id as LockerId,
      [x, y, z] = p;
    const installation=fabrication.cabinet(key,lockers[key].name,[x,y,z]);
    const {pivot,items,anchor}=installation;
    // A clearly readable empty stowage plaque is better than a black hole:
    // it never implies gear exists when the mission manifest says otherwise.
    const marker=document.createElement("canvas");marker.width=512;marker.height=90;
    const ctx2=marker.getContext("2d")!;
    ctx2.fillStyle="#183039";ctx2.fillRect(0,0,512,90);
    ctx2.strokeStyle="#b0c6bd";ctx2.lineWidth=3;ctx2.strokeRect(3,3,506,84);
    ctx2.fillStyle="#d8e6df";ctx2.font="bold 31px sans-serif";
    ctx2.textAlign="center";ctx2.fillText("COMPARTMENT EMPTY",256,58);
    const map2=new T.CanvasTexture(marker);textures.push(map2);
    const m2=new T.MeshBasicMaterial({map:map2,side:T.DoubleSide});materials.push(m2);
    const plaque=new T.Mesh(new T.PlaneGeometry(.73,.13),m2);
    extraGeometry.push(plaque.geometry);
    plaque.name=`stowage-empty-${key}`;
    plaque.position.copy(installation.plaquePosition);anchor.add(plaque);plaque.visible=false;
    cabinets[key] = { pivot, items, empty:plaque };
  }
  fabrication.finish();
  return {
    update(s: Session) {
      // Same wall-clock time as door.readyAt and the gameplay crossing rule.
      const nowMs=Date.now();
      for(const {mesh,id} of hatchButtons)
       if(mesh.material instanceof T.MeshBasicMaterial)
        mesh.material.color.set(s.world.doors[id].open?"#70e7c8":"#e5b36f");
      for(const control of leafSwitches){
        const door=s.world.doors[control.door];
        const x=.54+sectionDoorOpenFraction(door.open,door.readyAt,nowMs)*1.05;
        control.plate.position.x=x;
        control.key.position.x=x;
      }
      for (const [id, mesh] of Object.entries(leaves))
        mesh.forEach((o, i) => {
          const gate=s.world.doors[id as keyof typeof doors];
          o.position.x=sectionDoorLeafX(gate.open,i?1:-1,gate.readyAt,nowMs);
        });
      for (const [id, c] of Object.entries(cabinets)) {
        const key = id as LockerId;
        c.pivot.rotation.y +=
          ((s.world.lockers[key] ? -1.5 : 0) - c.pivot.rotation.y) * 0.14;
        const count =
          key === "water"
            ? Math.ceil(s.state.water / 6)
            : key === "food"
              ? Math.ceil(s.state.food / 3)
              : key === "emergency"
                ? 2
                : key === "maintenance"
                  ? 2
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
        c.items.forEach((o,i)=>{
          o.visible=(key === "eva" || s.world.lockers[key]) && i < count;
          if(o.visible)o.userData.loadStowageVisual?.();
        });
        c.empty.visible=s.world.lockers[key]&&count<=0;
      }
    },
    dispose() {
      fabrication.dispose();
      scene.remove(root);
      geo.dispose();
      extraGeometry.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}

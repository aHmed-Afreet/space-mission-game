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
    itemMat = mat("#b6aa8e"),
    oxygenWhite=mat("#d6e1e0"), waterBlue=mat("#3a9bbc"),
    suitGold=mat("#c4a867"), toolSteel=mat("#97a9ae"),
    firstAid=mat("#a1cbd0"), sampleRock=mat("#787875");
  const round=new T.CylinderGeometry(1,1,1,12);
  extraGeometry.push(round);
  const cyl=(parent:T.Object3D,x:number,y:number,z:number,r:number,height:number,m:T.Material)=>{
    const obj=new T.Mesh(round,m);obj.position.set(x,y,z);
    obj.scale.set(r,height,r);parent.add(obj);return obj;
  };

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
  const cabinets: Partial<Record<LockerId, { pivot: T.Group; items: T.Object3D[]; empty: T.Mesh }>> = {};
  for (const [id, p] of Object.entries(positions)) {
    const key = id as LockerId,
      [x, y, z] = p;
    // A hollow stowage compartment: the previous SOLID cuboid blocked every
    // item from the camera. Construct the back, frame and shelves separately.
    box(root,x,y,z-.17,.9,1.15,.045,dark);
    for(const side of [-1,1])box(root,x+side*.46,y,z+.035,.055,1.15,.47,panel);
    for(const side of [-1,1])box(root,x,y+side*.56,z+.045,.95,.05,.48,panel);
    for(const dy of [-.35,.05])box(root,x,y+dy,z+.05,.86,.028,.43,silver);
    const pivot = new T.Group();
    pivot.position.set(x-.47,y,z+.31);
    root.add(pivot);
    box(pivot,.47,0,0,.92,1.1,.045,panel);
    box(pivot,.84,0,.035,.028,.26,.04,silver);
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
    const labelGeometry = new T.PlaneGeometry(0.78, 0.1);
    extraGeometry.push(labelGeometry);
    const label = new T.Mesh(labelGeometry, labelMat);
    label.position.set(0.46, 0.42, 0.035);
    pivot.add(label);
    // Each compartment has real recognizable contents rather than three empty cubes.
    const items=[0,1,2].map(i=>{
      const tray=new T.Group();tray.position.set(x-.29+i*.29,y-.11,z+.12);root.add(tray);
      if(key==="water"){
        cyl(tray,0,0,0,.07,.26,waterBlue);
        cyl(tray,0,.15,0,.044,.04,oxygenWhite);
      }else if(key==="eva"){
        box(tray,0,.035,0,.18,.26,.14,oxygenWhite);
        const helmet=new T.Mesh(new T.SphereGeometry(.083,12,8),oxygenWhite);
        helmet.position.y=.22;tray.add(helmet);extraGeometry.push(helmet.geometry);
        box(tray,0,-.11,.09,.19,.085,.08,suitGold);
      }else if(key==="repair"||key==="maintenance"){
        box(tray,0,0,0,.13,.2,.13,dark);
        cyl(tray,0,.135,0,.055,.085,toolSteel);
        box(tray,.055,-.12,.09,.03,.24,.04,toolSteel);
      }else if(key==="science"){
        cyl(tray,0,-.02,0,.07,.2,toolSteel);
        cyl(tray,0,.1,0,.05,.1,waterBlue);
        box(tray,.04,-.12,0,.1,.04,.1,suitGold);
      }else if(key==="samples"){
        cyl(tray,0,0,0,.075,.24,toolSteel);
        const rock=new T.Mesh(new T.DodecahedronGeometry(.06,0),sampleRock);
        rock.position.y=.1;tray.add(rock);extraGeometry.push(rock.geometry);
      }else if(key==="emergency"){
        box(tray,0,0,0,.16,.21,.14,firstAid);
        box(tray,0,0,.075,.035,.12,.012,toolSteel);
        box(tray,0,0,.085,.11,.035,.013,toolSteel);
      }else{
        box(tray,0,0,0,.16,.2,.12,itemMat);
        box(tray,0,.07,.066,.12,.03,.01,waterBlue);
      }
      return tray;
    });
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
    plaque.position.set(x,y-.18,z+.15);root.add(plaque);plaque.visible=false;
    cabinets[key] = { pivot, items, empty:plaque };
  }
  return {
    update(s: Session) {
      for(const {mesh,id} of hatchButtons)
       if(mesh.material instanceof T.MeshBasicMaterial)
        mesh.material.color.set(s.world.doors[id].open?"#70e7c8":"#e5b36f");
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
        c.items.forEach(
          (o, i) => (o.visible = s.world.lockers[key] && i < count),
        );
        c.empty.visible=s.world.lockers[key]&&count<=0;
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

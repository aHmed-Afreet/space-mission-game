import * as T from "three";

/** A compact manufactured cockpit: shaped pressure-window frames and a single
 * continuous moulded console. Live displays remain the simulator's own MFDs. */
export function installForwardCockpit(scene:T.Scene){
  const root=new T.Group();root.name="Formed cockpit pressure glazing and console";scene.add(root);
  const geometries:T.BufferGeometry[]=[];
  const shell=new T.MeshStandardMaterial({color:"#c1c5bf",metalness:.28,roughness:.64});
  const seal=new T.MeshStandardMaterial({color:"#24292a",metalness:.05,roughness:.94});
  const console=new T.MeshStandardMaterial({color:"#929e9e",metalness:.42,roughness:.49});
  const skirt=new T.MeshStandardMaterial({color:"#273438",metalness:.28,roughness:.76});
  function outline(points:readonly (readonly [number,number])[],hole=false){
    const shape=hole?new T.Path():new T.Shape();points.forEach(([x,y],i)=>i===0?shape.moveTo(x,y):shape.lineTo(x,y));shape.closePath();return shape;
  }
  // Chamfered twin apertures form a connected pressure frame. Glazing is clear:
  // its apparent colour comes from the actual launch or celestial scene outside.
  const shape=outline([[-3.2,1.02],[-2.9,2.78],[-2.4,2.91],[2.4,2.91],[2.9,2.78],[3.2,1.02]]) as T.Shape;
  const apertures=[
    [[-2.65,1.3],[-.12,1.3],[-.12,2.59],[-2.22,2.59],[-2.53,2.42]],
    [[.12,1.3],[2.65,1.3],[2.53,2.42],[2.22,2.59],[.12,2.59]],
  ] as const;
  for(const aperture of apertures)shape.holes.push(outline([...aperture].reverse(),true));
  const frameGeometry=new T.ExtrudeGeometry(shape,{depth:.15,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:1,steps:1});
  geometries.push(frameGeometry);
  const frame=new T.Mesh(frameGeometry,shell);frame.position.z=-7.43;root.add(frame);
  // Recessed rubber seals follow each actual aperture, including their mitres.
  const sealPieces:T.BufferGeometry[]=[];
  for(const aperture of apertures){
    const curve=new T.CatmullRomCurve3([...aperture,aperture[0]].map(([x,y])=>new T.Vector3(x,y,-7.24)),false,"catmullrom",0);
    const geo=new T.TubeGeometry(curve,30,.028,5,false);sealPieces.push(geo);geometries.push(geo);
    root.add(new T.Mesh(geo,seal));
  }
  // Instrument housing has a machined, tapered silhouette with rounded bevels.
  // The apron and pedestal are below eye level, preserving the forward sightline.
  const top=outline([[-1.82,.87],[-1.69,1.36],[-1.44,1.43],[1.44,1.43],[1.69,1.36],[1.82,.87]]) as T.Shape;
  const topGeometry=new T.ExtrudeGeometry(top,{depth:.52,bevelEnabled:true,bevelSegments:1,bevelSize:.045,bevelThickness:.04,steps:1});
  geometries.push(topGeometry);
  const housing=new T.Mesh(topGeometry,console);housing.position.z=-6.98;root.add(housing);
  const base=outline([[-1.55,.11],[-1.73,.9],[1.73,.9],[1.55,.11]]) as T.Shape;
  const baseGeometry=new T.ExtrudeGeometry(base,{depth:.43,bevelEnabled:true,bevelSegments:1,bevelSize:.035,bevelThickness:.025,steps:1});
  geometries.push(baseGeometry);
  const support=new T.Mesh(baseGeometry,skirt);support.position.z=-6.95;root.add(support);
  return ()=>{root.removeFromParent();geometries.forEach(g=>g.dispose());[shell,seal,console,skirt].forEach(m=>m.dispose());};
}

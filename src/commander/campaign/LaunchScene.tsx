import {useEffect, useRef, useState} from "react";
import * as T from "three";
import {attachRealismModel} from "../../presentation/realismAssets";
import {graphicsRatioBounds} from "../graphicsPolicy";
import {readPreferences} from "./preferences";
import type {Session} from "./engine";

/** A lightweight tracking view of the launch trainer. State continues to come
 * exclusively from the existing flight model and controls in LaunchView. */
export default function LaunchScene({session,onReady}:{session:Session;onReady:()=>void}){
  const host=useRef<HTMLDivElement>(null), current=useRef(session), ready=useRef(onReady);
  const [failed,setFailed]=useState(false);
  current.current=session;ready.current=onReady;
  useEffect(()=>{
    const element=host.current!;
    let renderer:T.WebGLRenderer;
    try{renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:"high-performance"});}
    catch{setFailed(true);return;}
    let preset:"quality"|"balanced"|"battery"="balanced";
    try{preset=readPreferences(window.localStorage).graphics;}catch{/* Session defaults work without storage. */}
    renderer.setPixelRatio(graphicsRatioBounds(window.devicePixelRatio||1,preset).limit);
    renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    renderer.localClippingEnabled=true;
    renderer.domElement.setAttribute("aria-hidden","true");element.appendChild(renderer.domElement);
    const scene=new T.Scene(), camera=new T.PerspectiveCamera(37,1,.1,90);
    camera.position.set(11,3.5,14);camera.lookAt(0,-.2,0);
    scene.add(new T.HemisphereLight("#edf2f6","#283441",2.2));
    const sun=new T.DirectionalLight("#fff1d9",3.5);sun.position.set(-5,9,8);scene.add(sun);
    const rim=new T.DirectionalLight("#b5cbd5",1.1);rim.position.set(5,0,-5);scene.add(rim);
    const vehicle=new T.Group();scene.add(vehicle);
    const cut=new T.Plane(new T.Vector3(0,1,0),.85);
    const model=attachRealismModel(vehicle,"rocket",{extent:8,centered:true,shadows:false,onLoad:()=>{ready.current();draw(0);}});
    const padGeo=new T.CylinderGeometry(3.3,3.5,.16,48);
    const padMat=new T.MeshStandardMaterial({color:"#4c5152",roughness:.98,metalness:.03});
    const pad=new T.Mesh(padGeo,padMat);pad.position.y=-4.14;scene.add(pad);
    const ringGeo=new T.TorusGeometry(2.3,.035,4,64);
    const ringMat=new T.MeshStandardMaterial({color:"#d7c7a0",roughness:.9});
    const ring=new T.Mesh(ringGeo,ringMat);ring.rotation.x=Math.PI/2;ring.position.y=-4.05;scene.add(ring);
    const flameGeo=new T.ConeGeometry(.42,4,20,1,true);
    const flameMat=new T.MeshBasicMaterial({color:"#dfae78",transparent:true,opacity:.35,side:T.DoubleSide,depthWrite:false});
    const flame=new T.Mesh(flameGeo,flameMat);flame.rotation.z=Math.PI;vehicle.add(flame);
    const coreGeo=new T.ConeGeometry(.16,2.6,12,1,true);
    const coreMat=new T.MeshBasicMaterial({color:"#fff6d4",transparent:true,opacity:.8,depthWrite:false,side:T.DoubleSide});
    const core=new T.Mesh(coreGeo,coreMat);core.rotation.z=Math.PI;vehicle.add(core);
    let disposed=false, frame=0, last=-Infinity;
    function draw(now:number){
      if(disposed)return;
      const s=current.current,f=s.flight;
      const ascent=f.status==="ascent";
      vehicle.rotation.z=-(90-f.pitch)*Math.PI/180*.55;
      vehicle.updateMatrixWorld(true);
      const clipping=cut.clone().applyMatrix4(vehicle.matrixWorld);
      model.root.traverse(object=>{
        if(!(object instanceof T.Mesh))return;
        for(const material of Array.isArray(object.material)?object.material:[object.material]){
          if(f.separated){
            if(!material.clippingPlanes?.length){material.clippingPlanes=[clipping];material.needsUpdate=true;}
            else material.clippingPlanes[0].copy(clipping);
          }else if(material.clippingPlanes?.length){material.clippingPlanes=[];material.needsUpdate=true;}
        }
      });
      const nozzle=f.separated?-.85:-4;
      const thrust=ascent?Math.max(.15,f.throttle):0;
      const ripple=s.state.paused?1:1+Math.sin(now*.013)*.025;
      flame.visible=core.visible=ascent;
      flame.scale.setScalar(thrust*ripple);flame.position.y=nozzle-2*thrust;
      core.scale.setScalar(thrust);core.position.y=nozzle-1.3*thrust;
      pad.visible=ring.visible=f.altitude<2;
      if(pad.visible){pad.position.y=-4.14-f.altitude*1.5;ring.position.y=-4.05-f.altitude*1.5;}
      renderer.render(scene,camera);
    }
    function loop(now:number){
      frame=requestAnimationFrame(loop);
      if(document.hidden||now-last<1000/30)return;
      last=now;draw(now);
    }
    const resize=new ResizeObserver(()=>{
      const width=element.clientWidth,height=element.clientHeight;
      if(!width||!height)return;
      camera.aspect=width/height;camera.updateProjectionMatrix();
      renderer.setSize(width,height);draw(0);
    });resize.observe(element);frame=requestAnimationFrame(loop);
    return ()=>{
      disposed=true;cancelAnimationFrame(frame);resize.disconnect();model.dispose();
      [padGeo,ringGeo,flameGeo,coreGeo].forEach(g=>g.dispose());
      [padMat,ringMat,flameMat,coreMat].forEach(m=>m.dispose());
      renderer.dispose();renderer.domElement.remove();
    };
  },[]);
  return <div ref={host} className="launch-scene-3d" role="img" aria-label={`Launch tracking view at ${session.flight.altitude.toFixed(1)} kilometres`} style={{position:"absolute",inset:"0 30% 0 0",pointerEvents:"none",display:failed?"none":"block"}}/>;
}

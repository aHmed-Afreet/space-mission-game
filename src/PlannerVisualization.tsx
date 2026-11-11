import {useEffect,useRef,useState} from 'react';
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {disposeObjectResources} from './presentation/resources';
import {attachRealismModel} from './presentation/realismAssets';
import {components,rockets,trajectories} from './game';
import {readPreferences} from './commander/campaign/preferences';
import {graphicsRatioBounds} from './commander/graphicsPolicy';

type Props={counts:Record<string,number>;rocket?:number;trajectory?:number;progress?:number;view?:'assembly'|'launcher'|'flight'};
/** A reference hardware viewer; engineering results continue to come from the game model. */
export default function PlannerVisualization({counts,rocket=0,trajectory=1,progress=0,view='assembly'}:Props){
 const host=useRef<HTMLDivElement>(null),values=useRef({counts,progress}),renderRef=useRef<(()=>void)|null>(null);
 const [loaded,setLoaded]=useState(false),[failure,setFailure]=useState(false),[expanded,setExpanded]=useState(false),[spin,setSpin]=useState(false);
 const options=useRef({expanded,spin});values.current={counts,progress};options.current={expanded,spin};
 useEffect(()=>{renderRef.current?.();},[counts,expanded,spin,progress]);
 useEffect(()=>{
  const element=host.current;if(!element)return;let disposed=false,frame=0,visible=true,lastFrame=0;
  let renderer:T.WebGLRenderer;
  try{renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});}catch{setFailure(true);return;}
  setLoaded(false);setFailure(false);
  const scene=new T.Scene();scene.background=new T.Color('#080d13');
  const camera=new T.PerspectiveCamera(34,1,.05,200);camera.position.set(7,4.7,8.2);
  let storage:Storage|undefined;try{storage=window.localStorage;}catch{/* Private browsing retains tab defaults. */}
  const preferences=readPreferences(storage),bounds=graphicsRatioBounds(window.devicePixelRatio,preferences.graphics);
  renderer.setPixelRatio(bounds.limit);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;
  element.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','Interactive aerospace hardware model. Drag to rotate; pinch to zoom.');renderer.domElement.setAttribute('role','img');renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-keyshortcuts','ArrowLeft ArrowRight ArrowUp ArrowDown + - Home');
  const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment();
  const environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;room.dispose();pmrem.dispose();
  scene.add(new T.HemisphereLight(0xcfe5ff,0x22252d,1.2));
  const key=new T.DirectionalLight(0xfff2dc,2);key.position.set(4,8,6);scene.add(key);
  const rim=new T.DirectionalLight(0x9fbbd3,1.2);rim.position.set(-5,2,-6);scene.add(rim);
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,view==='flight'?2.6:1.4,0);controls.enablePan=false;controls.enableDamping=false;controls.minDistance=5;controls.maxDistance=20;controls.maxPolarAngle=Math.PI*.87;
  const model=new T.Group();scene.add(model);
  const grid=new T.GridHelper(12,24,0x53606c,0x252f3a);grid.position.y=-.06;scene.add(grid);
  const deck=new T.Mesh(new T.CircleGeometry(6,64),new T.MeshStandardMaterial({color:0x17202a,roughness:.65,metalness:.28}));deck.rotation.x=-Math.PI/2;deck.position.y=-.07;scene.add(deck);
  const pending=attachRealismModel(model,'capsule',{extent:3.8,onLoad:()=>{if(!disposed){if(view!=='flight')setLoaded(true);requestRender();}},onError:()=>{if(!disposed)setFailure(true);}});
  const launcher=new T.Group();scene.add(launcher);
  const launchAsset=view==='flight'?attachRealismModel(launcher,'rocket',{extent:6,onLoad:()=>{if(!disposed){setLoaded(true);requestRender();}},onError:()=>{if(!disposed)setFailure(true);}}):null;
  const plume=new T.Mesh(new T.ConeGeometry(.18,1.3,20,1,true),new T.MeshBasicMaterial({color:0xf0c38b,transparent:true,opacity:.65,depthWrite:false,side:T.DoubleSide}));plume.rotation.z=Math.PI;plume.position.y=-.5;launcher.add(plume);
  const instruments=new T.Group();scene.add(instruments);instruments.visible=false;
  const scienceAsset=view==='assembly'?attachRealismModel(instruments,'probe',{extent:4.5,onLoad:()=>requestRender()}):null;
  const earth=new T.Mesh(new T.SphereGeometry(20,48,24),new T.MeshStandardMaterial({color:0x496b82,roughness:1}));earth.position.set(-19,-19,-26);scene.add(earth);earth.visible=view==='flight';
  const texture=view==='flight'?new T.TextureLoader().load('./assets/planetary/earth-bluemarble-svs2915-1024-d1d3cb36ae6a.png',map=>{if(disposed){map.dispose();return;}map.colorSpace=T.SRGBColorSpace;(earth.material as T.MeshStandardMaterial).map=map;(earth.material as T.MeshStandardMaterial).needsUpdate=true;requestRender();}):null;
  const starPositions=new Float32Array(150*3);for(let i=0;i<150;i++){const a=i*2.39996,z=1-2*(i+.5)/150,r=Math.sqrt(1-z*z);starPositions.set([Math.cos(a)*r*65,z*65,Math.sin(a)*r*65],i*3);}
  const stars=new T.Points(new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(starPositions,3)),new T.PointsMaterial({color:0xb8c9db,size:.08,sizeAttenuation:true}));scene.add(stars);stars.visible=view==='flight';
  function render(now=0){
   frame=0;if(disposed||!visible||document.hidden)return;
   const moving=options.current.spin&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
   if(now-lastFrame<33&&moving){frame=requestAnimationFrame(render);return;}lastFrame=now;
   instruments.visible=view==='assembly'&&options.current.expanded;model.visible=!instruments.visible;
   grid.visible=view!=='flight';deck.visible=view!=='flight';
   if(moving){model.rotation.y+=.005;instruments.rotation.y+=.005;}
   if(view==='flight'){
    const launch=values.current.progress<25;
    launcher.visible=launch;model.visible=!launch;earth.visible=!launch;stars.visible=!launch;grid.visible=launch;deck.visible=launch;
    launcher.position.y=values.current.progress*.06;plume.scale.setScalar(.8+Math.sin(values.current.progress)*.12);
    model.rotation.z=-.16;model.position.y=.5+Math.sin(values.current.progress/100*Math.PI)*.7;
   }else launcher.visible=false;
   controls.update();renderer.render(scene,camera);renderer.domElement.dataset.renderStats=JSON.stringify({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,pixelRatio:renderer.getPixelRatio(),continuous:moving});if(moving)frame=requestAnimationFrame(render);
  }
  function requestRender(){if(!frame&&!disposed)frame=requestAnimationFrame(render);}
  const keyboard=(event:KeyboardEvent)=>{
   if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(event.key))return;
   event.preventDefault();
   if(event.key==='Home'){camera.position.set(7,4.7,8.2);controls.target.set(0,view==='flight'?2.6:1.4,0);}
   else{
    const spherical=new T.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    if(event.key==='ArrowLeft')spherical.theta-=.15;if(event.key==='ArrowRight')spherical.theta+=.15;
    if(event.key==='ArrowUp')spherical.phi-=.12;if(event.key==='ArrowDown')spherical.phi+=.12;
    if(event.key==='+'||event.key==='=')spherical.radius*=.9;if(event.key==='-')spherical.radius*=1.1;
    spherical.radius=T.MathUtils.clamp(spherical.radius,controls.minDistance,controls.maxDistance);
    spherical.phi=T.MathUtils.clamp(spherical.phi,.12,controls.maxPolarAngle);
    camera.position.setFromSpherical(spherical).add(controls.target);
   }
   controls.update();requestRender();
  };
  renderer.domElement.addEventListener('keydown',keyboard);
  renderRef.current=requestRender;controls.addEventListener('change',requestRender);
  const resize=new ResizeObserver(()=>{const {width,height}=element.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();requestRender();});resize.observe(element);
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)requestRender();});observer.observe(element);
  const visibility=()=>requestRender();document.addEventListener('visibilitychange',visibility);requestRender();
  const loadingTimeout=window.setTimeout(()=>{if(!disposed)setFailure(current=>current||!pending.root.userData.assetLoaded);},20000);
  return()=>{disposed=true;renderRef.current=null;cancelAnimationFrame(frame);clearTimeout(loadingTimeout);resize.disconnect();observer.disconnect();document.removeEventListener('visibilitychange',visibility);controls.dispose();renderer.domElement.removeEventListener('keydown',keyboard);pending.dispose();launchAsset?.dispose();scienceAsset?.dispose();texture?.dispose();disposeObjectResources(scene);environment.dispose();renderer.dispose();renderer.domElement.remove();};
 },[view,rocket]);
 const installed=components.filter(item=>counts[item.id]);
 return <figure className="planner-visualization">
  <div className="planner-model-header"><span>{view==='flight'?'FLIGHT OPERATIONS':'HARDWARE INTEGRATION'} <b>/ 3D</b></span><span>REF. {view==='flight'&&progress<25?'SATURN V':expanded&&view==='assembly'?'VOYAGER':'GEMINI'} · {view==='flight'?'TRANSFER':'INSPECTION'}</span></div>
  <div ref={host} className="planner-model-canvas"/>
  {!loaded&&<div className="planner-model-loading" role="status">{failure?'3D model unavailable. Your engineering plan remains available below.':'Loading local spacecraft model…'}</div>}
  <div className="planner-model-toolbar"><span>Drag / arrow keys rotate · pinch / +− zoom</span><button type="button" aria-pressed={spin} onClick={()=>setSpin(!spin)}>{spin?'Pause rotation':'Rotate model'}</button>{view==='assembly'&&<button type="button" aria-pressed={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?'Inspect crew capsule':'Inspect science hardware'}</button>}</div>
  <figcaption>Gemini, Voyager and Saturn V hardware references: NASA. Inspect real aerospace architecture while planning your fictional vehicle. Selected equipment, launcher parameters and scores follow the game model.</figcaption>
  {view==='assembly'&&<div className="planner-payload-manifest"><strong>PAYLOAD MANIFEST</strong>{installed.length?installed.map(item=><span key={item.id}>{counts[item.id]} × {item.name} <b>{item.mass*counts[item.id]} kg</b></span>):<span>Core bus · no optional payloads installed</span>}</div>}
  {view==='flight'&&<div className="planner-remote-strip"><span>VEHICLE <b>{rockets[rocket].name}</b></span><span>TRANSFER <b>{trajectories[trajectory].days} days</b></span><span>SEQUENCE <b>{progress}%</b></span></div>}
 </figure>;
}

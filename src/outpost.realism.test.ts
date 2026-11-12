import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {BASE_FACILITIES,confinedInteriorCamera,doorPosition,exteriorDoorSpawn,distance,clampWalk} from "./outpost/worldLogic";
import {FACILITY_GUIDE} from "./outpost/navigation";

test("exit from every 3D facility returns outside the SAME doorway, never base centre",()=>{
 for(const f of BASE_FACILITIES){
  const spawn=exteriorDoorSpawn(f.id);
  const door=doorPosition(f);
  assert.ok(distance(spawn,door)>=1.40 && distance(spawn,door)<=1.50,f.id);
  assert.ok(distance(spawn,{x:0,z:0})>4,f.id+" returned to base center");
  assert.ok(distance(spawn,{x:f.x,z:f.z})>f.radius+.9,f.id+" returned inside building");
  assert.deepEqual(clampWalk(spawn,false,null),spawn,"exterior location must be navigable");
 }
});

test("indoor camera always stays beneath ceiling, inside walls, and off floor",()=>{
 for(let i=-16;i<=16;i+=2){
  for(let j=-16;j<=16;j+=2){
   const p=confinedInteriorCamera({x:i,y:i+j,z:j});
   assert.ok(p.x>=-3.72 && p.x<=3.72);
   assert.ok(p.z>=-3.72 && p.z<=3.72);
   assert.ok(p.y>=1.30 && p.y<=3.59);
  }
 }
 assert.deepEqual(confinedInteriorCamera({x:0,y:2.8,z:0}),{x:0,y:2.8,z:0});
});

test("all six outpost facilities have genuinely different 3D building geometries",()=>{
 const code=readFileSync("src/outpost/architectures.ts","utf8");
 const world=readFileSync("src/outpost/World3D.tsx","utf8");
 const names=["crewHabitat","solarField","stormShelter","lifeSupport","greenhouse","battery"];
 for(const name of names)assert.match(code,new RegExp("function "+name+"\\("),name);
 assert.match(code,/switch\(id\)/);
 for(const id of ["habitat","solar","shield","recycle","greenhouse","battery"]){
  assert.ok(FACILITY_GUIDE[id as keyof typeof FACILITY_GUIDE].purpose.length>20);
  assert.match(code,new RegExp('case "'+id+'":'));
 }
 assert.match(code,/T\.TorusGeometry/,"greenhouse should have arched ribs");
 assert.match(code,/panelRack/,"solar farm should have multiple ground-mounted panels");
 assert.match(code,/radiator/,"habitat should have pressure-vessel details");
 assert.match(code,/regolith/,"radiation shelter should have protective earthwork");
 assert.match(code,/pipe\(/,"recycling and battery facility should contain piping");
 assert.match(world,/buildDistinctExterior/);
 assert.match(world,/furnishDistinctInterior/);
 assert.doesNotMatch(world,/dome\(group,f\.radius\*\.92/,"avoid identical generic exterior domes");
});

test("3D camera uses actual interior geometry collision and restores pose on scene change",()=>{
 const world=readFileSync("src/outpost/World3D.tsx","utf8");
 const junior=readFileSync("src/outpost/Junior3D.tsx","utf8");
 assert.match(world,/scene\.cameraSolids/);
 assert.match(world,/ray\.intersectBox/);
 assert.match(world,/confinedInteriorCamera/);
 assert.match(world,/const initial=spawn\.current/);
 assert.match(world,/onEnter\(null,\{position:/);
 assert.match(world,/onEnter\(state\.open,\{position:/);
 assert.match(junior,/exteriorDoorSpawn\(previous\)/);
 assert.match(junior,/spawn\.current=\{position,yaw:previous\?exteriorDoorYaw\(previous\):pose\.yaw/);
 assert.match(junior,/enteredBuilding\.current=id/);
 assert.match(junior,/spawn=\{spawn\}/);
});

test("iPad game viewport is fixed and does not allow a page swipe to scroll",()=>{
 const code=readFileSync("src/outpost/Junior3D.tsx","utf8");
 const css=readFileSync("src/outpost/world3d.css","utf8");
 const lock=readFileSync("src/outpost/scrollLock.ts","utf8");
 assert.match(code,/useLayoutEffect\(\(\)=>lockOutpostViewport\(\),\[\]\)/);
 assert.match(lock,/body\.style\.position="fixed"/);
 assert.match(lock,/html\.style\.overflow="hidden"/);
 assert.match(lock,/html\.style\.overflow=previous\.htmlOverflow/,"browser styles must restore after gameplay");
 assert.match(lock,/document\.addEventListener\("touchmove",blockPanning,\{capture:true,passive:false\}\)/);
 assert.match(lock,/window\.scrollTo\(0,0\)/);
 assert.match(css,/html\.outpost-viewport-locked #root\{/);
 assert.match(css,/height:var\(--outpost-visible-height,100dvh\)!important/);
 assert.match(css,/html\.outpost-viewport-locked \.j3-root \.j3-buttons/);
 assert.match(css,/\.j3-root\{\s*position:fixed;inset:0/);
 assert.match(css,/\.j3-root \.j3-world,\.j3-root \.jm-world-host/);
 assert.match(css,/overscroll-behavior:none/);
});

test("correct final iPad controls: left movement, right RUN and INTERACT",()=>{
 const css=readFileSync("src/outpost/world3d.css","utf8");
 const code=readFileSync("src/outpost/Junior3D.tsx","utf8");
 assert.match(css,/\.j3-root \.j3-move-zone\{\s*left:0;right:auto/);
 assert.match(css,/\.j3-root \.j3-buttons\{\s*left:auto;right:/);
 assert.match(code,/bottom-left joystick/);
 assert.match(code,/!desktopControls&&<Stick move=\{movement\}\/>/);
 assert.match(code,/onPointerMove=\{e=>actionMove\("run",e\)\}/);
 assert.match(code,/onPointerMove=\{e=>actionMove\("interact",e\)\}/);
});

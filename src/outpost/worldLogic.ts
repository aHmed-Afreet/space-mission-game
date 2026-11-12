import type {FacilityId} from "./FacilityScene";

/**
 * Deterministic movement and proximity rules, independent of React/WebGL.
 * A building has a real circular exterior collision boundary; its front
 * airlock opens only via INTERACT and allows the astronaut to walk inside.
 */
export type Point2={x:number;z:number};
export type Place={id:FacilityId;title:string;x:number;z:number;radius:number};
export const BASE_FACILITIES:Place[]=[
  {id:"habitat",title:"Crew Habitat",x:0,z:-16,radius:3.45},
  {id:"solar",title:"Solar Field",x:-17,z:-10,radius:3.1},
  {id:"shield",title:"Storm Shelter",x:17,z:-10,radius:3.25},
  {id:"recycle",title:"Life Support",x:-17,z:11,radius:3.15},
  {id:"greenhouse",title:"Greenhouse",x:17,z:11,radius:3.45},
  {id:"battery",title:"Battery Storage",x:0,z:18,radius:3.25},
];
export function doorPosition(f:Place):Point2 {
  const n=Math.hypot(f.x,f.z)||1;
  return {x:f.x-f.x/n*f.radius,z:f.z-f.z/n*f.radius};
}
export function distance(a:Point2,b:Point2){return Math.hypot(a.x-b.x,a.z-b.z);}
export function nearestDoor(pos:Point2,max=2.4):Place|null{
  const ordered=BASE_FACILITIES.map(f=>({f,d:distance(pos,doorPosition(f))})).sort((a,b)=>a.d-b.d);
  return ordered[0]&&ordered[0].d<=max?ordered[0].f:null;
}
export function clampWalk(position:Point2,inside:boolean,openDoor:FacilityId|null,room:FacilityId|null=null):Point2{
  let p={x:Math.max(-29,Math.min(29,position.x)),z:Math.max(-29,Math.min(29,position.z))};
  if(inside){
   // A closed physical hatch cannot be walked through. Once opened the
   // astronaut can cross the actual exit threshold at z>4.05.
   p={x:Math.max(-4,Math.min(4,p.x)),z:Math.max(-3.8,Math.min(openDoor?4.3:3.81,p.z))};
   const solids:{minX:number;maxX:number;minZ:number;maxZ:number}[]=[];
   if(room==="habitat"){
     solids.push({minX:-4,maxX:-2.36,minZ:-3.28,maxZ:1.84});
     solids.push({minX:1.83,maxX:3.31,minZ:.62,maxZ:2.02});
   }else if(room==="greenhouse"){
     for(const x of [-2.95,2.95])solids.push({minX:x-.95,maxX:x+.95,minZ:-3.0,maxZ:2.8});
   }
   // Slide along furniture instead of teleporting through it. Gameplay
   // interaction radii remain reachable from beside the equipment.
   for(const b of solids){
     if(p.x>b.minX&&p.x<b.maxX&&p.z>b.minZ&&p.z<b.maxZ){
       const edges=[p.x-b.minX,b.maxX-p.x,p.z-b.minZ,b.maxZ-p.z];
       const edge=Math.min(...edges),side=edges.indexOf(edge);
       if(side===0)p.x=b.minX;
       else if(side===1)p.x=b.maxX;
       else if(side===2)p.z=b.minZ;
       else p.z=b.maxZ;
     }
   }
   return p;
  }
  for(const f of BASE_FACILITIES){
    if(openDoor===f.id)continue;
    const dx=p.x-f.x,dz=p.z-f.z,dist=Math.hypot(dx,dz);
    // Exterior collisions preserve a gap for approaching the actual door.
    const min=f.radius-0.32;
    if(dist<min){
      // Exactly at the centre, choose the outward front-door direction:
      // dividing a zero displacement by epsilon would leave the player
      // inside an otherwise solid 3D structure.
      const n=dist>.001?dist:Math.hypot(f.x,f.z)||1;
      const ox=dist>.001?dx:-f.x,oz=dist>.001?dz:-f.z;
      p={x:f.x+ox/n*min,z:f.z+oz/n*min};
    }
  }
  return p;
}
export function walkStep(pos:Point2,yaw:number,strafe:number,forward:number,dt:number,inside:boolean,openDoor:FacilityId|null,room:FacilityId|null=null):Point2{
  const mag=Math.max(1,Math.hypot(strafe,forward));
  const x=strafe/mag,z=forward/mag;
  const speed=inside?2.8:4.2;
  const step=Math.min(.06,Math.max(0,dt))*speed;
  return clampWalk({x:pos.x+(-Math.sin(yaw)*z+Math.cos(yaw)*x)*step,
                    z:pos.z+(-Math.cos(yaw)*z-Math.sin(yaw)*x)*step},inside,openDoor,room);
}
export function doorwayCrossed(pos:Point2,id:FacilityId):boolean{
  const f=BASE_FACILITIES.find(x=>x.id===id)!;
  return distance(pos,{x:f.x,z:f.z})<f.radius-1.0;
}
export function nearConsole(pos:Point2){return distance(pos,{x:0,z:-2.6})<2.7;}
export function nearExit(pos:Point2){return distance(pos,{x:0,z:3.85})<2.0;}


/** Return the astronaut just outside the same door they used to enter. */
export function exteriorDoorSpawn(id:FacilityId,clearance=1.45):Point2 {
 const place=BASE_FACILITIES.find(f=>f.id===id);
 if(!place)throw new Error("Unknown outpost facility");
 const entry=doorPosition(place);
 const dx=entry.x-place.x,dz=entry.z-place.z;
 const n=Math.hypot(dx,dz)||1;
 return {x:entry.x+dx/n*clearance,z:entry.z+dz/n*clearance};
}

/** After exiting, face OUTWARD from the same entrance toward the base paths. */
export function exteriorDoorYaw(id:FacilityId):number{
 const f=BASE_FACILITIES.find(x=>x.id===id);
 if(!f)throw new Error("Unknown outpost facility");
 // Forward is (-sin(yaw),-cos(yaw)); outward from this facility points
 // from its centre toward (0,0). This makes the astronaut face AWAY
 // from the external door on every side of the base.
 return Math.atan2(f.x,f.z);
}
/** Bed and dining locations are in the actual crew-habitat 3D interior. */
export const CREW_BED:Point2={x:-2.75,z:.75};
export const CREW_DINING:Point2={x:2.55,z:1.35};
export const HABITAT_WAKE:Point2={x:-1.7,z:1.1};
export function nearHabitatRoutine(pos:Point2):"meal"|"sleep"|null{
 if(distance(pos,CREW_DINING)<1.5)return "meal";
 if(distance(pos,CREW_BED)<1.4)return "sleep";
 return null;
}
/** Confine the indoor third-person camera inside the actual 9m room shell. */
export type Point3={x:number;y:number;z:number};
export function confinedInteriorCamera(candidate:Point3):Point3{
 return {
  x:Math.max(-3.72,Math.min(3.72,candidate.x)),
  y:Math.max(1.30,Math.min(3.59,candidate.y)),
  z:Math.max(-3.72,Math.min(3.72,candidate.z))
 };
}

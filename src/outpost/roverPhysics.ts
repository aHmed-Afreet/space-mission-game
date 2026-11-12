import {BASE_FACILITIES} from "./worldLogic";

/** Simplified low-speed rover physics for educational driving, not engineering. */
export type RoverPose={x:number;z:number;heading:number;speed:number};
export type RoverDrive={throttle:number;steer:number};
export const ROVER_START:RoverPose={x:8,z:0,heading:-.7,speed:0};
export const ROVER_MAX_SPEED=5.6;
export const ROVER_RADIUS=1.45;
const clamp=(x:number,min:number,max:number)=>Math.max(min,Math.min(max,x));

export function stepRover(p:Readonly<RoverPose>,input:Readonly<RoverDrive>,elapsed:number):RoverPose{
 const dt=clamp(elapsed,0,.1),throttle=clamp(input.throttle,-1,1),steer=clamp(input.steer,-1,1);
 // Throttle adds acceleration; otherwise friction slows the rover naturally.
 let speed=clamp(p.speed+throttle*3.4*dt,-2.2,ROVER_MAX_SPEED);
 speed*=Math.exp(-dt*(Math.abs(throttle)<.01?2.1:.28));
 const heading=p.heading+steer*dt*1.15*clamp(Math.abs(speed)/1.4,0,1)*(speed<0?-1:1);
 let x=clamp(p.x+Math.sin(heading)*speed*dt,-27,27);
 let z=clamp(p.z-Math.cos(heading)*speed*dt,-27,27);
 if(x===27||x===-27||z===27||z===-27)speed*=.15;
 // A radius-based rover collider makes buildings solid even when steering.
 for(const f of BASE_FACILITIES){
  const dx=x-f.x,dz=z-f.z,dist=Math.hypot(dx,dz),min=f.radius+ROVER_RADIUS;
  if(dist<min){
   const inv=1/Math.max(.001,dist);
   x=f.x+(dist>.001?dx*inv:1)*min;
   z=f.z+(dist>.001?dz*inv:0)*min;
   speed=0;
  }
 }
 return {x,z,heading,speed:Math.abs(speed)<.008?0:speed};
}
export function roverDisplaySpeed(p:RoverPose):string{return (Math.abs(p.speed)*3.6).toFixed(1)+" km/h";}

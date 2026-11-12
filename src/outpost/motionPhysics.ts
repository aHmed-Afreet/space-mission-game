import type {Destination} from "./engine";
export type PlanarVelocity={x:number;y:number};
export type JumpState={height:number;velocity:number};

export function inertialMovement(current:PlanarVelocity,input:PlanarVelocity,dt:number):PlanarVelocity{
 const t=Math.min(.08,Math.max(0,dt));
 const mag=Math.min(1,Math.hypot(input.x,input.y)),scale=mag>1e-6?mag/Math.hypot(input.x,input.y):0;
 const tx=input.x*scale,ty=input.y*scale;
 // An astronaut accelerates rather than teleporting instantly to full speed.
 // Boots and suit inertia decelerate when movement input stops.
 const response=mag>.01?7.0:11.0;
 const k=1-Math.exp(-response*t);
 return {x:current.x+(tx-current.x)*k,y:current.y+(ty-current.y)*k};
}
export const localGravity=(destination:Destination)=>destination==="moon"?1.62:3.71;
/** Limited educational jump arc; suit boots land on the ground, never fall below it. */
export function jumpStep(s:JumpState,dt:number,destination:Destination,pressed:boolean):JumpState{
 const d=Math.min(.08,Math.max(0,dt)),g=localGravity(destination);
 const launch=pressed&&s.height<=.00001&&s.velocity<=0;
 const velocity=launch?Math.sqrt(2*g*.55):s.velocity;
 const height=s.height+velocity*d-.5*g*d*d;
 return height<=0?{height:0,velocity:0}:{height:Math.min(.75,height),velocity:velocity-g*d};
}

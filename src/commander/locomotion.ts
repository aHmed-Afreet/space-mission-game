/** Cabin coordinates, collision planes and speeds remain in metres/seconds. */
export type LocomotionState = {
  position: { x:number; y:number; z:number };
  movement: { forward:number; sideways:number };
  jump: { height:number; velocity:number };
};
export type LocomotionInput = { forward:number; sideways:number; yaw:number; sprint:boolean; lift:number };
export type LocomotionEnvironment = { movement:number; gravity:number } | null;

export function stepLocomotion(state: LocomotionState, input: LocomotionInput,
  environment: LocomotionEnvironment, dt:number, allowed:(x:number,z:number)=>boolean,
  elapsed:number, reducedMotion:boolean) {
  const {position, movement, jump} = state;
  const length = Math.max(1, Math.hypot(input.forward, input.sideways));
  // Exact exponential response avoids cadence-dependent acceleration/braking.
  const smoothing = 1 - Math.exp(-dt * 10);
  movement.forward += (input.forward / length - movement.forward) * smoothing;
  movement.sideways += (input.sideways / length - movement.sideways) * smoothing;
  const speed = (position.z > 10.4 && environment ? environment.movement * .88 : 1.8) * (input.sprint ? 1.65 : 1);
  const x = position.x + (Math.cos(input.yaw) * movement.sideways - Math.sin(input.yaw) * movement.forward) * dt * speed;
  const z = position.z + (-Math.sin(input.yaw) * movement.sideways - Math.cos(input.yaw) * movement.forward) * dt * speed;
  if (allowed(x, position.z)) position.x = x;
  if (allowed(position.x, z)) position.z = z;
  if (position.z > 10.4 && environment?.gravity === 0) {
    // Bounded training-frame drift, rather than an unbounded orbital solver.
    jump.velocity = Math.max(-2.3, Math.min(2.3,
      jump.velocity + (Math.max(-1, Math.min(1, input.lift)) * 3.2 - jump.velocity * .8) * dt));
    jump.height = Math.max(-.65, Math.min(5.4, jump.height + jump.velocity * dt));
    if ((jump.height === -.65 && jump.velocity < 0) || (jump.height === 5.4 && jump.velocity > 0)) jump.velocity = 0;
  } else if (position.z > 10.4 && environment) {
    jump.height = Math.max(0, jump.height + jump.velocity * dt);
    jump.velocity -= Math.max(.5, environment.gravity) * dt;
    if (jump.height === 0 && jump.velocity < 0) jump.velocity = 0;
  } else {
    jump.height = 0;
    jump.velocity = 0;
  }
  // A suit's gait is slower under low gravity; head motion stops while
  // floating or jumping. Reduced-motion preference always keeps a level camera.
  const outside = position.z > 10.4 && environment;
  const gravity = outside ? environment.gravity : 9.81;
  const gait = Math.sqrt(Math.max(0, gravity) / 9.81) * (input.sprint ? 10 : 8);
  const moving = Math.min(1, Math.hypot(movement.forward, movement.sideways));
  const bob = reducedMotion || gravity === 0 || jump.height > 0 ? 0 :
    Math.sin(elapsed * gait) * (input.sprint ? .014 : .009) * moving;
  position.y = 1.63 + jump.height + bob;
}

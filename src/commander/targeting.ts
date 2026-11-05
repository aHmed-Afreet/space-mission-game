import * as THREE from "three";
import { deck } from "./layout";
import { doors, type DoorId } from "./campaign/ship";
import type { Session } from "./campaign/engine";

export type AimTarget = { kind: "door" | "locker" | "station" | "airlock"; id: string };
type Target = AimTarget & { position: THREE.Vector3; distance: number };
type Hatch = AimTarget & {
  z: number;
  halfWidth: number;
  height: number;
  closed: boolean;
};
type TargetingState = Pick<Session, "world" | "airlock">;

const lockerPositions: Record<string, [number, number, number]> = {
  food: [2.2, 1.3, .45], water: [2.7, 1.8, .75], science: [-2.45, 1.8, -2.7],
  samples: [-2.45, 1.8, -3.7], equipment: [2.4, 1.8, 5.7],
  eva: [2.45, 1.8, 3.8], repair: [2.45, 1.8, 4.8], emergency: [1.5, 1.8, 6.1],
  maintenance: [-2.4, 1.8, .75],
};

function hatches(state: TargetingState, supportsEva: boolean, now: number): Hatch[] {
  const result: Hatch[] = Object.entries(doors).map(([id, d]) => ({
    kind: "door", id, z: d.z, halfWidth: 1.04, height: 2.53,
    closed: !state.world.doors[id as DoorId].open || now < state.world.doors[id as DoorId].readyAt,
  }));
  result.push({ kind: "airlock", id: "inner", z: 7.75, halfWidth: .71,
    height: 2.48, closed: !supportsEva || !state.airlock.inner });
  if (supportsEva) result.push({ kind: "airlock", id: "outer", z: 10.25,
    halfWidth: .71, height: 2.48, closed: !state.airlock.outer });
  return result;
}

/** Intersect a finite hatch plane with a ray or segment. */
function intersection(origin: THREE.Vector3, direction: THREE.Vector3, hatch: Hatch) {
  if (Math.abs(direction.z) < 1e-8) return null;
  const distance = (hatch.z - origin.z) / direction.z;
  if (distance <= .001) return null;
  return { distance, x: origin.x + direction.x * distance,
    y: origin.y + direction.y * distance };
}

function occluded(origin: THREE.Vector3, target: Target, gates: Hatch[]) {
  const direction = target.position.clone().sub(origin);
  return gates.some(gate => {
    const hit = intersection(origin, direction, gate);
    if (!hit || hit.distance >= 1 - 1e-6 || hit.y < .02 || hit.y > 2.7) return false;
    // The side bulkheads remain solid when the central hatch is open.
    const bulkhead = gate.kind === "door" && Math.abs(hit.x) >= 1.04 && Math.abs(hit.x) <= 3.25;
    const leaf = gate.closed && Math.abs(hit.x) <= gate.halfWidth && hit.y <= gate.height;
    return bulkhead || leaf;
  });
}

export function pickAimTarget(
  camera: THREE.PerspectiveCamera,
  state: TargetingState,
  supportsEva: boolean,
  now = Date.now(),
): AimTarget | null {
  // Projection must use this frame's position and rotation, including the first frame.
  camera.updateMatrixWorld();
  const gates = hatches(state, supportsEva, now);
  const direction = camera.getWorldDirection(new THREE.Vector3());
  // Prevent a distant or sideways hatch from stealing INTERACT from a nearby
  // science station. These limits exactly match worldAction's door reach.
  const reachableDoor = (gate: Hatch) => gate.kind !== "door" ||
    (Math.abs(camera.position.z - gate.z) <= 1.6 &&
      Math.abs(camera.position.x) <= 1.5);
  let blocking: Hatch | undefined, blockingDistance = Infinity;
  for (const gate of gates) {
    if (!gate.closed || !reachableDoor(gate)) continue;
    const hit = intersection(camera.position, direction, gate);
    if (!hit || hit.distance > (gate.kind === "door" ? 3.5 : 3.4) ||
      Math.abs(hit.x) > gate.halfWidth || hit.y < .02 || hit.y > gate.height) continue;
    if (occluded(camera.position, { kind: gate.kind, id: gate.id,
      position: camera.position.clone().addScaledVector(direction, hit.distance), distance: hit.distance }, gates)) continue;
    if (hit.distance < blockingDistance) {
      blocking = gate;
      blockingDistance = hit.distance;
    }
  }

  const targets: Target[] = [];
  for (const gate of gates) {
    if (!reachableDoor(gate)) continue;
    const facingSide = camera.position.z > gate.z ? 1 : -1;
    // Fixed frame controls stay reachable after the leaf slides aside. The
    // moving leaf panel follows the same travel as the visible hatch hardware.
    const xs = gate.kind === "door"
      ? [-.98, .98, state.world.doors[gate.id as DoorId].open ? 1.59 : .54]
      : [.67];
    for (const x of xs) targets.push({ kind: gate.kind, id: gate.id,
      position: new THREE.Vector3(x, 1.35, gate.z + facingSide * (gate.kind === "door" ? .19 : .24)),
      distance: gate.kind === "door" ? 3.5 : 3.4 });
  }
  for (const [id, loc] of Object.entries(lockerPositions))
    targets.push({ kind: "locker", id, position: new THREE.Vector3(...loc), distance: 2.6 });
  for (const [id, loc] of Object.entries(deck))
    targets.push({ kind: "station", id, position: new THREE.Vector3(loc.x, 1.3, loc.z + .48), distance: 2.9 });

  let picked: AimTarget | null = blocking ? { kind: blocking.kind, id: blocking.id } : null;
  let best = blocking ? blockingDistance * .04 : Infinity;
  for (const target of targets) {
    const distance = target.position.distanceTo(camera.position);
    if (distance > target.distance || occluded(camera.position, target, gates)) continue;
    const p = target.position.clone().project(camera);
    if (p.z < -1 || p.z > 1) continue;
    const error = Math.hypot(p.x, p.y * .8);
    if (error > (target.kind === "door" || target.kind === "airlock" ? .68 : .52)) continue;
    const score = error + distance * .04;
    if (score < best) {
      best = score;
      picked = { kind: target.kind, id: target.id };
    }
  }
  return picked;
}

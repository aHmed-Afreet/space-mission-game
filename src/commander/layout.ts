import type { Area } from "./simulation";
/** Presentation coordinates only. Simulation actions continue to use the original area IDs. */
export const deck: Record<
  Area,
  { x: number; z: number; name: string; code: string }
> = {
  cockpit: { x: 0, z: -6.1, name: "Flight deck", code: "01" },
  science: { x: -2.2, z: -3.1, name: "Science laboratory", code: "02" },
  communications: { x: 2.2, z: -3.1, name: "Communications", code: "03" },
  power: { x: -2.2, z: 0.45, name: "Power & life support", code: "04" },
  galley: { x: 2.2, z: 0.45, name: "Galley & water", code: "05" },
  sleep: { x: -2.2, z: 4.4, name: "Crew quarters", code: "06" },
  equipment: { x: 2.2, z: 4.4, name: "Equipment bay", code: "07" },
};
export type Position = { x: number; z: number; heading: number };
export const spawn: Position = { x: 0, z: -4.95, heading: 0 };
export function nearby(x: number, z: number): Area | undefined {
  return (Object.keys(deck) as Area[])
    .sort(
      (a, b) =>
        Math.hypot(x - deck[a].x, z - deck[a].z) -
        Math.hypot(x - deck[b].x, z - deck[b].z),
    )
    .find((a) => Math.hypot(x - deck[a].x, z - deck[a].z) < 1.85);
}
export function walkable(x: number, z: number) {
  if (Math.abs(x) > 3.04 || z < -6.85 || z > 7.15) return false;
  // Furnished side bays, berth and cockpit furniture. Centreline remains continuously walkable.
  if (
    (Object.keys(deck) as Area[]).some(
      (id) =>
        id !== "cockpit" &&
        Math.abs(x - deck[id].x) < 1.04 &&
        Math.abs(z - deck[id].z) < 0.65,
    )
  )
    return false;
  if (Math.abs(x) > 1.25 && z > 5.65 && z < 6.75) return false;
  if (Math.abs(x) < 1.8 && z < -6.05) return false;
  if (
    [-0.8, 0.8].some((s) => Math.abs(x - s) < 0.4 && Math.abs(z + 5.15) < 0.53)
  )
    return false;
  // Side bulkheads divide flight, service and habitation zones with a 2.2m clear doorway.
  if (
    [2.35, -1.35, -4.35].some(
      (s) => Math.abs(z - s) < 0.23 && Math.abs(x) > 0.85,
    )
  )
    return false;
  return true;
}

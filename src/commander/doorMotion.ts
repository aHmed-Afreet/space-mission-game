/**
 * One visual specification for all three pressurized section-door pairs.
 * Safety/collision decisions remain exclusively in campaign/engine.ts.
 * Initial frame snaps to saved open state, then the same real-time easing
 * is used in the cabin and the physical equipment fixture layer.
 */
export function sectionDoorLeafX(open: boolean, side: -1 | 1): number {
  return side * (0.53 + (open ? 1.05 : 0));
}
/** A 650ms door clearance should correspond to a visibly almost-open hatch. */
export function doorMotionBlend(dtSeconds: number | null): number {
  if (dtSeconds === null) return 1;
  const dt = Math.max(0, Math.min(dtSeconds, 0.15));
  return 1 - Math.exp(-dt / 0.13);
}

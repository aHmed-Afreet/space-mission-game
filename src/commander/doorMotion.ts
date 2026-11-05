/**
 * The visual movement and collision of all three interior section doors
 * share the same 650ms clearance timestamp (ShipState.doors[id].readyAt).
 * No frame-count interpolation: after an iPad frame stall, the door snaps to
 * its truthful time-based position rather than staying mostly closed.
 */
export const SECTION_DOOR_DURATION_MS = 650;

export function sectionDoorOpenFraction(
  open: boolean, readyAt: number, nowMs: number,
): number {
  if (!Number.isFinite(readyAt) || readyAt <= 0 || nowMs >= readyAt)
    return open ? 1 : 0;
  const startedAt = readyAt - SECTION_DOOR_DURATION_MS;
  const progress = Math.max(0, Math.min(1, (nowMs-startedAt) / SECTION_DOOR_DURATION_MS));
  // Smooth acceleration and braking, finishing at the exact clearance time.
  const eased = progress*progress*(3-2*progress);
  return open ? eased : 1-eased;
}

/** Each leaf is 1.02m wide; full-open centres at +/-1.58m. */
export function sectionDoorLeafX(
  open: boolean, side: -1 | 1, readyAt = 0, nowMs = Date.now(),
): number {
  return side*(0.53 + sectionDoorOpenFraction(open,readyAt,nowMs)*1.05);
}

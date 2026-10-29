/** Shared simulation rules: modal screens freeze physics as well as controls. */
export const STORY_FRAME_MS = 1000 / 30;
// rAF timestamps have sub-millisecond jitter; do not accidentally skip a third
// 60 Hz frame because two intervals add to 33.332 instead of 33.333 ms.
export const storyFrameDue = (now: number, last: number) => now - last >= STORY_FRAME_MS - 1;

export function storyFrame(oxygen: number, outside: boolean, paused: boolean, elapsed: number) {
  const delta = paused ? 0 : Math.max(0, Math.min(Number.isFinite(elapsed) ? elapsed : 0, .06));
  const remaining = outside ? Math.max(0, oxygen - delta * .06) : oxygen;
  return { delta, oxygen: remaining, emergencyReturn: outside && delta > 0 && remaining <= 0 };
}

export function refillStoryOxygen(oxygen: number, outside: boolean, nearHatch: boolean) {
  return !outside && nearHatch ? 100 : oxygen;
}

/** The renderer is paced at 30 Hz, so a healthy 30 fps is not GPU overload. */
export function storyPixelRatio(current: number, limit: number, fps: number) {
  const floor = Math.min(.8, limit);
  if (fps < 24) return Math.max(floor, current - .12);
  if (fps > 28) return Math.min(limit, current + .06);
  return current;
}

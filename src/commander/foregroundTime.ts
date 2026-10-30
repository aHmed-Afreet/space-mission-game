/**
 * Monotonic foreground time shared by locomotion and resource clocks.
 * Rendering may run at any cadence. Gaps up to two seconds are integrated in
 * fixed collision-safe steps, including a one-Hz callback. A longer stall is a
 * suspension: neither movement nor resources catch up that whole interval.
 * Hidden/paused frames reset the anchor and fractional step, so resuming cannot
 * replay input or charge background time. UI input locks need not pause a clock.
 */
export const FOREGROUND_STEP_SECONDS = 1 / 120;
export const FOREGROUND_MAX_GAP_SECONDS = 2;
export const COMMANDER_MINUTES_PER_SECOND = 0.5;

export type ForegroundFrame = {
  acceptedSeconds: number;
  steps: number;
  suspended: boolean;
};

export function createForegroundClock({
  stepSeconds = FOREGROUND_STEP_SECONDS,
  maxFrameSeconds = FOREGROUND_MAX_GAP_SECONDS,
}: { stepSeconds?: number; maxFrameSeconds?: number } = {}) {
  if (!(stepSeconds > 0) || !Number.isFinite(stepSeconds) ||
      !(maxFrameSeconds >= stepSeconds) || !Number.isFinite(maxFrameSeconds))
    throw new RangeError("Invalid foreground clock policy");
  let previous: number | undefined;
  let remainder = 0;
  return {
    reset(nowMs?: number) {
      previous = Number.isFinite(nowMs) ? nowMs : undefined;
      remainder = 0;
    },
    advance(nowMs: number, state: { active: boolean; visible: boolean }, onStep: (seconds: number) => void): ForegroundFrame {
      const empty = { acceptedSeconds: 0, steps: 0, suspended: false };
      if (!Number.isFinite(nowMs)) return empty;
      const before = previous;
      previous = nowMs;
      if (!state.active || !state.visible || before === undefined) {
        remainder = 0;
        return empty;
      }
      const elapsed = (nowMs - before) / 1000;
      if (elapsed < 0 || elapsed > maxFrameSeconds) {
        remainder = 0;
        return { ...empty, suspended: true };
      }
      remainder += elapsed;
      const steps = Math.floor((remainder + stepSeconds * 1e-7) / stepSeconds);
      remainder = Math.max(0, remainder - steps * stepSeconds);
      for (let index = 0; index < steps; index++) onStep(stepSeconds);
      return { acceptedSeconds: steps * stepSeconds, steps, suspended: false };
    },
  };
}

/** Capture each accepted interval's rate; changing warp cannot reprice it. */
export function createCommanderTimeBudget() {
  let seconds = 0;
  const segments: { seconds:number; rate:number }[] = [];
  return {
    add(acceptedSeconds: number, simRate: number) {
      if (!(acceptedSeconds >= 0) || !Number.isFinite(acceptedSeconds) ||
          !(simRate > 0) || !Number.isFinite(simRate)) return;
      seconds += acceptedSeconds;
      if (acceptedSeconds === 0) return;
      const last = segments[segments.length - 1];
      if (last?.rate === simRate) last.seconds += acceptedSeconds;
      else segments.push({ seconds:acceptedSeconds, rate:simRate });
    },
    get seconds() { return seconds; },
    takeSteps(flush = false) {
      const result: number[] = [];
      // Resource integrations use the same quarter-second quantum at 1 Hz and
      // 120 Hz. Explicit actions flush the final fraction before changing state.
      while (seconds >= .25 - 1e-9 || (flush && seconds > 1e-9)) {
        let remaining = Math.min(.25, seconds), minutes = 0;
        seconds = Math.max(0, seconds - remaining);
        while (remaining > 1e-9 && segments.length) {
          const segment = segments[0];
          const portion = Math.min(remaining, segment.seconds);
          minutes += portion * COMMANDER_MINUTES_PER_SECOND * segment.rate;
          segment.seconds -= portion;
          remaining -= portion;
          if (segment.seconds < 1e-9) segments.shift();
        }
        result.push(minutes);
      }
      return result;
    },
  };
}

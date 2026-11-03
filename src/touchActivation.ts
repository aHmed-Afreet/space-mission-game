/** Discrete touch actions own their contact independently of held game controls.
 * Browsers need not generate a click for a non-primary touch. Mouse/keyboard
 * activation still uses the ordinary button click; touch commits on release.
 */
export function createTouchActivation() {
  let contact: number | null = null;
  let lastRelease = -Infinity;
  return {
    begin(pointerType: string, pointerId: number): boolean {
      if (pointerType !== "touch" || contact !== null) return false;
      contact = pointerId;
      return true;
    },
    release(pointerId: number, eligible: boolean, timeStamp: number): boolean {
      if (contact !== pointerId) return false;
      contact = null;
      lastRelease = timeStamp;
      return eligible;
    },
    cancel(pointerId: number) {
      if (contact === pointerId) contact = null;
    },
    click(detail: number, pointerType: string | undefined, timeStamp: number): boolean {
      if (detail === 0) return true; // Keyboard and assistive activation.
      if (pointerType) return pointerType !== "touch";
      // Older Pointer Events browsers can expose a compatibility MouseEvent
      // without pointerType. Suppress the duplicate immediately after touch.
      return timeStamp < lastRelease || timeStamp - lastRelease > 800;
    },
  };
}

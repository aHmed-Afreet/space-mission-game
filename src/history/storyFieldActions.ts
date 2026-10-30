import type { FieldAction } from "./storyScenarios";
export type StoryFieldEligibility = { ready: boolean; minimum: number; feedback: string };
/** Use real metres for both the visible state and the handler, including stale clicks. */
export function storyFieldEligibility(action: FieldAction, outside: boolean, distance: number): StoryFieldEligibility {
  const minimum = action === "walk" ? 3 : action === "egress" || action === "return" ? 0 : 2;
  if (!outside) return { ready: false, minimum, feedback: "Exit through the prepared airlock in your sealed suit first." };
  if (!Number.isFinite(distance) || distance < 0) return { ready: false, minimum, feedback: "Position is unavailable. Return to the hatch and try again." };
  if (distance < minimum) return { ready: false, minimum, feedback: `Move at least ${minimum} m from Eagle. Actual distance: ${(Math.floor(distance*100)/100).toFixed(2)} m.` };
  return { ready: true, minimum, feedback: "Ready. Carry out the historical surface action below." };
}

import type { PlayerPreferences } from "./campaign/preferences";

export function graphicsRatioBounds(deviceRatio: number, preset: PlayerPreferences["graphics"]) {
  const deviceLimit = Number.isFinite(deviceRatio) && deviceRatio > 0 ? deviceRatio : 1;
  const limit = Math.min(deviceLimit, preset === "quality" ? 1.85 : preset === "battery" ? 1 : 1.45);
  return { limit, floor: Math.min(limit, preset === "battery" ? .7 : .85) };
}

export function adaptiveGraphicsRatio(current: number, bounds: { floor: number; limit: number }, fps: number, targetFps: number) {
  const clamped = Math.max(bounds.floor, Math.min(bounds.limit, current));
  if (fps < targetFps * .78) return Math.max(bounds.floor, clamped - .13);
  if (fps > targetFps * .93) return Math.min(bounds.limit, clamped + .07);
  return clamped;
}

export type GraphicsTrace = {
  preset: PlayerPreferences["graphics"];
  deviceRatio: number;
  ratio: number;
  floor: number;
  limit: number;
  measuredFps: number | null;
  targetFps: number;
};

/** Read-only browser evidence: canvas.dataset.graphicsTrace + a DOM event. */
export function publishGraphicsTrace(canvas: HTMLCanvasElement, trace: GraphicsTrace) {
  canvas.dataset.graphicsTrace = JSON.stringify(trace);
  canvas.dispatchEvent(new CustomEvent("commander-graphics-sample", { detail: Object.freeze({ ...trace }), bubbles: true }));
}

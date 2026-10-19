export type PlayerPreferences = {
  graphics: "quality" | "balanced" | "battery";
  lookSensitivity: number;
  showHints: boolean;
};
export const PREFERENCES_KEY = "orbital-player-settings-v1";
export const defaultPreferences: PlayerPreferences = {
  graphics: "balanced",
  lookSensitivity: 1,
  showHints: true,
};
export function readPreferences(storage?: Pick<Storage, "getItem">): PlayerPreferences {
  try {
    const raw = JSON.parse(storage?.getItem(PREFERENCES_KEY) || "{}");
    return {
      graphics: ["quality", "balanced", "battery"].includes(raw.graphics) ? raw.graphics : "balanced",
      lookSensitivity: typeof raw.lookSensitivity === "number" && Number.isFinite(raw.lookSensitivity)
        ? Math.min(1.8, Math.max(0.4, raw.lookSensitivity)) : 1,
      showHints: typeof raw.showHints === "boolean" ? raw.showHints : true,
    };
  } catch { return {...defaultPreferences}; }
}
export function writePreferences(storage: Pick<Storage, "setItem">, value: PlayerPreferences): void {
  storage.setItem(PREFERENCES_KEY, JSON.stringify(value));
}

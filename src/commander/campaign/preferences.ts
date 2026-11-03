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
function loadPreferences(storage?: Pick<Storage, "getItem">): {
  value: PlayerPreferences; warning: string; readable: boolean;
} {
  if (!storage) return { value: {...defaultPreferences}, readable: false,
    warning: "Browser storage is unavailable. Settings apply in this tab only." };
  try {
    const raw = JSON.parse(storage.getItem(PREFERENCES_KEY) || "{}");
    const value: PlayerPreferences = {
      graphics: ["quality", "balanced", "battery"].includes(raw.graphics) ? raw.graphics : "balanced",
      lookSensitivity: typeof raw.lookSensitivity === "number" && Number.isFinite(raw.lookSensitivity)
        ? Math.min(1.8, Math.max(0.4, raw.lookSensitivity)) : 1,
      showHints: typeof raw.showHints === "boolean" ? raw.showHints : true,
    };
    return { value, readable: true, warning: "" };
  } catch {
    return { value: {...defaultPreferences}, readable: false,
      warning: "Saved settings could not be read and have been kept untouched. Changes apply in this tab only; restore storage access and reload to recover your saved settings." };
  }
}
export function readPreferences(storage?: Pick<Storage, "getItem">): PlayerPreferences {
  return loadPreferences(storage).value;
}
/** Loading never writes defaults. An uncertain initial read stays protected for
 * this mounted game, even if browser access later recovers. */
export function initializePreferences(storage?: Pick<Storage, "getItem" | "setItem">) {
  const loaded = loadPreferences(storage);
  return {
    value: loaded.value,
    warning: loaded.warning,
    save(value: PlayerPreferences): string {
      if (!loaded.readable || !storage) return loaded.warning;
      try { writePreferences(storage, value); return ""; }
      catch { return "Settings could not be saved. Changes apply in this tab only; keep this tab open or allow browser storage."; }
    },
  };
}
export function writePreferences(storage: Pick<Storage, "setItem">, value: PlayerPreferences): void {
  storage.setItem(PREFERENCES_KEY, JSON.stringify(value));
}

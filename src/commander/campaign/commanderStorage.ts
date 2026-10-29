import { loadStore, newStore } from "./save";
import { readPreferences } from "./preferences";

export type CampaignStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const UNSAVED_WARNING =
  "Browser storage is unavailable. You can play in this tab, but progress and settings will not be saved.";

// Accessing localStorage itself can throw (for example, in a sandboxed frame).
// Acquire it once so loading, settings and saving all use the same safe handle.
export function initializeCommander(
  getStorage: () => CampaignStorage | undefined = () => globalThis.localStorage,
) {
  let storage: CampaignStorage | undefined;
  try {
    storage = getStorage();
  } catch {
    /* Continue playing without persistent storage. */
  }
  return {
    storage,
    loaded: storage
      ? loadStore(storage)
      : { store: newStore(), warning: UNSAVED_WARNING, readOnly: false, legacy: false },
    preferences: readPreferences(storage),
  };
}

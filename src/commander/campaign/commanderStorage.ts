import { CampaignSaveRecoveryError, loadStore, newStore, persist, resetStore, SAVE_KEY, type Store } from "./save";
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
  const loaded: ReturnType<typeof loadStore> = storage
    ? loadStore(storage)
    : { store: newStore(), warning: UNSAVED_WARNING, readOnly: false, legacy: false };
  // A blank in-memory fallback must never become permission to overwrite a
  // campaign when a denied/transiently unreadable initial read later recovers.
  // Keep this latch for the lifetime of the mounted Commander, including when
  // unreadable data first appears during an autosave. Only an explicit reset
  // that actually commits may clear it; reloading performs a fresh safe load.
  let saveBlocked = !!loaded.saveBlocked;
  let recoveryPending = "recoveryPrimary" in loaded;
  const saving = {
    save(store: Store): string {
      if (loaded.readOnly) throw Error("A newer campaign save cannot be overwritten.");
      if (saveBlocked) throw new CampaignSaveRecoveryError();
      if (!storage) return UNSAVED_WARNING;
      try {
        // Backup recovery may replace the exact corrupt/missing primary we
        // inspected, never a different primary that recovered in the meantime.
        if (recoveryPending && storage.getItem(SAVE_KEY) !== loaded.recoveryPrimary)
          throw new CampaignSaveRecoveryError();
        const warning = persist(storage, store);
        recoveryPending = false;
        return warning;
      }
      catch (error) {
        if (error instanceof CampaignSaveRecoveryError) saveBlocked = true;
        throw error;
      }
    },
    reset() {
      if (loaded.readOnly) throw Error("A newer campaign save cannot be overwritten.");
      if (!storage) throw Error(UNSAVED_WARNING);
      const result = resetStore(storage);
      saveBlocked = false;
      recoveryPending = false;
      return result;
    },
  };
  return {
    storage,
    loaded,
    saving,
    preferences: readPreferences(storage),
  };
}

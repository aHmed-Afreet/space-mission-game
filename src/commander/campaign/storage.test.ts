import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import CampaignHome from "./CampaignHome";
import { initializeCommander, UNSAVED_WARNING, type CampaignStorage } from "./commanderStorage";
import { defaultPreferences } from "./preferences";
import { canServiceEquipment } from "./maintenance";
import { equipmentServiceCost, serviceEquipment } from "./ship";
import { CampaignSaveRecoveryError, newStore, loadStore, persist, resetStore, SAVE_KEY, SAVE_RECOVERY_WARNING } from "./save";

const BACKUP_KEY = SAVE_KEY + ".backup";
function memoryStorage() {
  const map = new Map<string, string>();
  const operations: string[] = [];
  const storage: CampaignStorage = {
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => { operations.push("set:" + key); map.set(key, value); },
    removeItem: key => { operations.push("remove:" + key); map.delete(key); },
  };
  return { map, operations, storage };
}
function existingCampaign() {
  const state = memoryStorage();
  const current = newStore(), previous = newStore();
  current.progress.tutorials = ["current-flight"];
  previous.progress.tutorials = ["previous-flight"];
  state.map.set(SAVE_KEY, JSON.stringify(current));
  state.map.set(BACKUP_KEY, JSON.stringify(previous));
  return { ...state, current };
}

test("a blocked localStorage getter initializes one playable unsaved campaign with default settings", () => {
  let acquisitions = 0;
  const browser = Object.defineProperty({}, "localStorage", {
    get() { acquisitions++; throw new DOMException("Storage denied", "SecurityError"); },
  }) as { localStorage: Storage };
  const initial = initializeCommander(() => browser.localStorage);
  assert.equal(acquisitions, 1);
  assert.equal(initial.storage, undefined);
  assert.equal(initial.loaded.warning, UNSAVED_WARNING);
  assert.equal(initial.loaded.readOnly, false);
  assert.deepEqual(initial.preferences, defaultPreferences);
  initial.loaded.store.progress.tutorials.push("played-in-memory");
  assert.deepEqual(initial.loaded.store.progress.tutorials, ["played-in-memory"]);
});

test("initialization reuses its acquired storage for progress and preferences", () => {
  const { storage, map } = existingCampaign();
  map.set("orbital-player-settings-v1", JSON.stringify({ graphics: "battery", lookSensitivity: 1.4, showHints: false }));
  let acquisitions = 0;
  const initial = initializeCommander(() => { acquisitions++; return storage; });
  assert.equal(acquisitions, 1);
  assert.equal(initial.storage, storage);
  assert.deepEqual(initial.loaded.store.progress.tutorials, ["current-flight"]);
  assert.deepEqual(initial.preferences, { graphics: "battery", lookSensitivity: 1.4, showHints: false });
});

test("initial read denial stays unsaved after access recovers, preserving primary, backup and unrelated saves", () => {
  const { storage, map, operations } = existingCampaign();
  map.set("orbital-history-progress-v1", "unrelated-earned-story-progress");
  const before = [...map], read = storage.getItem;
  storage.getItem = key => {
    if (key === SAVE_KEY || key === BACKUP_KEY) throw new DOMException("Denied", "SecurityError");
    return read(key);
  };
  const initial = initializeCommander(() => storage);
  assert.equal(initial.loaded.readOnly, false); // Playing in memory remains available.
  assert.equal(initial.loaded.warning, SAVE_RECOVERY_WARNING);
  assert.equal(initial.loaded.store.progress.tutorials.length, 0);
  storage.getItem = read;
  initial.loaded.store.progress.tutorials.push("unsaved-play");
  for (let i = 0; i < 3; i++) assert.throws(() => initial.saving.save(initial.loaded.store), CampaignSaveRecoveryError);
  assert.deepEqual([...map], before);
  assert.deepEqual(operations, []);
  const reloaded = initializeCommander(() => storage);
  assert.deepEqual(reloaded.loaded.store.progress.tutorials, ["current-flight"]);
  assert.equal(reloaded.saving.save(reloaded.loaded.store), "");
});

test("an unreadable primary cannot be replaced by an older readable backup after read recovery", () => {
  const { storage, map, operations } = existingCampaign();
  const before = [...map], read = storage.getItem;
  storage.getItem = key => { if (key === SAVE_KEY) throw Error("Temporarily denied"); return read(key); };
  const initial = initializeCommander(() => storage);
  assert.deepEqual(initial.loaded.store.progress.tutorials, ["previous-flight"]);
  assert.match(initial.loaded.warning, /loaded in memory.*saving is paused/);
  storage.getItem = read;
  assert.throws(() => initial.saving.save(initial.loaded.store), CampaignSaveRecoveryError);
  assert.deepEqual([...map], before);
  assert.deepEqual(operations, []);
});

test("malformed initial reads stay protected even if a later read becomes valid", () => {
  const { storage, map, operations } = existingCampaign();
  const before = [...map], read = storage.getItem;
  storage.getItem = key => key === SAVE_KEY || key === BACKUP_KEY ? "{transient-bad-data" : read(key);
  const initial = initializeCommander(() => storage);
  storage.getItem = read;
  assert.throws(() => initial.saving.save(initial.loaded.store), CampaignSaveRecoveryError);
  assert.deepEqual([...map], before);
  assert.deepEqual(operations, []);
});

test("backup recovery cannot overwrite a primary that reappears after an initially malformed or missing read", () => {
  for (const transientPrimary of ["{transient-bad-data", null]) {
    const { storage, map, operations } = existingCampaign();
    const before = [...map], read = storage.getItem;
    storage.getItem = key => key === SAVE_KEY ? transientPrimary : read(key);
    const initial = initializeCommander(() => storage);
    assert.deepEqual(initial.loaded.store.progress.tutorials, ["previous-flight"]);
    storage.getItem = read;
    assert.throws(() => initial.saving.save(initial.loaded.store), CampaignSaveRecoveryError);
    assert.throws(() => initial.saving.save(initial.loaded.store), CampaignSaveRecoveryError);
    assert.deepEqual([...map], before);
    assert.deepEqual(operations, []);
    assert.deepEqual(initializeCommander(() => storage).loaded.store.progress.tutorials, ["current-flight"]);
  }
});

test("autosave never replaces two unreadable copies and latches protection until reload or explicit reset", () => {
  const { storage, map, operations } = existingCampaign();
  const initial = initializeCommander(() => storage);
  map.set(SAVE_KEY, "{broken-primary");
  map.set(BACKUP_KEY, "{broken-backup");
  const before = [...map];
  assert.throws(() => persist(storage, initial.loaded.store), CampaignSaveRecoveryError);
  assert.throws(() => initial.saving.save(initial.loaded.store), CampaignSaveRecoveryError);
  assert.deepEqual([...map], before);
  assert.deepEqual(operations, []);
  // Another process recovers the original data; the stale mounted fallback
  // still has no permission to overwrite it.
  map.set(SAVE_KEY, JSON.stringify(newStore()));
  assert.throws(() => initial.saving.save(initial.loaded.store), CampaignSaveRecoveryError);
  assert.deepEqual(operations, []);
});

test("only a successfully committed explicit reset clears unreadable-save protection", () => {
  const { storage, map, operations } = existingCampaign();
  map.set(SAVE_KEY, "{broken-primary");
  map.set(BACKUP_KEY, "{broken-backup");
  const before = [...map], initial = initializeCommander(() => storage), write = storage.setItem;
  storage.setItem = () => { throw new DOMException("Full", "QuotaExceededError"); };
  assert.throws(() => initial.saving.reset(), /Full/);
  assert.deepEqual([...map], before);
  assert.throws(() => initial.saving.save(initial.loaded.store), CampaignSaveRecoveryError);
  storage.setItem = write;
  const reset = initial.saving.reset();
  assert.deepEqual(reset.store.progress.tutorials, []);
  assert.equal(reset.warning, "");
  assert.equal(initial.saving.save(reset.store), "");
  assert.deepEqual(operations, ["set:" + SAVE_KEY, "set:" + BACKUP_KEY, "set:" + SAVE_KEY, "set:" + BACKUP_KEY]);
  assert.equal(map.get(SAVE_KEY), JSON.stringify(reset.store));
  assert.equal(map.get(BACKUP_KEY), map.get(SAVE_KEY));
});

test("backup restoration and empty-device saves remain writable through the actual controller", () => {
  for (const primary of ["{broken", undefined]) {
    const { storage, map } = existingCampaign();
    if (primary) map.set(SAVE_KEY, primary); else map.delete(SAVE_KEY);
    const initial = initializeCommander(() => storage);
    assert.match(initial.loaded.warning, /backup was restored/);
    assert.equal(initial.saving.save(initial.loaded.store), "");
    assert.deepEqual(loadStore(storage).store.progress.tutorials, ["previous-flight"]);
  }
  const { storage, map } = memoryStorage();
  const initial = initializeCommander(() => storage);
  assert.equal(initial.loaded.warning, "");
  assert.equal(initial.saving.save(initial.loaded.store), "");
  assert.equal(map.get(SAVE_KEY), JSON.stringify(initial.loaded.store));
});

test("the controller cannot clear protection by resetting or saving a newer campaign", () => {
  for (const futureAtLoad of [false, true]) {
    const { storage, map, operations } = existingCampaign();
    if (futureAtLoad) map.set(SAVE_KEY, '{"version":99,"progress":"future-data"}');
    const initial = initializeCommander(() => storage);
    map.set(SAVE_KEY, '{"version":99,"progress":"future-data"}');
    const before = [...map];
    assert.throws(() => initial.saving.reset(), /newer campaign save/);
    assert.throws(() => initial.saving.save(initial.loaded.store), /newer campaign save/);
    assert.deepEqual([...map], before);
    assert.deepEqual(operations, []);
  }
});

test("failed reset and autosave primary writes preserve both original keys and live progress", () => {
  for (const operation of ["reset", "autosave"] as const) {
    const { storage, map, current, operations } = existingCampaign();
    const before = [...map];
    storage.setItem = key => { operations.push("attempt:" + key); throw new DOMException("Full", "QuotaExceededError"); };
    let live = current;
    assert.throws(() => {
      if (operation === "reset") live = resetStore(storage).store;
      else persist(storage, newStore());
    }, /Full/);
    assert.equal(live, current);
    assert.deepEqual([...map], before);
    assert.deepEqual(operations, ["attempt:" + SAVE_KEY]);
  }
});

test("reset and autosave protect newer primary or backup saves, including changes after load", () => {
  for (const key of [SAVE_KEY, BACKUP_KEY]) {
    for (const operation of ["reset", "autosave"] as const) {
      const { storage, map, current, operations } = existingCampaign();
      assert.equal(loadStore(storage).readOnly, false);
      map.set(key, '{"version":99,"progress":"future-data"}');
      const before = [...map];
      assert.equal(loadStore(storage).readOnly, true);
      assert.throws(() => operation === "reset" ? resetStore(storage) : persist(storage, current), /newer campaign save/);
      assert.deepEqual([...map], before);
      assert.deepEqual(operations, []);
    }
  }
});

test("saving commits primary before rotating the last valid checkpoint into backup", () => {
  const { storage, map, operations } = existingCampaign();
  const previous = map.get(SAVE_KEY);
  const next = newStore();
  next.progress.tutorials = ["new-flight"];
  assert.equal(persist(storage, next), "");
  assert.deepEqual(operations, ["set:" + SAVE_KEY, "set:" + BACKUP_KEY]);
  assert.equal(map.get(SAVE_KEY), JSON.stringify(next));
  assert.equal(map.get(BACKUP_KEY), previous);
});

test("a corrupt or absent primary recovers backup and corrupt data never overwrites that backup", () => {
  for (const primary of ["{broken", undefined]) {
    const { storage, map } = existingCampaign();
    const originalBackup = map.get(BACKUP_KEY);
    if (primary === undefined) map.delete(SAVE_KEY);
    else map.set(SAVE_KEY, primary);
    const loaded = loadStore(storage);
    assert.match(loaded.warning, /backup was restored/);
    assert.deepEqual(loaded.store.progress.tutorials, ["previous-flight"]);
    assert.equal(persist(storage, loaded.store), "");
    assert.equal(map.get(BACKUP_KEY), originalBackup);
  }
});

test("an invalid backup is ignored when loading a valid primary and can be repaired by saving", () => {
  const { storage, map } = existingCampaign();
  map.set(BACKUP_KEY, "{broken");
  const loaded = loadStore(storage);
  assert.deepEqual(loaded.store.progress.tutorials, ["current-flight"]);
  assert.equal(loaded.warning, "");
  const previous = map.get(SAVE_KEY);
  persist(storage, loaded.store);
  assert.equal(map.get(BACKUP_KEY), previous);
});

test("successful reset commits fresh progress and replaces stale recovery data", () => {
  const { storage, map, operations } = existingCampaign();
  const result = resetStore(storage);
  assert.equal(result.warning, "");
  assert.deepEqual(result.store.progress.tutorials, []);
  assert.deepEqual(operations, ["set:" + SAVE_KEY, "set:" + BACKUP_KEY]);
  assert.equal(map.get(SAVE_KEY), JSON.stringify(result.store));
  assert.equal(map.get(BACKUP_KEY), map.get(SAVE_KEY));
  map.set(SAVE_KEY, "{broken");
  assert.deepEqual(loadStore(storage).store.progress.tutorials, []);
});

test("reset clears stale backup after backup replacement is denied and reports the committed reset", () => {
  const { storage, map } = existingCampaign();
  const setItem = storage.setItem;
  storage.setItem = (key, value) => {
    if (key === BACKUP_KEY) throw new DOMException("Backup write denied", "SecurityError");
    setItem(key, value);
  };
  const result = resetStore(storage);
  assert.match(result.warning, /reset was saved.*backup could not be created/);
  assert.equal(map.get(SAVE_KEY), JSON.stringify(result.store));
  assert.equal(map.has(BACKUP_KEY), false);
});

test("denied backup cleanup keeps the committed reset and reports stale backup risk across autosaves", () => {
  const { storage, map } = existingCampaign();
  const originalBackup = map.get(BACKUP_KEY), setItem = storage.setItem;
  storage.setItem = (key, value) => {
    if (key === BACKUP_KEY) throw new DOMException("Backup write denied", "SecurityError");
    setItem(key, value);
  };
  storage.removeItem = () => { throw new DOMException("Backup delete denied", "SecurityError"); };
  const result = resetStore(storage);
  assert.match(result.warning, /reset was saved.*older recovery backup could not be cleared/);
  assert.equal(map.get(SAVE_KEY), JSON.stringify(result.store));
  assert.equal(map.get(BACKUP_KEY), originalBackup);
  assert.match(persist(storage, result.store), /Progress was saved.*older backup may remain/);
  assert.equal(map.get(BACKUP_KEY), originalBackup);
});

test("equipment at zero condition is eligible for affordable servicing between flights", () => {
  assert.equal(canServiceEquipment(0, 2, null), true);
  assert.equal(canServiceEquipment(0, 1.99, null), false);
  assert.equal(canServiceEquipment(undefined, 10, null), false);
  assert.equal(canServiceEquipment(100, 10, null), false);
  assert.equal(canServiceEquipment(0, 10, { report: undefined }), false);
  const progress = newStore().progress;
  progress.equipmentCondition = { scanner: 0 };
  progress.economy.balance = 2;
  const serviced = serviceEquipment(progress, "scanner");
  assert.equal(serviced.equipmentCondition?.scanner, 100);
  assert.equal(serviced.economy.balance, 2 - equipmentServiceCost(0));

  const html = renderToStaticMarkup(createElement(CampaignHome, {
    progress, session: null, legacy: false, warning: "", readOnly: false,
    selectedRoute: null, setSelectedRoute: () => {}, onSelect: () => {},
    onResume: () => {}, onLegacy: () => {}, onExit: () => {},
  }));
  assert.match(html, /0\.0%<\/span><button>Service · \$2\.00M<\/button>/);
});

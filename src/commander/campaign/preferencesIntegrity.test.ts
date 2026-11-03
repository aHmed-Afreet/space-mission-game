import { test } from "node:test";
import assert from "node:assert/strict";
import { initializeCommander } from "./commanderStorage";
import { defaultPreferences, initializePreferences, PREFERENCES_KEY } from "./preferences";

const saved = { graphics: "battery" as const, lookSensitivity: 1.4, showHints: false };
function fixture() {
  const map = new Map([[PREFERENCES_KEY, JSON.stringify(saved)], ["other-mode-save", "earned-data"]]);
  const writes: string[] = [];
  const storage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { writes.push(key); map.set(key, value); },
    removeItem: (key: string) => { map.delete(key); },
  };
  return { map, writes, storage };
}
test("Commander preference loading never writes or normalizes saved bytes automatically", () => {
  const { map, storage, writes } = fixture(), before = [...map];
  const initial = initializeCommander(() => storage);
  assert.deepEqual(initial.preferences, saved);
  assert.equal(initial.preferencesSaving.warning, "");
  assert.deepEqual([...map], before);
  assert.deepEqual(writes, []);
  const next = { ...saved, graphics: "quality" as const };
  assert.equal(initial.preferencesSaving.save(next), "");
  assert.deepEqual(writes, [PREFERENCES_KEY]);
  assert.equal(map.get(PREFERENCES_KEY), JSON.stringify(next));
  assert.equal(map.get("other-mode-save"), "earned-data");
});
test("denied initial settings read cannot overwrite recovered preferences, even after an explicit in-tab edit", () => {
  const { map, storage, writes } = fixture(), before = [...map], get = storage.getItem;
  storage.getItem = key => { if (key === PREFERENCES_KEY) throw new DOMException("Denied", "SecurityError"); return get(key); };
  const initial = initializeCommander(() => storage);
  assert.deepEqual(initial.preferences, defaultPreferences);
  assert.match(initial.preferencesSaving.warning, /kept untouched.*this tab only/);
  storage.getItem = get;
  assert.match(initial.preferencesSaving.save({ ...saved, graphics: "quality" }), /reload/);
  assert.deepEqual([...map], before);
  assert.deepEqual(writes, []);
  const reloaded = initializeCommander(() => storage);
  assert.deepEqual(reloaded.preferences, saved);
  assert.equal(reloaded.preferencesSaving.save({ ...saved, graphics: "quality" }), "");
});
test("corrupt saved settings remain untouched until a safe new load", () => {
  const { map, storage, writes } = fixture();map.set(PREFERENCES_KEY, "{broken");
  const initial = initializePreferences(storage);
  assert.deepEqual(initial.value, defaultPreferences);
  assert.match(initial.save(saved), /could not be read/);
  assert.equal(map.get(PREFERENCES_KEY), "{broken");
  map.set(PREFERENCES_KEY, JSON.stringify(saved));
  assert.match(initial.save(defaultPreferences), /reload/);
  assert.deepEqual(writes, []);
  assert.deepEqual(initializePreferences(storage).value, saved);
});
test("failed preference writes report in-tab settings without altering stored settings", () => {
  const { map, storage } = fixture(), before = [...map], initial = initializePreferences(storage);
  storage.setItem = () => { throw new DOMException("Full", "QuotaExceededError"); };
  assert.match(initial.save(defaultPreferences), /could not be saved.*this tab only/);
  assert.deepEqual([...map], before);
});
test("unavailable and genuinely new storage stay usable without automatic writes", () => {
  const absent = initializePreferences();
  assert.deepEqual(absent.value, defaultPreferences);
  assert.match(absent.save(saved), /storage is unavailable/);
  const { map, storage, writes } = fixture();map.delete(PREFERENCES_KEY);
  const fresh = initializePreferences(storage);
  assert.deepEqual(fresh.value, defaultPreferences);
  assert.deepEqual(writes, []);
  assert.equal(fresh.save(saved), "");
  assert.equal(map.get(PREFERENCES_KEY), JSON.stringify(saved));
});
test("supported partial preferences retain legacy clamping without rewriting the original on load", () => {
  const { map, storage, writes } = fixture();map.set(PREFERENCES_KEY, '{"graphics":"unknown","lookSensitivity":99,"showHints":null}');
  const before = map.get(PREFERENCES_KEY), initial = initializePreferences(storage);
  assert.deepEqual(initial.value, { graphics: "balanced", lookSensitivity: 1.8, showHints: true });
  assert.equal(map.get(PREFERENCES_KEY), before);
  assert.deepEqual(writes, []);
});

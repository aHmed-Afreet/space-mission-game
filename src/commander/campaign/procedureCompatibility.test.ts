import test from "node:test";
import assert from "node:assert/strict";
import baseline from "./objectiveIdentity.fixture.json";
import { missions, missionById, missionForSession, TEMPERATURE_OBJECTIVE_ID } from "./definitions";
import { createSession, emptyProgress, launchMission, makeReport } from "./engine";
import { decodeStore, loadStore, newStore, persist, SAVE_KEY } from "./save";
import { nominalCondition } from "./ship";

test("the approved temperature addition preserves every existing mission and objective ID", () => {
  assert.deepEqual(missions.map(m => m.id), Object.keys(baseline));
  assert.equal(missions.reduce((sum, m) => sum + m.objectives.length, 0), 798);
  for (const m of missions) {
    const old = baseline[m.id as keyof typeof baseline];
    assert.deepEqual(m.objectives.filter(o => o.id !== TEMPERATURE_OBJECTIVE_ID).map(o => o.id), old.ids, m.id);
    assert.equal(m.revision, m.id === "mission-7" ? 4 : old.revision);
    assert.equal(new Set(m.objectives.map(o => o.id)).size, m.objectives.length);
  }
  const latest = missionById("mission-7");
  assert.equal(latest.objectives.length, 59);
  const measurement = latest.objectives.find(o => o.id === TEMPERATURE_OBJECTIVE_ID)!;
  assert.equal(measurement.action, "measureTemperature");
  assert.equal(measurement.site, "survey");
  assert.ok(latest.requiredEquipment.includes("sensor"));
  assert.ok(latest.objectives.indexOf(measurement) < latest.objectives.findIndex(o => o.phase === "EVA RETURN"));
});

test("active revision-3 Mission 7 retains its exact 58-step protocol instead of being silently renumbered", () => {
  const old = missionForSession({ missionId: "mission-7", revision: 3 });
  assert.equal(old.revision, 3);
  assert.deepEqual(old.objectives.map(o => o.id), baseline["mission-7"].ids);
  assert.equal(old.objectives.some(o => o.action === "measureTemperature"), false);
  assert.equal(missionForSession({ missionId: "mission-7", revision: 4 }), missionById("mission-7"));
  assert.throws(() => missionForSession({ missionId: "mission-7", revision: 99 }), /Unsupported/);
});

function oldFlight() {
  const store = newStore(), progress = emptyProgress();
  progress.condition = nominalCondition();
  // Isolated compatibility fixture, not an earned gameplay completion.
  for (const id of ["mission-3", "mission-5"]) {
    const previous = missionById(id);
    progress.completed[id] = makeReport(createSession(previous, store.design, store.life, previous.requiredEquipment, progress), true);
  }
  const old = missionForSession({ missionId: "mission-7", revision: 3 });
  const launched = launchMission(old, store.design, store.life, old.requiredEquipment, progress);
  return { ...store, ...launched };
}

test("legacy checkpoints before, during and after the new task position retain progress, finance and physical state", () => {
  for (const index of [0, 40, 57]) {
    const fixture = oldFlight(), s = fixture.session;
    s.objective = index;
    s.completed = missionForSession(s).objectives.slice(0, index).map(o => o.id);
    s.observations.achieved = [...s.completed];
    s.state.paused = true;
    const original = structuredClone(fixture);
    const decoded = decodeStore(JSON.stringify(fixture));
    assert.deepEqual(decoded, original);
    assert.equal(missionForSession(decoded.session!).objectives.length, 58);
    assert.equal(decoded.session!.measurements?.length ?? 0, 0, "loading never fabricates temperature data");
  }
});

test("newer mission procedures and report metrics are protected even when the outer storage version remains 3", () => {
  for (const target of ["primary", "backup", "report"] as const) {
    const future = oldFlight();
    if (target === "report") future.progress.completed["mission-5"].metricVersion = 99 as 2;
    else future.session.revision = 99;
    const encoded = JSON.stringify(future), values = new Map<string, string>();
    values.set(SAVE_KEY, target === "backup" ? JSON.stringify(newStore()) : encoded);
    values.set(SAVE_KEY + ".backup", target === "backup" ? encoded : JSON.stringify(newStore()));
    let writes = 0;
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: () => { writes++; } };
    assert.equal(loadStore(storage).readOnly, true);
    assert.throws(() => persist(storage, newStore()), /newer campaign save/);
    assert.equal(writes, 0);
  }
});

test("optional procedure and scientific records are validated without requiring invented legacy records", () => {
  const fixture = oldFlight();
  delete fixture.session.measurements;
  delete fixture.session.observations.airlockProcedure;
  assert.ok(decodeStore(JSON.stringify(fixture)).session);
  for (const invalid of [
    (s: typeof fixture.session) => { s.measurements = [{}] as never; },
    (s: typeof fixture.session) => { s.observations.airlockProcedure = { version: 99 } as never; },
  ]) {
    const changed = structuredClone(fixture); invalid(changed.session);
    assert.throws(() => decodeStore(JSON.stringify(changed)), /Invalid.*(scientific|airlock)/);
  }
});

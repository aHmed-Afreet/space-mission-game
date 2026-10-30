import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { missionById, missionForSession, missions, type CampaignAction } from "./definitions";
import { command, createSession, currentObjective, emptyProgress, evaluate, makeReport, recordReport, sitePosition, tickSession, type Report as Result, type Session, type Progress } from "./engine";
import { defaultDesign, defaultLife } from "../simulation";
import { fieldGear, fieldToolUse, FIELD_TOOL_POWER_RESERVE } from "./fieldTools";
import { equipment, type EquipmentId } from "./equipment";
import { observe, satisfied, validAirlockProcedure } from "./observations";
import { recoveryMission } from "./recovery";
import { objectiveGuide } from "./objectiveGuide";
import { decodeStore, newStore } from "./save";
import { bookLaunch, financialReport } from "./economy";
import { serviceEquipment } from "./ship";
import { validScientificMeasurement } from "./scientificResults";
import { validConditionSnapshot } from "./reportMetrics";
import Report from "./Report";

// Isolated model fixtures exercise boundaries and compatibility. They do not
// certify native UI completion, full flight feasibility or any mission PASS.
const evaMissions = missions.filter(m => m.eva);
function fixture(id = "mission-3"): Session {
  const mission = missionById(id), p = emptyProgress();
  for (const m of missions) if (m.id !== id) p.completed[m.id] = { success: true } as Result;
  return createSession(mission, defaultDesign, defaultLife, mission.requiredEquipment, p);
}
function field(id = "mission-3", item: EquipmentId = "scanner"): Session {
  const s = fixture(id), mission = missionForSession(s);
  s.pack = [...new Set([item, "containers"] as EquipmentId[])];
  s.world.stored = s.world.stored.filter(id => !s.pack.includes(id));
  s.position = { ...sitePosition("survey", mission.destination), heading: 0 };
  s.objective = mission.objectives.findIndex(o => o.phase === "EVA RETURN");
  s.objective--; // keep the science target optional, without changing its ID.
  s.flight.status = "orbit"; s.landed = mission.surface;
  s.suit = { equipped: true, oxygen: .35, power: 1, condition: 100, oxygenChecked: true, powerChecked: true };
  s.airlock = { inner: false, outer: true, pressure: 0, cycling: null };
  s.state.paused = false;
  return s;
}
function reload(s: Session, progress?: Progress) {
  const store = newStore(); store.session = s;
  if (progress) store.progress = progress;
  else {
    // Valid, explicitly synthetic prerequisite reports for isolated persistence checks.
    const template = makeReport(s, true);
    for (const m of missions) if (m.id !== s.missionId) store.progress.completed[m.id] = {
      ...template, missionId: m.id, missionRevision: m.revision, runId: `model-prerequisite-${m.id}`,
    };
  }
  store.progress = bookLaunch(store.progress,s);
  const loaded = decodeStore(JSON.stringify(store)).session!;
  loaded.state.paused = s.state.paused; // simulate the user's explicit Resume after loading.
  return loaded;
}
function exactSameOperationState(a: Session, b: Session) {
  assert.equal(b.state.science, a.state.science);
  assert.equal(b.suit.power, a.suit.power);
  assert.deepEqual(b.world.equipment, a.world.equipment);
  assert.deepEqual(b.experiments, a.experiments);
  assert.deepEqual(b.measurements, a.measurements);
  assert.equal(b.world.rng, a.world.rng);
}

test("U11 zero remains broken in every EVA mission; rejected actions earn no science or free restoration", () => {
  assert.equal(evaMissions.length, 9);
  for (const mission of evaMissions) {
    const s = field(mission.id);
    s.world.equipment.scanner = 0;
    const before = reload(s), after = command(before, "scan");
    exactSameOperationState(before, after);
    assert.match(after.notice, /broken \(0% condition\).*paid Equipment service/);
    assert.equal(reload(after).world.equipment.scanner, 0);
    const objective = mission.objectives.findIndex(o => o.action === "scan");
    if (objective >= 0) {
      s.objective = objective;
      assert.match(recoveryMission(s)!.cause, /broken/);
    }
  }
  const p = emptyProgress(); p.equipmentCondition = { scanner: 0 };
  const serviced = serviceEquipment(p, "scanner");
  assert.equal(serviced.equipmentCondition!.scanner, 100);
  assert.equal(serviced.economy.balance, p.economy.balance - 2);
  assert.equal(serviced.economy.ledger.length, p.economy.ledger.length + 1);
});

test("U11 every field-tool handler rejects its broken required instrument before wear, power or science changes", () => {
  for (const [action, item] of Object.entries(fieldGear) as [CampaignAction, EquipmentId][]) {
    const s = field(action === "repairSatellite" ? "mission-2" : "mission-3", item);
    s.world.equipment[item] = 0;
    if (action === "repairCamp" || action === "experiment" || action.startsWith("deploy"))
      s.position = { ...sitePosition("camp", missionForSession(s).destination), heading: 0 };
    const after = command(s,action);
    exactSameOperationState(s,after);
    assert.match(after.notice,/broken/);
  }
});

test("U11 positive and absent tool conditions use nullish defaults without reviving near-zero wear", () => {
  for (const value of [0.01, 5, 50, 100, undefined]) {
    const s = field();
    if (value === undefined) delete s.world.equipment.scanner;
    else s.world.equipment.scanner = value;
    const use = fieldToolUse(s, "scan")!;
    assert.equal(use.condition, value ?? 100);
    const after = command(s, "scan");
    assert.equal(after.state.science, s.state.science + 15);
    assert.equal(after.world.equipment.scanner, (value ?? 100) >= 5 ? Math.max(5, (value ?? 100) - .15) : Math.max(0, (value ?? 100) - .15));
    assert.equal(after.suit.power, s.suit.power - use.powerCost);
  }
});

test("U12 all powered field actions share exact wear cost and explicit reserve across nine EVA flights", () => {
  const actions: CampaignAction[] = ["scan", "drill", "photo", "measureTemperature", "measureRadiation", "experiment", "deployAntenna", "deploySensor", "repairCamp", "repairSatellite", "testSatellite"];
  for (const mission of evaMissions) for (const action of actions) {
    if (["repairSatellite", "testSatellite"].includes(action) && mission.surface) continue;
    const item = fieldGear[action];
    const s = field(mission.id, item ?? "scanner");
    if (item) s.world.equipment[item] = 50;
    s.camp = { ...s.camp, shelter: true, battery: true, power: .5, broken: action === "repairCamp" };
    s.systems = { ...s.systems, satelliteDiagnosed: true, satelliteRepaired: action === "testSatellite" };
    s.observations.campDiagnosed = true;
    s.state.parts = 2;
    // Deployments/camp repairs have their own real worksite guard.
    if (["experiment", "deployAntenna", "deploySensor", "repairCamp"].includes(action))
      s.position = { ...sitePosition("camp", mission.destination), heading: 0 };
    const cost = fieldToolUse(s, action)!.powerCost;
    for (const power of [cost - .00001, cost, cost + FIELD_TOOL_POWER_RESERVE - .0000001]) {
      s.suit.power = power;
      const after = command(s, action);
      exactSameOperationState(s, after);
      assert.match(after.notice, /explicit 0\.100% remaining reserve/);
    }
    s.suit.power = cost + FIELD_TOOL_POWER_RESERVE;
    const after = command(s, action);
    assert.ok(Math.abs(after.suit.power - FIELD_TOOL_POWER_RESERVE) < 1e-12, `${mission.id}/${action}: ${after.notice}`);
    assert.equal(tickSession(after, .5).report, undefined, `${mission.id}/${action} did not immediately exhaust an accepted tool action`);
  }
});

test("U12 exact .025 scanner repro rejects atomically; zero-power gear has no invented reserve cost", () => {
  const s = field(); s.world.equipment.scanner = 50; s.suit.power = .025;
  exactSameOperationState(s, command(s, "scan"));
  const use = fieldToolUse(s, "scan")!;
  assert.equal(use.powerCost, .03); assert.equal(use.requiredPower, .031);
  const o = missionForSession(s).objectives.findIndex(o => o.action === "scan");
  s.objective = o;
  assert.match(recoveryMission(s)!.cause, /3\.100%.*3\.000%/);
  assert.match(objectiveGuide(s).steps.map(v => v.text).join(" "), /0\.100%/);
  const sample = field("mission-3", "containers"); sample.suit.power = 0;
  const before = sample.suit.power, after = command(sample, "sample");
  assert.equal(after.samples.length, 1); assert.equal(after.suit.power, before);
  assert.equal(fieldToolUse(sample, "sample")!.reserve, 0);
});

function returnFixture(id: string): Session {
  let s = field(id);
  const mission = missionForSession(s);
  s.objective = mission.objectives.findIndex(o => o.phase === "EVA RETURN");
  s = observe(s); // establish exterior crossing, then return to the chamber.
  s.position = { x: 0, z: 9, heading: 0 };
  return evaluate(s);
}
function finishPressureCycle(s: Session): Session {
  for (let count = 0; count < 20 && s.airlock.cycling; count++) s = tickSession(s, .5);
  return s;
}

test("U14 current-cycle receipts and safe present state govern return in all nine EVA missions", () => {
  for (const mission of evaMissions) {
    let s = returnFixture(mission.id);
    assert.equal(currentObjective(s)!.action, "closeOuter");
    s.observations.achieved.push(...mission.objectives.filter(o => o.phase === "EVA RETURN" && o.action).map(o => o.id));
    assert.equal(evaluate(s).objective, s.objective, "stale achieved IDs cannot close an open hatch");
    s = reload(command(s, "closeOuter"));
    assert.equal(currentObjective(s)!.action, "pressurize");
    s = reload(command(s, "pressurize"));
    assert.equal(currentObjective(s)!.condition, "pressurized");
    assert.equal(s.airlock.cycling, "pressurize");
    assert.equal(command(s, "openInner").airlock.inner, false);
    const oxygen = s.state.oxygen;
    assert.equal(command(s, "pressurize").state.oxygen, oxygen, "repeated pump clicks cannot charge twice");
    s = reload(finishPressureCycle(s));
    assert.equal(currentObjective(s)!.action, "openInner");
    assert.equal(s.airlock.inner, false, "an earlier receipt cannot open the current hatch");
    s = reload(command(s, "openInner"));
    assert.equal(s.airlock.inner, true);
    assert.equal(currentObjective(s)!.type, "RETURN");
    assert.ok(validAirlockProcedure(s.observations.airlockProcedure));
  }
});

test("U14 service detours cannot pre-credit later return; a repeated excursion clears old receipts", () => {
  for (const mission of evaMissions) {
    let s = field(mission.id);
    const missionReturn = mission.objectives.findIndex(o => o.phase === "EVA RETURN");
    const pendingFieldTask = s.objective;
    s = observe(s);
    s.position = { x: 0, z: 9, heading: 0 }; s = evaluate(s);
    s = command(s, "closeOuter"); s = command(s, "pressurize"); s = finishPressureCycle(s);
    s = command(s, "openInner");
    assert.equal(s.objective, pendingFieldTask, "service actions cannot finish a future checklist");
    const future = mission.objectives.slice(missionReturn).filter(o => ["closeOuter", "pressurize", "openInner"].includes(o.action ?? ""));
    for (const o of future) assert.ok(!s.observations.achieved.includes(o.id));
    // Real commands produce a new vacuum excursion while the field task stays pending.
    s.position = { x: 0, z: 7, heading: 0 }; s = observe(s);
    s.position = { x: 0, z: 9, heading: 0 }; s = observe(s);
    s = command(s, "closeInner"); s = command(s, "vent"); s = finishPressureCycle(s); s = command(s, "openOuter");
    s.position = { ...sitePosition("survey", mission.destination), heading: 0 }; s = observe(s);
    s = reload(s); s.objective = missionReturn;
    s.position = { x: 0, z: 9, heading: 0 }; s = evaluate(s);
    assert.equal(currentObjective(s)!.action, "closeOuter"); assert.equal(s.airlock.outer, true);
    assert.equal(s.airlock.pressure, 0); assert.equal(s.airlock.cycling, null);
    assert.equal(s.observations.airlockProcedure!.receipts.pressurize, undefined);
  }
});

test("U14 outbound vacuum waits reject sticky history and old receipts in all nine missions", () => {
  for (const mission of evaMissions) {
    const s = field(mission.id);
    const vacuum = mission.objectives.findIndex(o => o.condition === "vacuum");
    s.objective = vacuum; s.position = { x: 0, z: 9, heading: 0 };
    s.airlock = { inner: false, outer: false, pressure: 101.3, cycling: null };
    s.observations.vacuum = true;
    s.observations.achieved.push(mission.objectives[vacuum].id);
    assert.equal(satisfied(s, mission.objectives[vacuum]), false);
    assert.match(recoveryMission(s)!.next, /Depressurize/);
    let venting = command(s, "vent");
    assert.equal(currentObjective(venting)!.condition, "vacuum");
    venting = reload(finishPressureCycle(venting));
    assert.equal(currentObjective(venting)!.action, "openOuter");
  }
});

test("U14 exact genuine legacy Mission 2 unsafe WAIT resumes through normal controls without rewinding progress", () => {
  const raw = readFileSync(new URL("./testFixtures/u14-legacy-stuck-mission-2.json", import.meta.url), "utf8");
  const store = decodeStore(raw);
  let s = store.session!;
  assert.equal(s.missionId, "mission-2");
  assert.equal(s.objective, 35); // actual retained audit checkpoint: task 36.
  assert.equal(currentObjective(s)!.condition, "pressurized");
  assert.deepEqual(s.airlock, { inner: false, outer: true, pressure: 0, cycling: null });
  const earned = [...s.completed], reports = structuredClone(store.progress);
  s.state.paused = false;
  assert.equal(evaluate(s).objective, 35);
  assert.match(objectiveGuide(s).next, /Close the outside hatch/);
  s = command(s, "closeOuter"); s = reload(s, store.progress);
  s = command(s, "pressurize"); s = reload(s, store.progress);
  s = finishPressureCycle(s);
  assert.equal(currentObjective(s)!.action, "openInner");
  assert.equal(s.airlock.inner, false);
  s = command(s, "openInner");
  assert.equal(s.airlock.inner, true);
  assert.ok(earned.every(id => s.completed.includes(id)));
  assert.deepEqual(store.progress, reports, "compatibility recovery does not rewrite archived reports or economy");
});

test("U10 v2 reports snapshot real wear and faults for missions 15–18; metric, score and finance independently reconcile", () => {
  for (const [index, id] of ["mission-15", "mission-16", "mission-17", "mission-18"].entries()) {
    const s = fixture(id);
    s.world.condition.power = 76 - 8 * index;
    s.world.condition.lifeSupport = 84 - 12 * index;
    s.world.faults.push({ id: "cooling-unverified", kind: "cooling", diagnosed: true, repaired: false, verified: false, at: 0 });
    s.state.malfunction = false;
    const r = makeReport(s, true);
    const expected = (500 + s.world.condition.power + s.world.condition.lifeSupport) / 7 - 5;
    assert.equal(r.metricVersion, 2); assert.equal(r.condition, expected);
    assert.ok(r.condition < 100); assert.ok(validConditionSnapshot(r.conditionSnapshot));
    const w = missionForSession(s).scoring;
    const score = Math.round(r.science*w.science*.6 + r.resources*w.resources*.6 + r.crew*w.crew*.6 + r.power*.1 + r.fuel*.1 + r.communications*.1 + expected*.1);
    assert.equal(r.score, score);
    assert.deepEqual(r.finance, financialReport(s, missionForSession(s), true, r.optionalResults.filter(o => o.complete).reduce((n,o) => n+o.reward,0)));
    const f = r.finance!;
    assert.equal(f.after, Math.round((f.before+f.allocation+f.assistance-f.cost+f.earned+f.insurance-f.repair)*100)/100);
    const saved = structuredClone(r.conditionSnapshot);
    s.report = r; const p = recordReport(bookLaunch(emptyProgress(),s),s);
    assert.equal(p.condition!.power, s.world.condition.power);
    assert.equal(recordReport(p,s).economy.balance, p.economy.balance, "settlement remains exact-once");
    s.world.condition.power = 100;
    assert.deepEqual(r.conditionSnapshot, saved, "later hardware cannot alter a debrief");
    assert.deepEqual(reload(s).report!.conditionSnapshot, saved);
  }
});

test("U10 stowing a worn suit cannot hide equipment condition; legacy reports retain original metrics and bests", () => {
  const s = fixture("mission-3"); s.world.equipment.suit = 35; s.suit.condition = 35;
  s.suit.equipped = false;
  const r = makeReport(s, true);
  assert.equal(r.conditionSnapshot!.equipment.suit,35);
  const legacy = { ...r, score: 99, condition: 100 };
  delete legacy.metricVersion; delete legacy.conditionSnapshot; delete legacy.missionRevision; delete legacy.measurements;
  const p = emptyProgress(); p.completed[s.missionId] = legacy; p.history = [legacy];
  s.report = r;
  const next = recordReport(p,s);
  assert.equal(next.completed[s.missionId],legacy);
  assert.equal(legacy.condition,100);
  assert.match(renderToStaticMarkup(Report({result:legacy,onHome(){}})), /Legacy condition metric/);
  assert.match(renderToStaticMarkup(Report({result:r,onHome(){}})), /35\.00%/);
});

test("structured science records only successful actions, preserves independent RNG and acknowledges actual downlinks", () => {
  let s = field(); s.world.equipment.scanner = 50;
  const rng = s.world.rng, state = structuredClone(s);
  s = command(s,"scan");
  assert.equal(s.measurements!.length,1); assert.equal(s.world.rng,rng);
  assert.deepEqual(command(state,"scan").measurements,s.measurements,"instrument model is deterministic");
  assert.ok(validScientificMeasurement(s.measurements![0]));
  assert.equal(s.measurements![0].transmission,"onboard");
  assert.equal(s.measurements![0].quality,"degraded");
  s.position={x:1.1,z:-3.1,heading:0};
  s=command(s,"comms");
  assert.equal(s.measurements![0].transmission,"queued");
  assert.equal(s.measurements![0].acknowledgedAt,undefined);
  s=tickSession(s,2);
  assert.equal(s.measurements![0].transmission,"acknowledged");
  s=reload(s);
  assert.ok(validScientificMeasurement(s.measurements![0]));
  const r=makeReport(s,true);
  assert.deepEqual(r.measurements,s.measurements);
  s.measurements![0].value=999;
  assert.notEqual(r.measurements![0].value,999,"report readings snapshot rather than alias active data");
});

test("new Mission 7 temperature action retains a readable result; legacy experiment strings never acquire invented readings", () => {
  let s=field("mission-7","sensor");
  const m=missionForSession(s);
  s.objective=m.objectives.findIndex(o=>o.action==="measureTemperature");
  assert.equal(s.revision,4); assert.ok(s.objective>=0);
  const unmeasured = structuredClone(s);
  unmeasured.observations.achieved.push(m.objectives[s.objective].id);
  assert.equal(evaluate(unmeasured).objective, s.objective, "new temperature task cannot be satisfied by an ID without its reading");
  s=command(s,"measureTemperature");
  assert.equal(s.measurements!.at(-1)!.unit,"°C");
  assert.match(s.measurements!.at(-1)!.assumptions.join(" "),/fixed -30 °C scenario preset/);
  assert.ok(s.completed.includes("mission-7-temperature-v4"));
  const old=fixture("mission-7"); old.revision=3; delete old.measurements; old.experiments=["scan / moon / survey"];
  const r=makeReport(old,true);
  assert.equal(r.measurements,undefined);
  assert.equal(r.experiments,1);
  const html=renderToStaticMarkup(Report({result:r,onHome(){}}));
  assert.match(html,/Legacy Mission 7 revision 3/); assert.match(html,/numeric data has not been reconstructed/);
});

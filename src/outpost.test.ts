import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTIONS, MISSION_LENGTH, advanceSol, availableAction, forecast, initialOutpost,
  isValidOutpost, missionCriteria, perform, projectPower, setPriority,
  type Action, type Destination, type Outpost,
} from "./outpost/engine";

test("both destinations start with safe, independently owned resources", () => {
  const moon = initialOutpost("moon");
  const mars = initialOutpost("mars");
  assert.equal(moon.phase, "active");
  assert.equal(mars.phase, "active");
  assert.notEqual(moon.battery, mars.battery);
  assert.notEqual(moon, initialOutpost("moon"));
  assert.equal(moon.sol, 1);
  assert.equal(moon.selected, null);
});

test("solar array upgrades improve available power", () => {
  const start = initialOutpost("moon");
  const upgrade = perform(start, "solar");
  assert.equal(start.solar, 2, "original remains immutable");
  assert.equal(upgrade.solar, 3);
  assert.equal(upgrade.credits, start.credits - 20);
  assert.ok(projectPower(upgrade).generation > projectPower(start).generation);
});

test("lunar night has no solar production regardless of array capacity", () => {
  const s = { ...initialOutpost("moon"), sol: 5, solar: 5 };
  assert.equal(forecast("moon", 5).sunlight, 0);
  assert.equal(projectPower(s).generation, 0);
  assert.ok(projectPower(s).demand > projectPower(initialOutpost("moon")).demand);
});

test("Martian dust reduces solar output without changing physical array count", () => {
  const normal = { ...initialOutpost("mars"), sol: 2 };
  const dust = { ...initialOutpost("mars"), sol: 4 };
  assert.ok(projectPower(normal).generation > projectPower(dust).generation);
  assert.equal(normal.solar, dust.solar);
});

test("each sol permits only one operation and requires selection before advance", () => {
  const start = initialOutpost("moon");
  assert.equal(advanceSol(start), start);
  const equipped = perform(start, "shield");
  assert.equal(perform(equipped, "solar"), equipped);
  assert.equal(advanceSol(equipped).sol, 2);
  assert.equal(advanceSol(equipped).selected, null);
});

test("the greenhouse consumes extra resources when crop production is prioritized", () => {
  const base = { ...initialOutpost("moon"), selected: "monitor" as const };
  const crops = advanceSol(setPriority(base, "crops"));
  const crew = advanceSol(setPriority(base, "crew"));
  assert.ok(crops.crop > crew.crop);
  assert.ok(crops.water < crew.water);
  assert.ok(crops.battery < crew.battery);
});

test("higher radiation shielding lowers simulated crew exposure", () => {
  const base = { ...initialOutpost("moon"), sol: 3, selected: "monitor" as const };
  const safer = { ...base, shielding: 3 };
  assert.ok(advanceSol(safer).radiation < advanceSol(base).radiation);
});

test("harvesting converts grown crops into edible crew food and verified production", () => {
  const start = initialOutpost("moon");
  assert.equal(availableAction(start, "harvest").ok, false);
  const grown = { ...start, crop: 13 };
  const harvested = perform(grown, "harvest");
  assert.equal(harvested.crop, 3);
  assert.equal(harvested.food, 87);
  assert.equal(harvested.foodProduced, 22);
  assert.equal(grown.foodProduced, 0);
});

test("power shortage reduces recycling and crew safety", () => {
  const s = { ...initialOutpost("moon"), sol: 5, battery: 0, selected: "monitor" as const };
  const after = advanceSol(s);
  assert.ok(after.safety < s.safety);
  assert.ok(after.lastReport.some(x => x.includes("POWER SHORTAGE")));
});

test("not enough credits disables purchases, not free monitoring", () => {
  const s = { ...initialOutpost("mars"), credits: 0 };
  assert.equal(availableAction(s, "shield").ok, false);
  assert.equal(availableAction(s, "monitor").ok, true);
  assert.equal(perform(s, "shield"), s);
});

test("restarting and persistence validation reject corrupt or unsafe saves", () => {
  const state = initialOutpost("moon");
  assert.equal(isValidOutpost(state), true);
  assert.equal(isValidOutpost({ ...state, oxygen: NaN }), false);
  assert.equal(isValidOutpost({ ...state, destination: "jupiter" }), false);
  assert.equal(isValidOutpost({ ...state, log: "bad" }), false);
  assert.equal(isValidOutpost(JSON.parse(JSON.stringify(state))), true);
});

function play(destination: Destination, schedule: Record<number, Action>): Outpost {
  let state = initialOutpost(destination);
  for (let sol = 1; sol <= MISSION_LENGTH; sol++) {
    assert.equal(state.sol, sol);
    const action = schedule[sol] ?? "monitor";
    assert.equal(availableAction(state, action).ok, true, "action must be available on sol " + sol);
    state = advanceSol(perform(state, action));
    assert.ok(state.oxygen >= 0 && state.water >= 0 && state.food >= 0 && state.battery >= 0);
    assert.ok(state.credits >= 0);
  }
  return state;
}

test("Moon campaign can be won with shielding, farming and battery management", () => {
  const result = play("moon", { 1: "shield", 2: "harvest" });
  assert.equal(result.phase, "won", JSON.stringify(result.lastReport));
  assert.ok(missionCriteria(result).every(x => x.met));
  assert.equal(result.sol, 11);
  assert.equal(advanceSol(result), result);
});

test("Mars campaign can be won with upgraded solar, shielding and food harvesting", () => {
  const result = play("mars", { 1: "solar", 2: "shield", 3: "harvest" });
  assert.equal(result.phase, "won", JSON.stringify(result.lastReport));
  assert.ok(missionCriteria(result).every(x => x.met));
});

test("failed missions stop and never enter a negative resource state", () => {
  let s = initialOutpost("mars");
  s = { ...s, oxygen: 2, water: 3, food: 4 };
  const ended = advanceSol(perform(s,"monitor"));
  assert.equal(ended.phase, "lost");
  assert.equal(ended.oxygen >= 0 && ended.water >= 0 && ended.food >= 0, true);
  assert.equal(perform(ended, "supplies"), ended);
});

test("all action definitions are unique and correctly priced", () => {
  assert.equal(new Set(ACTIONS.map(x => x.id)).size, ACTIONS.length);
  assert.ok(ACTIONS.every(x => x.cost >= 0 && x.title.length && x.description.length));
});

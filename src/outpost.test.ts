import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTIONS, CROPS, MISSION_LENGTH, advanceSol, availableAction, chooseIncident, currentIncident, forecast, initialOutpost,
  isValidOutpost, migrateOutpost, missionCriteria, perform, projectPower, setPriority, setCropPlan,
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
  const after = advanceSol(chooseIncident(s,"normal"));
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
    state = perform(state, action);
    const incident = currentIncident(state);
    if(incident) {
      const preferred = incident.id==="radiation"?"shelter":incident.id==="blackout"?"conserve":incident.id==="dust"?"seal":"patch";
      state=chooseIncident(state,preferred);
    }
    state = advanceSol(state);
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


test("legacy browser save migrates without losing prior progress and remains valid",()=>{
  const old=initialOutpost("moon");
  const legacy={...old,version:1};
  delete (legacy as Record<string,unknown>).cropType;
  delete (legacy as Record<string,unknown>).plannedCrop;
  delete (legacy as Record<string,unknown>).incidentSol;
  delete (legacy as Record<string,unknown>).incidentChoice;
  const restored=migrateOutpost(legacy);
  assert.ok(restored);
  assert.equal(restored?.version,2);
  assert.equal(restored?.sol,old.sol);
  assert.equal(restored?.credits,old.credits);
  assert.equal(restored?.cropType,"lettuce");
  assert.equal(migrateOutpost({...legacy,oxygen:"wrong"}),null);
});

test("greenhouse planting takes an operation and resets crops at a real cost",()=>{
  const initial=initialOutpost("moon");
  assert.equal(availableAction(initial,"plant").ok,false);
  const planned=setCropPlan(initial,"potato");
  assert.equal(planned.cropType,"lettuce");
  const planted=perform(planned,"plant");
  assert.equal(planted.cropType,"potato");
  assert.equal(planted.crop,3);
  assert.equal(planted.credits,initial.credits-9);
  assert.equal(perform(planted,"plant"),planted);
  assert.equal(setCropPlan(planted,"algae"),planted);
});

test("crops genuinely differ in electricity use, water use, growth and food output",()=>{
  const cropScenario=(crop:"lettuce"|"potato"|"algae")=>{
    const s={...initialOutpost("moon"),cropType:crop,plannedCrop:crop,selected:"monitor" as const};
    return {before:projectPower(s),after:advanceSol(s)};
  };
  const leafy=cropScenario("lettuce"),potato=cropScenario("potato"),algae=cropScenario("algae");
  assert.ok(potato.after.water<leafy.after.water);
  assert.ok(algae.before.demand>leafy.before.demand);
  assert.ok(algae.after.crop>potato.after.crop);
  assert.ok(CROPS.potato.harvest>CROPS.lettuce.harvest);
  const harvest=perform({...initialOutpost("moon"),cropType:"potato",crop:13},"harvest");
  assert.equal(harvest.foodProduced,CROPS.potato.harvest);
});

test("radiation emergency gates advancement, and shelter response reduces exposure",()=>{
  const base={...initialOutpost("moon"),sol:3,selected:"monitor" as const};
  assert.equal(currentIncident(base)?.id,"radiation");
  assert.equal(advanceSol(base),base);
  const shelter=advanceSol(chooseIncident(base,"shelter"));
  const outside=advanceSol(chooseIncident(base,"expedition"));
  assert.ok(shelter.radiation<outside.radiation);
  assert.ok(shelter.battery<outside.battery);
  assert.ok(outside.credits>shelter.credits);
  assert.ok(outside.safety<shelter.safety);
});

test("conservation during lunar night sacrifices crops for lower power demand",()=>{
  const base={...initialOutpost("moon"),sol:5,selected:"monitor" as const};
  assert.equal(currentIncident(base)?.id,"blackout");
  const conserved=advanceSol(chooseIncident(base,"conserve"));
  const normal=advanceSol(chooseIncident(base,"normal"));
  assert.ok(conserved.battery>normal.battery);
  assert.equal(conserved.crop,base.crop);
});

test("dust storms offer energy or hardware protection choices",()=>{
  const base={...initialOutpost("mars"),sol:4,selected:"monitor" as const};
  assert.equal(currentIncident(base)?.id,"dust");
  const cleaned=advanceSol(chooseIncident(base,"sweep"));
  const sealed=advanceSol(chooseIncident(base,"seal"));
  assert.ok(cleaned.battery>sealed.battery);
  assert.ok(cleaned.credits<sealed.credits);
  assert.ok(cleaned.integrity<sealed.integrity);
});

test("water-line leak forces explicit financial versus supply trade-off",()=>{
  const base={...initialOutpost("moon"),sol:7,selected:"monitor" as const};
  const patched=advanceSol(chooseIncident(base,"patch"));
  const isolated=advanceSol(chooseIncident(base,"isolate"));
  assert.equal(currentIncident(base)?.id,"leak");
  assert.ok(patched.water>isolated.water);
  assert.ok(patched.oxygen>isolated.oxygen);
  assert.ok(patched.credits<isolated.credits);
  assert.ok(patched.integrity>isolated.integrity);
});

test("zero credits still leaves no-cost emergency response and normal play",()=>{
  const base={...initialOutpost("mars"),sol:4,credits:0,selected:"monitor" as const};
  assert.equal(chooseIncident(base,"sweep"),base);
  assert.equal(chooseIncident(base,"seal").incidentChoice,"seal");
  assert.equal(advanceSol(chooseIncident(base,"seal")).sol,5);
});

test("emergency decisions cannot be overwritten or used for infinite credits",()=>{
  const base={...initialOutpost("moon"),sol:3};
  const once=chooseIncident(base,"expedition");
  const twice=chooseIncident(once,"expedition");
  assert.equal(once,twice);
  assert.equal(chooseIncident(once,"shelter"),once);
  assert.equal(advanceSol(once),once,"must still select one engineering action");
});

test("battery reserve action requires credits and consumes the daily operation",()=>{
  const base={...initialOutpost("moon"),battery:20};
  const charged=perform(base,"battery");
  assert.equal(charged.battery,44);
  assert.equal(charged.credits,base.credits-14);
  assert.equal(charged.selected,"battery");
  assert.equal(perform(charged,"solar"),charged);
});

test("save validation rejects invalid crop and fabricated crisis responses",()=>{
  const base=initialOutpost("moon");
  assert.equal(isValidOutpost({...base,cropType:"lava"}),false);
  assert.equal(isValidOutpost({...base,incidentChoice:"unknown"}),false);
  assert.equal(isValidOutpost({...base,incidentSol:-9}),false);
  assert.equal(isValidOutpost({...base,plannedCrop:"potato"}),true);
});

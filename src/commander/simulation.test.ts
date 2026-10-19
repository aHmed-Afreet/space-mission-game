import { test } from "node:test";
import assert from "node:assert/strict";
import {
  act,
  alerts,
  defaultDesign as d,
  defaultLife as l,
  engineering,
  newMission,
  tick,
} from "./simulation";
test("selected stores initialize actual onboard resources", () => {
  const config = { ...l, food: 9, water: 12, oxygen: 2, batteries: 3 };
  const s = newMission(d, config);
  assert.equal(s.food, 9);
  assert.equal(s.water, 12);
  assert.equal(s.oxygen, 2);
  assert.equal(s.battery, 3);
});
test("engineering tradeoffs affect mass, cost, power and endurance", () => {
  const base = engineering(d, l);
  const food = engineering(d, { ...l, food: l.food + 3 });
  assert.ok(food.mass > base.mass && food.cost > base.cost);
  const water = engineering(d, { ...l, water: l.water + 3 });
  assert.ok(water.mass - base.mass > food.mass - base.mass);
  const recycler = engineering(d, {
    ...l,
    waterRecycler: 2,
    oxygenRecycler: 2,
  });
  assert.ok(
    recycler.cost > base.cost &&
      recycler.power < base.power &&
      recycler.waterDays > base.waterDays &&
      recycler.oxygenDays > base.oxygenDays,
  );
  const battery = engineering(d, { ...l, batteries: 2 });
  assert.ok(battery.mass > base.mass && battery.capacity > base.capacity);
});
test("storage actions require physical proximity and meals cannot be duplicated", () => {
  let s = newMission(d, l);
  assert.equal(act(s, "takeMeal", "cockpit", d, l).food, s.food);
  s = act(s, "takeMeal", "galley", d, l);
  assert.equal(s.food, l.food - 1);
  assert.equal(s.meals, 1);
  s = act(s, "eat", undefined, d, l);
  assert.equal(s.meals, 0);
  assert.equal(s.nutrition, 100);
  assert.equal(act(s, "eat", undefined, d, l).food, s.food);
});
test("bottle filling and drinking conserve finite water including recovery", () => {
  let s = newMission(d, l);
  s = act(s, "fill", "galley", d, l);
  assert.equal(s.water, l.water - 1);
  assert.equal(s.bottle, 1);
  s = act(s, "drink", undefined, d, l);
  assert.equal(s.bottle, 0.75);
  assert.ok(Math.abs(s.water - (l.water - 1 + 0.25 * 0.35)) < 1e-9);
  const again = act(s, "fill", "galley", d, l);
  assert.equal(again.bottle, 1);
  assert.ok(again.water < s.water);
  const empty = act({ ...s, bottle: 0, water: 0 }, "drink", undefined, d, l);
  assert.equal(empty.water, 0);
});
test("recyclers fail without power and oxygen consumption reflects configuration", () => {
  const s = newMission(d, l);
  const low = tick(s, d, { ...l, oxygenRecycler: 0 }, 60);
  const high = tick(s, d, { ...l, oxygenRecycler: 2 }, 60);
  assert.ok(high.oxygen > low.oxygen);
  const unpowered = tick(
    { ...s, battery: 0, malfunction: true },
    d,
    { ...l, oxygenRecycler: 2 },
    60,
  );
  assert.ok(unpowered.oxygen < high.oxygen);
  const drink = act(
    { ...s, water: 0, bottle: 1, battery: 0 },
    "drink",
    undefined,
    d,
    l,
  );
  assert.equal(drink.water, 0);
});
test("time depletes readiness; sleep and consumption restore it; pause freezes state", () => {
  const s = { ...newMission(d, l), energy: 50, nutrition: 15, hydration: 15 };
  const later = tick(s, d, l, 30);
  assert.ok(later.energy < s.energy && later.hydration < s.hydration);
  const sleeping = tick(
    { ...s, sleeping: true, nutrition: 80, hydration: 80 },
    d,
    l,
    30,
  );
  assert.ok(sleeping.energy > s.energy);
  const paused = { ...s, paused: true };
  assert.equal(tick(paused, d, l, 100), paused);
});
test("scheduled faults, repairs and communications use real systems and parts", () => {
  let s = tick(newMission(d, l), d, l, 220);
  assert.equal(s.communications, false);
  assert.equal(s.malfunction, true);
  assert.equal(act(s, "repair", "power", d, l).malfunction, true);
  s = act(s, "tools", "equipment", d, l);
  s = act(s, "repair", "power", d, l);
  assert.equal(s.parts, 2);
  assert.equal(s.malfunction, false);
  s = act(s, "comms", "communications", d, l);
  assert.equal(s.communications, true);
  assert.ok(
    alerts({ ...s, food: 0, water: 0, oxygen: 0.1, battery: 0 }).length >= 4,
  );
});
test("completion requires objectives and a full supported sortie can be finished", () => {
  let s = newMission(d, l);
  assert.equal(act(s, "finish", "cockpit", d, l).ended, false);
  s = act(s, "course", "cockpit", d, l);
  assert.equal(s.fuel, newMission(d, l).fuel - 2);
  for (let i = 0; i < 3; i++) s = act(s, "science", "science", d, l);
  s = act(s, "comms", "communications", d, l);
  s = act(s, "sleep", "sleep", d, l);
  s = tick(s, d, l, 30);
  s = act(s, "wake", undefined, d, l);
  s = tick(s, d, l, 330);
  s = act(s, "tools", "equipment", d, l);
  s = act(s, "repair", "power", d, l);
  s = act(s, "comms", "communications", d, l);
  s = act(s, "finish", "cockpit", d, l);
  assert.equal(s.ended, true);
  assert.ok(s.notice.includes("sortie complete"));
});
test("oxygen exhaustion safely aborts mission and cannot be undone by actions", () => {
  const s = tick({ ...newMission(d, l), oxygen: 0 }, d, l);
  assert.equal(s.ended, true);
  assert.equal(act(s, "takeMeal", "galley", d, l), s);
});

import { deck, nearby, spawn, walkable } from "./layout";
test("redesigned cabin has a continuous path to every functional station", () => {
  const queue = [{ x: 0, z: 6.4 }],
    visited = new Set(["0,32"]);
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    for (const [dx, dz] of [
      [0.2, 0],
      [-0.2, 0],
      [0, 0.2],
      [0, -0.2],
    ]) {
      const x = Math.round((p.x + dx) * 5) / 5,
        z = Math.round((p.z + dz) * 5) / 5,
        key = `${Math.round(x * 5)},${Math.round(z * 5)}`;
      if (!visited.has(key) && walkable(x, z)) {
        visited.add(key);
        queue.push({ x, z });
      }
    }
  }
  for (const id of Object.keys(deck))
    assert.ok(
      queue.some((p) => nearby(p.x, p.z) === id),
      `${id} must be reachable`,
    );
});
test("cabin hull and furniture constrain movement without changing gameplay state", () => {
  assert.equal(walkable(spawn.x, spawn.z), true);
  assert.equal(walkable(5, 0), false);
  assert.equal(walkable(2.3, 6.2), false);
  assert.equal(walkable(0, -8), false);
  assert.equal(walkable(deck.galley.x, deck.galley.z), false);
  assert.equal(nearby(0.7, deck.galley.z), "galley");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { missions, missionById, type MissionDefinition } from "./definitions";
import { environments } from "./environments";
import { equipment, packMass, PACK_CAPACITY } from "./equipment";
import {
  canStart,
  createSession,
  currentObjective,
  command,
  moveSession,
  tickSession,
  sitePosition,
  emptyProgress,
  recordReport,
  engineeringCampaign,
  campaignWalkable,
  type Session,
  type Progress,
} from "./engine";
import { defaultDesign as design, defaultLife as life } from "../simulation";
import { decodeStore, newStore, persist, loadStore, SAVE_KEY } from "./save";
import { joystickVector } from "../controls";
/** Drive every real objective through its public action/time/position interfaces. */
export function completeMission(m: MissionDefinition, p: Progress) {
  let s = createSession(m, design, life, [...m.requiredEquipment], p);
  let guard = 0;
  while (!s.report && guard++ < 180) {
    const o = currentObjective(s);
    assert.ok(o);
    if (o.site) {
      const target = sitePosition(o.site, m.destination);
      let pos = { ...target, heading: 0 };
      if (
        o.site in
        {
          equipment: 1,
          power: 1,
          galley: 1,
          sleep: 1,
          science: 1,
          communications: 1,
        }
      )
        pos.x += pos.x < 0 ? 1.1 : -1.1;
      if (o.site === "cockpit") pos.z += 1.05;
      if (o.site === "innerHatch") pos.z = 7.1;
      s = moveSession(s, pos);
    }
    const now = currentObjective(s);
    if (!now) break;
    if (now.id !== o.id) continue;
    if (now.type === "WAIT") {
      for (
        let n = 0;
        n < 20 && currentObjective(s)?.id === now.id && !s.report;
        n++
      )
        s = tickSession(s, 1);
    } else if (now.action) {
      const before = s.objective;
      for (let n = 0; n < (now.count || 1); n++) s = command(s, now.action);
      if (now.type === "TRANSMIT" && s.pendingTransmit > 0)
        s = tickSession(s, 5);
      assert.ok(
        s.objective > before || s.report,
        `${m.id}: failed ${now.action}: ${s.notice}`,
      );
    } else
      throw Error(
        `Unreachable ${m.id} ${now.title} ${JSON.stringify(s.position)}`,
      );
  }
  assert.ok(s.report?.success, `${m.id} not completed: ${s.notice}`);
  return s;
}
test("all campaign definitions are complete, uniquely identified and have resolvable prerequisites", () => {
  assert.equal(missions.length, 24);
  assert.equal(new Set(missions.map((m) => m.id)).size, missions.length);
  for (const m of missions) {
    assert.ok(environments[m.destination]);
    assert.ok(m.objectives.length);
    assert.ok(m.phases.length);
    assert.ok(m.requiredEquipment.every((g) => g in equipment));
    assert.ok(m.prerequisites.every((p) => missions.some((v) => v.id === p)));
    assert.ok(
      new Set(m.objectives.map((o) => o.id)).size === m.objectives.length,
    );
    assert.ok(
      m.objectives.every(
        (o) =>
          o.type === "GO_TO" ||
          o.type === "RETURN" ||
          o.type === "WAIT" ||
          o.action,
      ),
    );
  }
});
test("locked and planned missions cannot be started", () => {
  const p = emptyProgress();
  assert.ok(canStart(missions[0], p));
  assert.equal(canStart(missions[1], p), false);
  assert.throws(() => createSession(missions[1], design, life, [], p));
  assert.throws(() => createSession(missions[12], design, life, [], p));
});
test("current objective cannot be skipped with later actions", () => {
  let s = createSession(missions[1], design, life, [], {
    ...emptyProgress(),
    completed: {
      "level-1": completeMission(missions[0], emptyProgress()).report!,
    },
  });
  s = command(s, "drink");
  assert.equal(s.objective, 0);
  assert.ok(s.notice.includes("First:"));
});
test("the full training and lunar campaign can be completed, reported and replayed", () => {
  let progress = emptyProgress();
  for (const m of missions.filter((m) => m.implemented)) {
    assert.ok(canStart(m, progress));
    const s = completeMission(m, progress);
    progress = recordReport(progress, s);
    assert.equal(progress.completed[m.id].success, true);
    assert.equal(recordReport(progress, s), progress);
  }
  assert.equal(Object.keys(progress.completed).length, 12);
  assert.ok(progress.outposts.moon?.shelter);
  assert.ok(canStart(missions[0], progress));
  assert.equal(canStart(missions[12], progress), false);
});
test("real food and water have order, finite supplies and consumption cooldowns", () => {
  let p = emptyProgress();
  p = recordReport(p, completeMission(missions[0], p));
  let s = createSession(missions[1], design, life, [], p);
  s = moveSession(s, { x: 1.1, z: 0.45, heading: 0 });
  s = command(s, "takeMeal");
  assert.equal(s.state.food, 17);
  s = command(s, "fill");
  assert.equal(s.state.water, 17);
  s = command(s, "eat");
  assert.equal(s.state.meals, 0);
  const before = s.state.food;
  s = command(s, "eat");
  assert.equal(s.state.food, before);
  s = command(s, "drink");
  assert.equal(s.state.bottle, 0.75);
  assert.ok(s.state.water > 17 && s.state.water < 18);
});
test("suit preparation, equipment and pressure prevent unsafe EVA operations", () => {
  let p = emptyProgress();
  for (const m of missions.slice(0, 5))
    p = recordReport(p, completeMission(m, p));
  let s = createSession(missions[5], design, life, ["suit", "camera"], p);
  s = command(s, "openOuter");
  assert.equal(s.airlock.outer, false);
  s = moveSession(s, { x: 1.1, z: 4.4, heading: 0 });
  s = command(s, "equipSuit");
  assert.equal(s.suit.equipped, true);
  assert.equal(s.state.oxygen, life.oxygen - 0.35);
  s = command(s, "checkOxygen");
  s = command(s, "checkPower");
  s = moveSession(s, { x: 0, z: 7.1, heading: 0 });
  s = command(s, "openInner");
  s = moveSession(s, { x: 0, z: 9, heading: 0 });
  s = command(s, "vent");
  assert.equal(s.airlock.cycling, null);
  s = command(s, "closeInner");
  s = command(s, "vent");
  assert.equal(s.airlock.cycling, "vent");
  s = tickSession(s, 3);
  assert.equal(s.airlock.pressure, 0);
  s = command(s, "openOuter");
  assert.equal(s.airlock.outer, true);
  assert.equal(command(s, "openInner").airlock.inner, false);
  assert.equal(campaignWalkable(0, 10.4, s), true);
});
test("selected equipment creates mass, cost, power and load capacity tradeoffs", () => {
  const a = engineeringCampaign(design, life, [], false),
    b = engineeringCampaign(design, life, ["suit", "drill"], true);
  assert.ok(b.mass > a.mass && b.cost > a.cost && b.power < a.power);
  assert.ok(packMass(["drill", "scanner"]) < PACK_CAPACITY);
  assert.ok(
    packMass(Object.keys(equipment) as (keyof typeof equipment)[]) >
      PACK_CAPACITY,
  );
});
test("destinations differ in terrain, gravity, solar energy and communications", () => {
  assert.notEqual(environments.earth.terrain, environments.moon.terrain);
  assert.ok(environments.earth.gravity < environments.moon.gravity);
  assert.ok(environments.mars.solar < environments.moon.solar);
  assert.ok(
    environments["deep-space"].communicationDelay >
      environments.earth.communicationDelay,
  );
  assert.equal(environments.mars.available, false);
});
test("campaign saves preserve completion, checkpoint and tutorial dismissals", () => {
  const memory = new Map<string, string>();
  const storage = {
    getItem: (k: string) => memory.get(k) || null,
    setItem: (k: string, v: string) => memory.set(k, v),
  };
  const store = newStore();
  const s = completeMission(missions[0], store.progress);
  store.progress = recordReport(store.progress, s);
  store.progress.tutorials = ["navigation"];
  store.session = s;
  persist(storage, store);
  const loaded = loadStore(storage);
  assert.ok(loaded.store.progress.completed["level-1"]);
  assert.equal(loaded.store.session?.state.paused, true);
  assert.deepEqual(loaded.store.progress.tutorials, ["navigation"]);
  assert.ok(canStart(missions[1], loaded.store.progress));
  assert.throws(() => decodeStore(JSON.stringify({ ...store, version: 9 })));
});
test("old saves are preserved without granting campaign completion", () => {
  const old = JSON.stringify({
    version: 1,
    design,
    life,
    mission: { course: true },
  });
  const memory = {
    getItem: (k: string) => (k === "orbital-commander-v1" ? old : null),
  };
  const loaded = loadStore(memory);
  assert.equal(loaded.legacy, true);
  assert.equal(Object.keys(loaded.store.progress.completed).length, 0);
});
test("analog joystick scales smoothly, saturates and has a zero dead zone", () => {
  assert.deepEqual(joystickVector(2, 2, 60), { x: 0, y: 0 });
  assert.ok(joystickVector(10, 0, 60).x < joystickVector(50, 0, 60).x);
  assert.equal(joystickVector(1000, 0, 60).x, 1);
  assert.deepEqual(joystickVector(0, 0, 60), { x: 0, y: 0 });
});
test("PWA manifest and mobile metadata are present and refer to existing icons", () => {
  const manifest = JSON.parse(
    readFileSync("public/manifest.webmanifest", "utf8"),
  );
  assert.equal(manifest.display, "standalone");
  assert.ok(
    manifest.icons.every((i: { src: string }) =>
      existsSync("public/" + i.src.replace("./", "")),
    ),
  );
  assert.match(readFileSync("index.html", "utf8"), /viewport-fit=cover/);
  assert.match(readFileSync("vite.config.ts", "utf8"), /sw\.js/);
});
test("closed hatches block movement across their plane, including large position updates", () => {
  const m = missions[5];
  let p = emptyProgress();
  for (const previous of missions.slice(0, 5)) p = recordReport(p, completeMission(previous, p));
  const s = createSession(m, design, life, [...m.requiredEquipment], p);
  s.suit.equipped = true;
  s.position = { x: 0, z: 7.1, heading: 0 };
  s.airlock.inner = false;
  assert.deepEqual(moveSession(s, { x: 0, z: 9, heading: 0 }).position, s.position);
  s.position.z = 9;
  s.airlock.outer = false;
  assert.deepEqual(moveSession(s, { x: 0, z: 14, heading: 0 }).position, s.position);
});
test("corrupt primary saves recover a valid backup and newer versions cannot be overwritten", () => {
  const memory = new Map<string, string>();
  const storage = { getItem: (k: string) => memory.get(k) || null, setItem: (k: string, v: string) => { memory.set(k, v); } };
  const store = newStore();
  persist(storage, store);
  persist(storage, store);
  memory.set(SAVE_KEY, '{broken');
  assert.match(loadStore(storage).warning, /backup/);
  const newer = JSON.stringify({ version: 99 });
  memory.set(SAVE_KEY, newer);
  assert.equal(loadStore(storage).readOnly, true);
  assert.throws(() => persist(storage, store), /newer/);
  assert.equal(memory.get(SAVE_KEY), newer);
});
test("replays retain the highest score and restored outposts must contain finite resources", () => {
  const s = completeMission(missions[0], emptyProgress());
  const p = recordReport(emptyProgress(), s);
  const best = p.completed[s.missionId].score;
  const worse = { ...s, id: 'worse-attempt', report: { ...s.report!, runId: 'worse-attempt', score: Math.max(0, best - 10) } };
  const replay = recordReport(p, worse);
  assert.equal(replay.completed[s.missionId].score, best);
  assert.equal(replay.history.length, 2);
  const store = newStore();
  store.progress.outposts.moon = { ...s.camp, power: Number.NaN };
  assert.throws(() => decodeStore(JSON.stringify(store)), /outpost/);
});

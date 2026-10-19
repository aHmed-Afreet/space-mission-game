import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { missions, missionById, type MissionDefinition } from "./definitions";
import { missions as legacyMissions } from "./legacyDefinitions";
import { environments } from "./environments";
import { equipment, packMass, PACK_CAPACITY } from "./equipment";
import {
  canStart,
  createSession,
  launchMission,
  currentObjective,
  currentPhase,
  command,
  moveSession,
  tickSession,
  sitePosition,
  emptyProgress,
  recordReport,
  engineeringCampaign,
  campaignWalkable,
  optionalCommand,
  completedOptional,
  flightControls,
  setSimRate,
  makeReport,
  preflight,
  type Session,
  type Progress,
} from "./engine";
import { defaultDesign as design, defaultLife as life } from "../simulation";
import { bookLaunch, technologies } from "./economy";
import { decodeStore, newStore, persist, loadStore, SAVE_KEY } from "./save";
import { joystickVector } from "../controls";

function stand(
  s: Session,
  site: NonNullable<ReturnType<typeof currentObjective>>["site"],
): Session {
  if (!site) return s;
  const p = sitePosition(site, missionById(s.missionId).destination);
  const pos = { ...p, heading: 0 };
  if (
    [
      "equipment",
      "power",
      "galley",
      "sleep",
      "science",
      "communications",
    ].includes(site)
  )
    pos.x += pos.x < 0 ? 1.1 : -1.1;
  if (site === "cockpit") pos.z += 1.05;
  if (site === "innerHatch") pos.z = 7.1;
  return moveSession(s, pos);
}
/** Full public procedure driver: changes position through collisions, operates controls and waits for real state. */
export function completeMission(
  m: MissionDefinition,
  p: Progress,
  optional = false,
  bypass = false,
): Session {
  let s = createSession(m, design, life, [...m.requiredEquipment], p);
  let guard = 0;
  while (!s.report && guard++ < 400) {
    const o = currentObjective(s);
    assert.ok(o);
    s = stand(s, o.site);
    if (currentObjective(s)?.id !== o.id) continue;
    if (optional && s.flight.status === "orbit") {
      for (const c of m.optional || [])
        if (
          c.action &&
          !s.optionalDone.includes(c.id) &&
          (!c.gear || s.pack.includes(c.gear))
        ) {
          if (c.site && !["science"].includes(c.site) && !s.suit.equipped)
            continue;
          if (
            c.site &&
            ["relay", "crater", "survey"].includes(c.site) &&
            s.position.z < 10.4
          )
            continue;
          const before = s.position;
          s = stand(s, c.site);
          s = optionalCommand(s, c.id);
          s = moveSession(s, before);
          s = stand(s, o.site);
        }
    }
    if (currentObjective(s)?.id !== o.id) continue;
    if (o.type === "WAIT") {
      for (
        let n = 0;
        n < 400 && currentObjective(s)?.id === o.id && !s.report;
        n++
      ) {
        if (s.flight.status === "ascent")
          s = flightControls(
            s,
            0.85,
            Math.max(25, 90 - s.flight.altitude * 0.3),
          );
        s = tickSession(s, 0.5);
      }
      assert.notEqual(
        currentObjective(s)?.id,
        o.id,
        `Wait stuck: ${m.title} / ${o.title}`,
      );
    } else if (o.action) {
      const before = s.objective;
      const action =
        bypass && o.choices && o.event
          ? o.choices[o.choices.length - 1].action
          : o.action;
      s = command(s, action);
      if (o.type === "TRANSMIT" && s.pendingTransmit) s = tickSession(s, 5);
      assert.ok(
        s.objective > before || s.report,
        `${m.title} / ${o.title}: ${s.notice}`,
      );
    } else
      throw Error(`Unreachable task: ${o.title} ${JSON.stringify(s.position)}`);
  }
  assert.ok(s.report?.success, `${m.title} did not complete: ${s.notice}`);
  return s;
}
function finish(p: Progress, s: Session) {
  return recordReport(bookLaunch(p, s), s);
}
function qualified(count = 1) {
  let p = emptyProgress();
  for (const m of missions.slice(0, count))
    p = finish(p, completeMission(m, p));
  return p;
}
function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) || null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
  };
}

test("complete missions have explicit phases, choices, meaningful challenges, optional rewards and unique task IDs", () => {
  assert.equal(missions.length, 16);
  assert.equal(missions.filter((m) => m.implemented).length, 4);
  assert.equal(new Set(missions.map((m) => m.id)).size, 16);
  for (const m of missions) {
    assert.ok(environments[m.destination]);
    assert.ok(m.prerequisites.every((id) => missions.some((v) => v.id === id)));
    assert.equal(
      new Set(m.objectives.map((o) => o.id)).size,
      m.objectives.length,
    );
    if (!m.implemented) continue;
    assert.ok(m.objectives.length >= 20);
    assert.ok(m.phases.length >= 4);
    assert.ok(m.objectives.some((o) => o.choices && o.choices.length >= 2));
    assert.ok(m.objectives.some((o) => o.event));
    assert.ok(m.optional!.length >= 1 && m.optional!.length <= 4);
    assert.ok(m.optional!.every((o) => o.reward <= 6));
    assert.ok(
      m.objectives.some((o) => o.action === "ignite") &&
        m.objectives.some((o) => o.action === "recoverVehicle"),
    );
  }
});
test("mission unlocks, planned restrictions and sequential tasks cannot be bypassed", () => {
  const p = emptyProgress();
  assert.ok(canStart(missions[0], p));
  assert.equal(canStart(missions[1], p), false);
  assert.throws(() =>
    createSession(
      missions[1],
      design,
      life,
      [...missions[1].requiredEquipment],
      p,
    ),
  );
  assert.throws(() => createSession(missions[4], design, life, [], p));
  const s = createSession(missions[0], design, life, [], p);
  const late = command(s, "insertOrbit");
  assert.equal(late.objective, 0);
  assert.equal(late.flight.status, "pad");
});
test("all four complete flights finish launch, operations and recovery, award reports and unlock in order", () => {
  let p = emptyProgress();
  for (const m of missions.filter((m) => m.implemented)) {
    const s = completeMission(m, p, true);
    assert.equal(s.flight.status, "recovered");
    assert.ok(s.flight.separated);
    assert.ok(s.completed.length === m.objectives.length);
    assert.equal(currentPhase(s), "MISSION REPORT");
    p = finish(p, s);
    assert.ok(p.completed[m.id]);
    assert.equal(p.economy.balance, s.report!.finance!.after);
    assert.equal(recordReport(p, s), p);
    assert.ok(s.report!.score >= 0 && s.report!.score <= 100);
  }
  assert.ok(p.economy.unlocks.includes("advancedSolar"));
  assert.ok(p.outposts.moon?.sensor);
});
test("funding and spending are atomic, persistent and idempotent", () => {
  const p = emptyProgress(),
    m = missions[0];
  const { session: s, progress: n } = launchMission(m, design, life, [], p);
  assert.equal(p.economy.balance, 425);
  assert.equal(n.economy.balance, 425 + m.funding! - s.finance.cost);
  assert.equal(bookLaunch(n, s), n);
  assert.equal(n.economy.funded.filter((id) => id === m.id).length, 1);
  const store = { ...newStore(), progress: n, session: s },
    memory = memoryStorage();
  persist(memory, store);
  assert.equal(
    loadStore(memory).store.progress.economy.balance,
    n.economy.balance,
  );
  assert.equal(loadStore(memory).store.session?.state.paused, true);
});
test("optional work uses real power, distance, parts and equipment, pays once and is never required", () => {
  const p = emptyProgress(),
    m = missions[0];
  let s = createSession(m, design, life, [], p);
  s.flight.status = "orbit";
  const far = optionalCommand(s, "package");
  assert.equal(far.optionalDone.length, 0);
  s = stand(s, "science");
  const before = s.state.battery;
  s = optionalCommand(s, "package");
  assert.equal(s.state.battery, before - 0.1);
  assert.ok(s.optionalDone.includes("package"));
  const again = optionalCommand(s, "package");
  assert.equal(again.state.battery, s.state.battery);
  const normal = completeMission(m, p);
  const harder = completeMission(m, p, true);
  assert.ok(
    harder.report!.finance!.optional >= normal.report!.finance!.optional + 3,
  );
  assert.ok(normal.report!.success);
});
test("performance rewards are modest, financial totals reconcile and training replays cannot farm money", () => {
  const p = emptyProgress(),
    s = completeMission(missions[0], p, true),
    f = s.report!.finance!;
  assert.equal(
    f.earned,
    f.base + f.optional + f.science + f.efficiency + f.recovery,
  );
  assert.ok(f.science <= 4 && f.efficiency <= 3);
  assert.equal(
    f.after,
    f.before + f.allocation + f.assistance - f.cost + f.earned,
  );
  const completed = finish(p, s),
    replay = completeMission(missions[0], completed, true),
    after = finish(completed, replay);
  assert.equal(replay.finance.practice, true);
  assert.equal(replay.report!.finance!.earned, 0);
  assert.equal(after.economy.balance, completed.economy.balance);
});
test("failure loses performance bonuses, charges repairs, preserves progress and permits funded retry", () => {
  const p = emptyProgress(),
    start = launchMission(missions[0], design, life, [], p);
  let s = start.session;
  s = { ...s, state: { ...s.state, science: 35, ended: true } };
  s.report = makeReport(s, false);
  const n = recordReport(start.progress, s);
  assert.equal(s.report.outcome, "PARTIAL SUCCESS");
  assert.equal(s.report.finance!.earned, 0);
  assert.equal(s.report.finance!.repair, 3);
  assert.equal(Object.keys(n.completed).length, 0);
  assert.ok(n.economy.balance < p.economy.balance + misisonsFunding());
  const retry = launchMission(missions[0], design, life, [], {
    ...n,
    economy: { ...n.economy, balance: 0 },
  });
  assert.equal(retry.session.finance.allocation, 0);
  assert.ok(retry.session.finance.assistance > 0);
  assert.equal(retry.progress.economy.balance, 0);
  const failure = {
    ...retry.session,
    state: { ...retry.session.state, ended: true },
  };
  failure.report = makeReport(failure, false);
  assert.equal(recordReport(retry.progress, failure).economy.balance, 0);
});
function misisonsFunding() {
  return missions[0].funding!;
}
test("technology unlocks gate purchases and purchased battery, solar, radio and suit have actual effects", () => {
  const p = qualified(3);
  assert.ok(p.economy.unlocks.includes("reserveBattery"));
  const base = engineeringCampaign(
    design,
    life,
    missions[3].requiredEquipment,
    true,
  );
  const upgraded = engineeringCampaign(
    design,
    life,
    missions[3].requiredEquipment,
    true,
    ["reserveBattery", "advancedSolar"],
  );
  assert.ok(
    upgraded.cost > base.cost &&
      upgraded.mass > base.mass &&
      upgraded.capacity > base.capacity &&
      upgraded.power > base.power,
  );
  const s = createSession(
    missions[3],
    design,
    life,
    missions[3].requiredEquipment,
    p,
    ["reserveBattery"],
  );
  assert.equal(s.life.batteries, life.batteries + 1);
  assert.equal(s.state.battery, s.life.batteries);
  assert.ok(
    preflight(missions[0], design, life, [], emptyProgress(), [
      "improvedSuit",
    ]).some((s) => s.includes("Technology")),
  );
});
test("real food, water, cooldowns and resource reserves survive the mission restructure", () => {
  let s = createSession(missions[0], design, life, [], emptyProgress());
  s.flight.status = "orbit";
  s.objective = missions[0].objectives.findIndex(
    (o) => o.action === "takeMeal",
  );
  s = stand(s, "galley");
  const food = s.state.food;
  s = command(s, "takeMeal");
  assert.equal(s.state.food, food - 1);
  const water = s.state.water;
  s = command(s, "fill");
  assert.ok(s.state.water < water && s.state.bottle > 0);
  s = command(s, "eat");
  s = command(s, "drink");
  const energy = s.state.energy;
  const nutrition = s.state.nutrition;
  s = command(s, "eat");
  assert.equal(s.state.nutrition, nutrition);
  assert.equal(s.state.energy, energy);
});
test("suit checks, pressure and both hatch planes prevent unsafe EVA", () => {
  let s = createSession(
    missions[1],
    design,
    life,
    missions[1].requiredEquipment,
    qualified(),
  );
  s.flight.status = "orbit";
  s.objective = missions[1].objectives.findIndex(
    (o) => o.action === "equipSuit",
  );
  s = stand(s, "equipment");
  s = command(s, "equipSuit");
  assert.ok(s.suit.equipped);
  s = command(s, "checkOxygen");
  s = command(s, "checkPower");
  s.position = { x: 0, z: 7.1, heading: 0 };
  assert.deepEqual(
    moveSession(s, { x: 0, z: 9, heading: 0 }).position,
    s.position,
  );
  s.position.z = 9;
  assert.deepEqual(
    moveSession(s, { x: 0, z: 14, heading: 0 }).position,
    s.position,
  );
  s.objective = missions[1].objectives.findIndex(
    (o) => o.action === "openOuter",
  );
  assert.equal(command(s, "openOuter").airlock.outer, false);
  assert.equal(
    campaignWalkable(0, 14, { ...s, suit: { ...s.suit, equipped: false } }),
    false,
  );
});
test("EVA repair consumes real parts and optional gear is not magically available", () => {
  const p = qualified();
  let s = createSession(
    missions[1],
    design,
    life,
    missions[1].requiredEquipment,
    p,
  );
  s.flight.status = "orbit";
  s.suit.equipped = true;
  s.suit.power = 1;
  s.suit.oxygen = 0.35;
  s.airlock.pressure = 0;
  s.airlock.outer = true;
  s.position = { x: 1.8, z: 14, heading: 0 };
  s.pack = ["repair"];
  s.objective = missions[1].objectives.findIndex(
    (o) => o.action === "repairSatellite",
  );
  s.systems.satelliteDiagnosed = true;
  const parts = s.state.parts;
  s = command(s, "repairSatellite");
  assert.equal(s.state.parts, parts - 1);
  assert.ok(s.systems.satelliteRepaired);
  s.pack = [];
  assert.equal(optionalCommand(s, "secondary").optionalDone.length, 0);
});
test("branching fault responses trade parts against power and science", () => {
  const p = emptyProgress(),
    a = completeMission(missions[0], p, false, false),
    b = completeMission(missions[0], p, false, true);
  assert.ok(a.state.parts < b.state.parts);
  assert.ok(a.state.science > b.state.science);
  assert.equal(a.state.malfunction, false);
  assert.equal(b.state.malfunction, false);
});
test("simulation rates are guarded and return to 1x at event and phase boundaries", () => {
  let s = createSession(missions[0], design, life, [], emptyProgress());
  assert.equal(setSimRate(s, 100).simRate, 1);
  s.flight.status = "orbit";
  s.objective = missions[0].objectives.findIndex(
    (o) => o.type === "WAIT" && o.condition === "minutes",
  );
  s.objectiveStarted = s.state.minutes;
  s = setSimRate(s, 100);
  assert.equal(s.simRate, 100);
  s = tickSession(s, 50);
  assert.equal(s.simRate, 1);
  assert.ok(s.state.minutes <= 10);
});
test("destination physics and equipment tradeoffs remain data driven", () => {
  assert.notEqual(environments.earth.terrain, environments.moon.terrain);
  assert.ok(environments.mars.solar < environments.moon.solar);
  assert.equal(environments.mars.available, false);
  assert.ok(
    packMass(Object.keys(equipment) as (keyof typeof equipment)[]) >
      PACK_CAPACITY,
  );
});
test("version 2 migration preserves configuration, results, completed chapters and archived resources without granting full flights", () => {
  const old = {
    version: 2,
    design,
    life,
    progress: {
      completed: Object.fromEntries(
        legacyMissions.slice(0, 6).map((m) => [
          m.id,
          {
            missionId: m.id,
            runId: m.id,
            success: true,
            score: 85,
            rank: "B",
            science: 80,
            resources: 90,
            condition: 90,
            crew: 90,
            power: 80,
            fuel: 80,
            communications: 80,
            experiments: 1,
            samples: 0,
            optional: 0,
            minutes: 10,
            timestamp: 1,
            good: [],
            improve: [],
          },
        ]),
      ),
      history: [],
      tutorials: ["eva"],
      outposts: {},
    },
    session: null,
  };
  const memory = memoryStorage();
  const raw = JSON.stringify(old);
  memory.map.set("orbital-campaign-v2", raw);
  const loaded = loadStore(memory);
  assert.equal(loaded.store.version, 3);
  assert.deepEqual(loaded.store.design, design);
  assert.equal(Object.keys(loaded.store.progress.completed).length, 0);
  assert.equal(Object.keys(loaded.store.progress.archive!.completed).length, 6);
  assert.deepEqual(loaded.store.progress.archive!.chapters, [
    "Command Training",
  ]);
  assert.ok(loaded.store.progress.economy.unlocks.includes("highGain"));
  persist(memory, loaded.store);
  assert.equal(memory.getItem("orbital-campaign-v2"), raw);
});
test("old readiness save remains available, corrupted saves recover backups and newer saves are protected", () => {
  const memory = memoryStorage();
  memory.map.set(
    "orbital-commander-v1",
    JSON.stringify({ version: 1, design, life, mission: { course: true } }),
  );
  assert.equal(loadStore(memory).legacy, true);
  const store = newStore();
  persist(memory, store);
  persist(memory, store);
  memory.map.set(SAVE_KEY, "{broken");
  assert.match(loadStore(memory).warning, /backup/);
  memory.map.set(SAVE_KEY, '{"version":99}');
  assert.equal(loadStore(memory).readOnly, true);
  assert.throws(() => persist(memory, store), /newer/);
});
test("safe EVA checkpoints restore flight, finances, optional progress and tutorials paused", () => {
  const p = qualified(),
    started = launchMission(
      missions[1],
      design,
      life,
      missions[1].requiredEquipment,
      p,
    );
  let s = started.session;
  s.flight.status = "orbit";
  s.suit = {
    equipped: true,
    oxygen: 0.3,
    power: 0.8,
    condition: 99,
    oxygenChecked: true,
    powerChecked: true,
  };
  s.airlock = { inner: false, outer: true, pressure: 0, cycling: null };
  s.position = { x: 1.8, z: 14, heading: Math.PI };
  s.optionalDone = ["secondary"];
  const store = {
    ...newStore(),
    session: s,
    progress: { ...started.progress, tutorials: ["eva"] },
  };
  const restored = decodeStore(JSON.stringify(store));
  assert.equal(restored.session!.state.paused, true);
  assert.equal(restored.session!.position.z, 14);
  assert.deepEqual(restored.session!.optionalDone, ["secondary"]);
  assert.equal(
    restored.progress.economy.balance,
    started.progress.economy.balance,
  );
});
test("best results remain best on worse replay and outpost corruption is rejected", () => {
  const p = emptyProgress(),
    s = completeMission(missions[0], p),
    n = finish(p, s);
  const worse = {
    ...s,
    id: "worse",
    report: {
      ...s.report!,
      runId: "worse",
      score: 0,
      finance: {
        ...s.report!.finance!,
        practice: true,
        earned: 0,
        insurance: 0,
        repair: 0,
      },
    },
  };
  const replay = recordReport(n, worse);
  assert.equal(replay.completed[s.missionId].score, s.report!.score);
  assert.equal(replay.history.length, 2);
  const store = newStore();
  store.progress.outposts.moon = { ...s.camp, power: Number.NaN };
  assert.throws(() => decodeStore(JSON.stringify(store)), /outpost/);
});
test("analog joystick scales and returns to center; PWA/mobile metadata and Strategy source are preserved", () => {
  assert.deepEqual(joystickVector(2, 2, 60), { x: 0, y: 0 });
  assert.ok(joystickVector(10, 0, 60).x < joystickVector(50, 0, 60).x);
  assert.equal(joystickVector(1000, 0, 60).x, 1);
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
  // Exact baseline source fingerprints catch accidental Strategy edits during campaign work.
  const { createHash } = requireHash();
  for (const [file, sha] of Object.entries(strategyHashes))
    assert.equal(
      createHash("sha256").update(readFileSync(file)).digest("hex"),
      sha,
    );
});
import { createHash } from "node:crypto";
const requireHash = () => ({ createHash });
const strategyHashes: Record<string, string> = {
  "src/App.tsx":
    "43f2a3946c4b376a52200695a95724c1bc0b57d439ab18118f78c08880f19fd5",
  "src/game.ts":
    "c97f92f5dbe76d9f197234c3f4703c5414d34b0f297fc7dc2b54d58fb099a585",
  "src/game.test.ts":
    "1e4242302191b68217fcc37752537256a775c4852914999f49fb694424f6c7f1",
  "src/style.css":
    "a4d0880ccbdbfa0465a6ed4b8168eddaac6e9407914f584389dcc1e3844232fd",
};
test("radio, solar and suit upgrades change real acknowledgements, energy and EVA reserves", () => {
  const p = qualified(3);
  const radio = (upgrades: (keyof typeof technologies)[]) => {
    let s = createSession(missions[0], design, life, [], p, upgrades);
    s.flight.status = "orbit";
    s.objective = missions[0].objectives.findIndex(
      (o) => o.type === "TRANSMIT",
    );
    s = stand(s, "communications");
    return command(s, "comms");
  };
  assert.ok(radio(["highGain"]).pendingTransmit < radio([]).pendingTransmit);
  let suit = createSession(
    missions[2],
    design,
    life,
    missions[2].requiredEquipment,
    p,
    ["improvedSuit"],
  );
  suit.flight.status = "orbit";
  suit.landed = true;
  suit.objective = missions[2].objectives.findIndex(
    (o) => o.action === "equipSuit",
  );
  suit = stand(suit, "equipment");
  const oxygen = suit.state.oxygen;
  suit = command(suit, "equipSuit");
  assert.equal(suit.suit.oxygen, 0.5);
  assert.equal(suit.suit.power, 1.25);
  assert.equal(suit.state.oxygen, oxygen - 0.5);
  const solar = (upgrades: (keyof typeof technologies)[]) => {
    let s = createSession(
      missions[3],
      design,
      life,
      missions[3].requiredEquipment,
      p,
      upgrades,
    );
    s.flight.status = "orbit";
    s.state.battery = 0.5;
    return tickSession(s, 1).state.battery;
  };
  assert.ok(solar(["advancedSolar"]) > solar([]));
});
test("other field science remains usable without skipping the current required task", () => {
  const p = qualified(2);
  let s = createSession(
    missions[2],
    design,
    life,
    missions[2].requiredEquipment,
    p,
  );
  s.flight.status = "orbit";
  s.landed = true;
  s.suit = {
    equipped: true,
    oxygen: 0.3,
    power: 1,
    condition: 100,
    oxygenChecked: true,
    powerChecked: true,
  };
  s.pack = ["camera"];
  s.position = { x: 3, z: 16, heading: 0 };
  s.objective = missions[2].objectives.findIndex((o) => o.type === "RETURN");
  const before = s.objective,
    science = s.state.science;
  s = command(s, "photo");
  assert.ok(s.state.science > science);
  assert.equal(s.objective, before);
  assert.ok(s.suit.power < 1);
});

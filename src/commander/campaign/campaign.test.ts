import { doors, lockers, worldAction, equipmentLocker } from "./ship";
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
import { NavigationContent } from "./NavigationMap";

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
  const direction = pos.z > s.position.z ? 1 : -1;
  for (const [id, d] of Object.entries(doors).sort(
    (a, b) => direction * (a[1].z - b[1].z),
  )) {
    if (
      (s.position.z - d.z) * (pos.z - d.z) < 0 &&
      !s.world.doors[id as keyof typeof doors].open
    ) {
      s = moveSession(s, { x: 0, z: d.z - direction * 0.8, heading: 0 });
      s = worldAction(s, { kind: "door", id: id as keyof typeof doors }, 0);
    }
  }
  s = moveSession(s, pos);
  for (const [id, l] of Object.entries(lockers))
    if (l.area === site && !s.world.lockers[id as keyof typeof lockers])
      s = worldAction(s, { kind: "locker", id: id as keyof typeof lockers }, 0);
  return s;
}
/** Full public procedure driver: changes position through collisions, operates controls and waits for real state. */
export function completeMission(
  m: MissionDefinition,
  p: Progress,
  optional = false,
  bypass = false,
): Session {
  let s = createSession(m, design, life, [...m.requiredEquipment], p);
  if (m.eva) {
    for (const id of m.requiredEquipment.filter((g) => g !== "suit")) {
      const locker = equipmentLocker(id);
      s = stand(s, lockers[locker].area as any);
      s = worldAction(s, { kind: "take", id }, 0);
    }
  }
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
    if (
      s.state.malfunction &&
      ["science", "approach", "land", "powerScience"].includes(o.action || "")
    ) {
      const pos = s.position;
      s = stand(s, "power");
      s = command(s, "inspectPower");
      s = stand(s, "equipment");
      s = command(s, "tools");
      s = stand(s, "power");
      s = command(isolate(s), "repair");
      s = moveSession(s, pos);
    }
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
      if (o.event) {
        s = command(
          s,
          o.event === "campPower" ? "inspectCamp" : "inspectPower",
        );
        if (!s.state.tools && !s.pack.includes("repair")) {
          const pos = s.position;
          s = stand(s, "equipment");
          s = command(s, "tools");
          s = moveSession(s, pos);
        }
      }
      const before = s.objective;
      const action =
        bypass && o.choices && o.event
          ? o.choices[o.choices.length - 1].action
          : o.action;
      if (action === "eventReset" && o.event === "power") s = isolate(s);
      if (["land", "returnBurn"].includes(action) && !s.world.switches.maneuver)
        s = worldAction(s, { kind: "switch", id: "maneuver" }, 0);
      if (action === "returnBurn")
        s = worldAction(s, { kind: "target", value: "earth" }, 0);
      if (["approach", "land"].includes(action) && m.surface)
        s = worldAction(s, { kind: "target", value: "moon" }, 0);
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
    s.state.science = 30;
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
test("food, water and unrelated stations work before the mission asks and count as early preparation", () => {
  let s = createSession(missions[0], design, life, [], emptyProgress());
  const current = s.objective;
  s = stand(s, "galley");
  s = command(s, "takeMeal");
  s = command(s, "fill");
  s = command(s, "eat");
  s = command(s, "drink");
  assert.equal(s.objective, current);
  assert.ok(s.lastEat >= 0 && s.lastDrink >= 0);
  assert.equal(s.state.meals, 0);
  assert.equal(s.state.bottle, 0.75);
  s = stand(s, "science");
  const battery = s.state.battery;
  s = command(s, "inspectScience");
  s = command(s, "science");
  assert.ok(s.state.science > 0 && s.state.battery < battery);
  s = stand(s, "communications");
  const power = s.state.battery;
  s = command(s, "comms");
  assert.ok(s.state.battery < power);
  assert.ok(s.pendingTransmit > 0);
  s.objective = missions[0].objectives.findIndex(
    (o) => o.action === "takeMeal",
  );
  s = command(s, "inspectComms");
  assert.ok(
    s.objective > missions[0].objectives.findIndex((o) => o.action === "drink"),
  );
});
test("tools, field equipment and suit checkout can be prepared early and recognized later", () => {
  let s = createSession(
    missions[1],
    design,
    life,
    missions[1].requiredEquipment,
    qualified(),
  );
  s = stand(s, "equipment");
  s = command(s, "tools");
  s = command(s, "packEquipment");
  s = command(s, "equipSuit");
  s = command(s, "checkOxygen");
  s = command(s, "checkPower");
  assert.ok(
    s.state.tools &&
      s.pack.includes("repair") &&
      s.suit.oxygenChecked &&
      s.suit.powerChecked,
  );
  s.objective = missions[1].objectives.findIndex(
    (o) => o.action === "equipSuit",
  );
  const oxygen = s.state.oxygen;
  s = command(s, "inspectEquipment");
  assert.ok(
    s.objective >
      missions[1].objectives.findIndex((o) => o.action === "checkPower"),
  );
  assert.equal(s.state.oxygen, oxygen);
});
test("real prerequisites remain enforced without using the current goal as a lock", () => {
  let s = createSession(missions[0], design, life, [], emptyProgress());
  s = stand(s, "cockpit");
  assert.equal(command(s, "ignite").flight.status, "pad");
  assert.equal(command(s, "armLaunch").flight.countdown, -1);
  assert.equal(command(s, "land").landed, false);
  s = stand(s, "power");
  s.state.malfunction = true;
  const parts = s.state.parts;
  assert.equal(command(isolate(s), "repair").state.parts, parts);
  s = command(s, "inspectPower");
  assert.equal(command(isolate(s), "repair").state.parts, parts);
  s = stand(s, "equipment");
  s = command(s, "tools");
  s = stand(s, "power");
  s = command(isolate(s), "repair");
  assert.equal(s.state.parts, parts - 1);
  assert.equal(s.state.malfunction, false);
  s = stand(s, "galley");
  s.state.bottle = 0;
  assert.equal(command(s, "drink").state.bottle, 0);
});
test("normal repairs satisfy fault goals and earlier science cannot satisfy post-fault validation", () => {
  let s = createSession(missions[0], design, life, [], emptyProgress());
  s.flight.status = "orbit";
  s = stand(s, "science");
  s = command(s, "science");
  s = command(s, "science");
  const post = missions[0].objectives
    .filter((o) => o.action === "science")
    .at(-1)!;
  assert.equal(s.observations.achieved.includes(post.id), false);
  s.objective = missions[0].objectives.findIndex((o) => o.event === "power");
  s.state.malfunction = true;
  s.eventIds.push(currentObjective(s)!.id);
  s = stand(s, "equipment");
  s = command(s, "tools");
  s = stand(s, "power");
  s = command(s, "inspectPower");
  s = command(isolate(s), "repair");
  assert.ok(
    s.objective > missions[0].objectives.findIndex((o) => o.event === "power"),
  );
  s = stand(s, "science");
  s = command(s, "science");
  assert.ok(s.completed.includes(post.id));
});
test("saved observations persist and older v3 checkpoints gain observation defaults safely", () => {
  const start = launchMission(missions[0], design, life, [], emptyProgress());
  let s = stand(start.session, "galley");
  s = command(s, "takeMeal");
  s = command(s, "fill");
  s = command(s, "eat");
  s = command(s, "drink");
  const store = { ...newStore(), session: s, progress: start.progress };
  const restored = decodeStore(JSON.stringify(store));
  assert.ok(restored.session!.lastEat >= 0);
  assert.deepEqual(restored.session!.observations, s.observations);
  const old = structuredClone(store);
  delete (old.session as Partial<Session>).observations;
  const migrated = decodeStore(JSON.stringify(old));
  assert.ok(migrated.session!.observations);
  assert.equal(migrated.session!.state.bottle, 0.75);
});
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Flight from "./Flight";
import CampaignTablet from "./CampaignTablet";
test("HUD inventory and mission controls are always rendered during pad, ascent, orbit, EVA and rest", () => {
  const p = qualified();
  const callbacks = {
    onMove: () => {},
    onTickPause: () => {},
    onCommand: () => {},
    onHome: () => {},
    onDismissTutorial: () => {},
    onResetTutorials: () => {},
    onOptional: () => {},
    onRate: () => {},
    onControls: () => {},
    onAbort: () => {},
    saveError: "",
  };
  for (const context of ["pad", "ascent", "orbit", "eva", "rest"]) {
    const s = createSession(
      missions[1],
      design,
      life,
      missions[1].requiredEquipment,
      p,
    );
    s.flight.status =
      context === "pad" ? "pad" : context === "ascent" ? "ascent" : "orbit";
    if (context === "eva") {
      s.position.z = 14;
      s.suit.equipped = true;
    }
    if (context === "rest") s.state.sleeping = true;
    const html = renderToStaticMarkup(
      createElement(Flight, { ...callbacks, session: s, progress: p }),
    );
    assert.match(html, /aria-label="Open inventory"/);
    assert.match(html, /aria-label="Open mission objectives"/);
    assert.doesNotMatch(
      html,
      /campaign-waypoint|Turn around ·|optional-detour/,
    );
  }
});
test("inventory uses physical limits rather than future-task locks and maps draw no objective route", () => {
  const p = qualified(),
    s = createSession(
      missions[1],
      design,
      life,
      missions[1].requiredEquipment,
      p,
    );
  s.state.meals = 1;
  s.state.bottle = 1;
  const props = {
    s,
    progress: p,
    onOptional: () => {},
    onAbort: () => {},
    onTab: () => {},
    onClose: () => {},
    onCommand: () => {},
    onHome: () => {},
    onResetTutorials: () => {},
    saveError: "",
  };
  const inventory = renderToStaticMarkup(
    createElement(CampaignTablet, { ...props, tab: "INVENTORY" }),
  );
  assert.doesNotMatch(inventory, /<button[^>]*disabled[^>]*>Eat meal/);
  assert.doesNotMatch(inventory, /<button[^>]*disabled[^>]*>Drink water/);
  assert.match(inventory, /Repair toolkit/);
  s.position.z = 14;
  s.suit.equipped = true;
  const map = renderToStaticMarkup(
    createElement(CampaignTablet, { ...props, tab: "MAP" }),
  );
  assert.doesNotMatch(map, /stroke-dasharray|CURRENT TARGET/);
  assert.match(map, /Surface map with named sites/);
});
test("sealed EVA helmet prevents meals and drinks in a vacuum airlock", () => {
  let s = createSession(
    missions[1],
    design,
    life,
    missions[1].requiredEquipment,
    qualified(),
  );
  s.flight.status = "orbit";
  s.position = { x: 0, z: 9, heading: 0 };
  s.airlock.pressure = 0;
  s.suit.equipped = true;
  s.state.bottle = 1;
  s.state.meals = 1;
  const before = s.state.bottle;
  s = command(s, "drink");
  s = command(s, "eat");
  assert.equal(s.state.bottle, before);
  assert.equal(s.state.meals, 1);
});
test("orbital faults develop with mission time while another goal is active, and reduce acceleration", () => {
  let s = createSession(missions[0], design, life, [], emptyProgress());
  s.flight.status = "orbit";
  s.observations.orbitMinute = 0;
  s.simRate = 20;
  const goal = s.objective;
  s = tickSession(s, 9);
  assert.equal(s.objective, goal);
  assert.equal(s.state.malfunction, true);
  assert.equal(s.simRate, 1);
  assert.ok(
    s.eventIds.includes(
      missions[0].objectives.find((o) => o.event === "power")!.id,
    ),
  );
});
test("field instruments remain usable at another valid site while a specific survey is the current goal", () => {
  let s = createSession(
    missions[2],
    design,
    life,
    missions[2].requiredEquipment,
    qualified(2),
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
  s.pack = ["scanner"];
  s.objective = missions[2].objectives.findIndex((o) => o.action === "scan");
  s.position = { x: -6, z: 23, heading: 0 };
  const goal = s.objective;
  s = command(s, "scan");
  assert.ok(s.state.science > 0 && s.suit.power < 1);
  assert.equal(s.objective, goal);
  assert.ok(s.experiments.some((e) => e.includes("crater")));
});

function isolate(s: Session) {
  s = stand(s, "power");
  if (s.world.switches.busB)
    s = worldAction(s, { kind: "switch", id: "busB" }, 0);
  return s;
}
import {
  service,
  serviceEquipment,
  tickShip,
  shipAlerts,
  nominalCondition,
  equipmentServiceCost,
} from "./ship";
test("physical section doors block crossing, animate before clearance and reject closure on the player", () => {
  let s = createSession(missions[0], design, life, [], emptyProgress());
  const before = s.position;
  s = moveSession(s, { x: 0, z: -3, heading: 0 });
  assert.deepEqual(s.position, before);
  s = worldAction(s, { kind: "door", id: "flight" });
  assert.ok(s.world.doors.flight.open);
  assert.deepEqual(
    moveSession(s, { x: 0, z: -3, heading: 0 }).position,
    before,
  );
  s.world.doors.flight.readyAt = 0;
  s = moveSession(s, { x: 0, z: -3, heading: 0 });
  assert.equal(s.position.z, -3);
  s.position.z = -4.35;
  const close = worldAction(s, { kind: "door", id: "flight" });
  assert.equal(close.world.doors.flight.open, true);
});
test("food lockers and water service require physical opening and meals can be returned without duplication", () => {
  let s = createSession(missions[0], design, life, [], emptyProgress());
  s = stand(s, "galley");
  s.world.lockers.food = false;
  const food = s.state.food;
  s = command(s, "takeMeal");
  assert.equal(s.state.food, food);
  s = worldAction(s, { kind: "locker", id: "food" });
  s = command(s, "takeMeal");
  assert.equal(s.state.food, food - 1);
  s = worldAction(s, { kind: "returnMeal" });
  assert.equal(s.state.food, food);
  assert.equal(s.state.meals, 0);
  assert.equal(worldAction(s, { kind: "returnMeal" }).state.food, food);
  s.world.lockers.water = false;
  assert.equal(command(s, "fill").state.bottle, 0);
});
test("individual field tools transfer between physical cabinets and the carried pack", () => {
  let s = createSession(
    missions[2],
    design,
    life,
    missions[2].requiredEquipment,
    qualified(2),
  );
  s = stand(s, "science");
  assert.ok(s.world.stored.includes("scanner"));
  s = worldAction(s, { kind: "take", id: "scanner" });
  assert.ok(s.pack.includes("scanner"));
  assert.equal(s.world.stored.includes("scanner"), false);
  const twice = worldAction(s, { kind: "take", id: "scanner" });
  assert.equal(twice.pack.filter((g) => g === "scanner").length, 1);
  s = worldAction(s, { kind: "store", id: "scanner" });
  assert.equal(s.pack.includes("scanner"), false);
  assert.equal(s.world.stored.filter((g) => g === "scanner").length, 1);
});
test("spare parts and suits can be stowed and recovered through their local lockers", () => {
  let s = createSession(
    missions[1],
    design,
    life,
    missions[1].requiredEquipment,
    qualified(),
  );
  s = stand(s, "equipment");
  const parts = s.state.parts;
  s = worldAction(s, { kind: "storeParts" });
  assert.equal(s.world.partsStored, 1);
  s = worldAction(s, { kind: "takeParts" });
  assert.equal(s.state.parts, parts);
  const oxygen = s.state.oxygen;
  s = command(s, "equipSuit");
  assert.ok(s.suit.equipped);
  s = worldAction(s, { kind: "stowSuit" });
  assert.equal(s.suit.equipped, false);
  assert.equal(s.state.oxygen, oxygen);
});
test("console switches change actual solar generation, recycler recovery and science availability", () => {
  let s = createSession(missions[0], design, life, [], emptyProgress());
  s = stand(s, "power");
  s.state.battery = 0.5;
  s.world.nextFault = 99999;
  const normal = tickSession(s, 1);
  const off = worldAction(s, { kind: "switch", id: "solar" });
  assert.ok(tickSession(off, 1).state.battery < normal.state.battery);
  s = worldAction(s, { kind: "switch", id: "water" });
  s = stand(s, "galley");
  s.state.bottle = 1;
  const water = s.state.water;
  s = command(s, "drink");
  assert.equal(s.state.water, water);
  s = stand(s, "power");
  s = worldAction(s, { kind: "switch", id: "science" });
  s = stand(s, "science");
  const science = s.state.science;
  s = command(s, "science");
  assert.equal(s.state.science, science);
});
test("dynamic faults use persistent seeded state and do not stack or spam", () => {
  let s = createSession(missions[0], design, life, [], emptyProgress());
  s.flight.status = "orbit";
  s.state.minutes = 180;
  s.world.nextFault = 180;
  let seed = 0;
  while (seed < 20000) {
    const value = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    if (value / 4294967296 < 0.11) break;
    seed++;
  }
  s.world.rng = seed;
  s = tickShip(s, 1);
  assert.equal(s.world.faults.length, 1);
  assert.ok(
    shipAlerts(s).some((a) => a.level === "CAUTION" || a.level === "WARNING"),
  );
  const count = s.world.faults.length;
  s.state.minutes = 1000;
  s = tickShip(s, 1);
  assert.equal(s.world.faults.length, count);
});
test("fault repair requires diagnosis, access, isolation, tools and one part, then verification", () => {
  let s = createSession(missions[0], design, life, [], emptyProgress());
  s = stand(s, "power");
  s.world.faults = [
    {
      id: "test",
      kind: "solar",
      diagnosed: false,
      repaired: false,
      verified: false,
      at: 0,
    },
  ];
  s.world.lockers.maintenance = false;
  const parts = s.state.parts;
  s = worldAction(s, { kind: "repairFault", id: "test" });
  assert.equal(s.state.parts, parts);
  s = worldAction(s, { kind: "diagnose", id: "test" });
  s = worldAction(s, { kind: "locker", id: "maintenance" });
  s = worldAction(s, { kind: "switch", id: "solar" });
  s.state.tools = true;
  s = worldAction(s, { kind: "repairFault", id: "test" });
  assert.equal(s.state.parts, parts - 1);
  assert.equal(s.world.faults[0].verified, false);
  assert.equal(
    worldAction(s, { kind: "repairFault", id: "test" }).state.parts,
    parts - 1,
  );
  s = worldAction(s, { kind: "switch", id: "solar" });
  s = worldAction(s, { kind: "verifyFault", id: "test" });
  assert.equal(s.world.faults[0].verified, true);
});
test("physical state, stocks, switches and condition persist; pre-update checkpoints migrate safely", () => {
  const started = launchMission(missions[0], design, life, [], emptyProgress());
  let s = stand(started.session, "galley");
  s = command(s, "takeMeal");
  s = worldAction(s, { kind: "returnMeal" });
  const store = { ...newStore(), session: s, progress: started.progress };
  const restored = decodeStore(JSON.stringify(store));
  assert.deepEqual(restored.session!.world, s.world);
  const previous = structuredClone(store);
  delete (previous.session as Partial<Session>).world;
  assert.ok(decodeStore(JSON.stringify(previous)).session!.world);
  const invalid = structuredClone(store);
  (invalid.session.world.switches as any).water = "bad";
  assert.throws(() => decodeStore(JSON.stringify(invalid)), /circuit/);
});
test("spacecraft and equipment maintenance charge Agency Budget exactly once per repair", () => {
  let p = emptyProgress();
  p.condition = { ...nominalCondition(), communications: 70 };
  p.equipmentCondition = { scanner: 91 };
  const before = p.economy.balance;
  p = service(p, "communications");
  assert.equal(p.condition!.communications, 100);
  assert.equal(p.economy.balance, before - 1.2);
  assert.equal(service(p, "communications"), p);
  const cost = equipmentServiceCost(91),
    balance = p.economy.balance;
  p = serviceEquipment(p, "scanner");
  assert.equal(p.equipmentCondition!.scanner, 100);
  assert.equal(p.economy.balance, Math.round((balance - cost) * 100) / 100);
  assert.equal(serviceEquipment(p, "scanner"), p);
});
test("samples retain location, mass, time and scientific classification when stored", () => {
  let s = createSession(
    missions[2],
    design,
    life,
    missions[2].requiredEquipment,
    qualified(2),
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
  s.pack = ["drill", "containers"];
  s.world.stored = s.world.stored.filter((g) => !s.pack.includes(g));
  s.position = { x: -6, z: 23, heading: 0 };
  s = command(s, "drill");
  assert.equal(s.samples[0].mass, 0.32);
  assert.equal(s.samples[0].location, "crater");
  assert.equal(s.samples[0].scientificValue, "High");
  s.position = { x: -1.1, z: -3.1, heading: 0 };
  s.world.lockers.samples = true;
  s = worldAction(s, { kind: "storeSamples" });
  assert.equal(s.samples.length, 0);
  assert.equal(s.world.storedSamples.length, 1);
  assert.equal(makeReport(s, false).sampleManifest!.length, 1);
  const archived = s.world.storedSamples[0];
  s = worldAction(s, { kind: "retrieveSample", id: archived.id });
  assert.equal(s.samples[0].id, archived.id);
  assert.equal(s.samples[0].collectedAt, archived.collectedAt);
  assert.equal(s.world.storedSamples.length, 0);
  assert.equal(makeReport(s, false).sampleManifest!.length, 1);
});
test("Mission Control messages arrive on mission time and controls stay free-roam", () => {
  let s = createSession(missions[0], design, life, [], emptyProgress());
  assert.equal(
    s.world.messages.some((m) => m.source === "MISSION CONTROL"),
    false,
  );
  s = tickSession(s, 3);
  assert.ok(s.world.messages.some((m) => m.source === "MISSION CONTROL"));
  s = stand(s, "power");
  const objective = s.objective;
  s = worldAction(s, { kind: "switch", id: "emergency" });
  assert.equal(s.world.switches.emergency, true);
  assert.equal(s.objective, objective);
});


test("navigation map uses real mission location names and includes airlock locations", () => {
  const s = createSession(missions.find((m) => m.implemented)!, design, life, [], emptyProgress());
  const map = renderToStaticMarkup(createElement(NavigationContent, { s }));
  assert.match(map, /Power &amp; life support/);
  assert.match(map, /Inner airlock hatch/);
  assert.match(map, /Outer airlock hatch/);
  assert.match(map, /CURRENT OBJECTIVE LOCATION/);
  assert.doesNotMatch(map, /stroke-dasharray|CURRENT TARGET/);
});

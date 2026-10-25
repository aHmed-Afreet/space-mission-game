import { doors, lockers, worldAction, equipmentLocker } from "./ship";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { missions, missionById, type MissionDefinition } from "./definitions";
import { campaigns, campaignLevel, previousInCampaign } from "./campaignTypes";
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
  rendezvousBlocker,
  satelliteRepairBlocker,
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
import { objectiveGuide } from "./objectiveGuide";
import { recoveryMission } from "./recovery";
import { readPreferences, writePreferences } from "./preferences";
import { historyMissions } from "../../history/missionHistory";
import {planetKind} from "../celestial";
import {missionProfiles,missionProfile} from "../../history/missionProfiles";
import { createStoryScenario,historicalCraft,historicalSetting } from "../../history/storyScenarios";
import { officialFilms, officialFilmFor } from "../../history/officialFilms";
import {storyVideoChapters,storyVideoWorld,STORY_VIDEO_CHAPTER_SECONDS} from "../../history/StoryBriefingVideo";
import { pilotBriefing, pilot } from "../../missionCrew";
import { strategyChallenges } from "../../strategyChallenges";

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
  assert.equal(missions.length, 18);
  assert.equal(missions.filter((m) => m.implemented).length, 18);
  assert.equal(new Set(missions.map((m) => m.id)).size, 18);
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
  assert.equal(canStart(missions[1], p), true);
  assert.doesNotThrow(() =>
    createSession(missions[1], design, life, [...missions[1].requiredEquipment], p));
  assert.throws(() => createSession(missions[4], design, life, [], p));
  const s = createSession(missions[0], design, life, [], p);
  const late = command(s, "insertOrbit");
  assert.equal(late.objective, 0);
  assert.equal(late.flight.status, "pad");
});
test("all playable campaign flights finish launch, operations and recovery with independent branches", () => {
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
test("Mission 2 connector replacement identifies every missing requirement and finishes when equipped",()=>{
 const mission=missions[1];
 let s=createSession(mission,design,life,mission.requiredEquipment,qualified());
 s={...s,
   flight:{...s.flight,status:"orbit"},
   position:{x:1.8,z:14,heading:0},
   airlock:{...s.airlock,outer:true,pressure:0},
   suit:{...s.suit,equipped:true,oxygen:.3,power:.6},
   objective:mission.objectives.findIndex(o=>o.action==="repairSatellite"),
   pack:[],systems:{...s.systems,satelliteDiagnosed:false},
   state:{...s.state,paused:false,parts:1},
 };
 assert.ok(s.objective>0);
 assert.match(satelliteRepairBlocker(s)!,/Inspect the satellite service panel/);
 s={...s,systems:{...s.systems,satelliteDiagnosed:true}};
 assert.match(satelliteRepairBlocker(s)!,/Repair toolkit not carried/);
 const missingToolkit=command(s,"repairSatellite");
 assert.equal(missingToolkit.objective,s.objective);
 assert.match(missingToolkit.notice,/TAKE the repair toolkit/);
 s={...s,pack:["repair"],state:{...s.state,parts:0}};
 assert.match(satelliteRepairBlocker(s)!,/No spare connector part carried/);
 s={...s,state:{...s.state,parts:1},suit:{...s.suit,power:.02}};
 assert.match(satelliteRepairBlocker(s)!,/Suit battery below 5%/);
 s={...s,suit:{...s.suit,power:.7}};
 assert.equal(satelliteRepairBlocker(s),null);
 const repaired=command(s,"repairSatellite");
 assert.equal(repaired.state.parts,0);
 assert.ok(repaired.objective>s.objective,"repair must advance from step 31 to 32");
 assert.equal(repaired.systems.satelliteRepaired,true);
 const guide=objectiveGuide(s);
 assert.match(guide.steps.map(x=>x.text).join(" "),/Repair cabinet and TAKE the toolkit/);
 assert.match(guide.next,/Ready: tap Replace satellite connector/);
});
test("Orbital EVA collisions prevent walking through the satellite core or leaving work platform",()=>{
 const mission=missions[1];
 const initial=createSession(mission,design,life,mission.requiredEquipment,qualified());
 const s={...initial,flight:{...initial.flight,status:"orbit" as const},
   suit:{...initial.suit,equipped:true},
   airlock:{...initial.airlock,outer:true,pressure:0}};
 assert.equal(campaignWalkable(1.8,14,s),true,"service panel approach must remain accessible");
 assert.equal(campaignWalkable(2.4,15.08,s),false,"satellite central hull is solid");
 assert.equal(campaignWalkable(3.2,14,s),false,"work platform has a tether boundary");
 assert.equal(campaignWalkable(0,18,s),false,"cannot walk off the end of the platform");
 assert.equal(campaignWalkable(0,12,s),true,"airlock exit lane must remain traversable");
 const previousOuter={...s,position:{x:3.5,z:14,heading:0}};
 assert.equal(campaignWalkable(3.48,14,previousOuter),true,
   "older saves outside new rail boundary can move inward");
 assert.equal(campaignWalkable(3.52,14,previousOuter),false,
   "cannot move farther off the orbital platform");
 const previousCore={...s,position:{x:2.4,z:15.08,heading:0}};
 assert.equal(campaignWalkable(2.4,15.04,previousCore),true,
   "older saves inside satellite core can escape");
 assert.equal(campaignWalkable(2.4,15.08,previousCore),false,
   "satellite body cannot be traversed farther inward");
});
test("Orbital EVA backdrop and exterior details remain available offline",()=>{
 const world=readFileSync("src/commander/campaign/world.ts","utf8");
 const inside=readFileSync("src/commander/interior.ts","utf8");
 assert.match(world,/skyCanvas.width=1024/);
 assert.match(world,/SphereGeometry\(56,36,24\)/);
 assert.match(world,/texture[s]?.forEach/);
 assert.match(world,/photovoltaic cells/);
 assert.match(inside,/Integrated equipment conduits/);
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
  assert.equal(environments.mars.available, true);
  assert.equal(environments.asteroid.available, true);
  assert.equal(environments.europa.available, false);
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
  // Guard the campaign entry points, not stale source-file fingerprints:
  // Strategy Mode was intentionally expanded with selectable levels.
  const strategySource=readFileSync("src/App.tsx","utf8");
  assert.match(strategySource,/strategyChallenges/);
  assert.match(strategySource,/strategyUnlocked/);
  assert.match(readFileSync("src/game.ts","utf8"),/export (const|function) resources/);
  assert.ok(existsSync("src/strategyChallenges.ts"));
});

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
test("scripted recovery waits for its objective while real orbital hardware faults slow acceleration", () => {
  let s = createSession(missions[0], design, life, [], emptyProgress());
  s.flight.status = "orbit";
  s.observations.orbitMinute = 0;
  s.simRate = 20;
  const goal = s.objective;
  const powerTask = missions[0].objectives.find(o => o.event === "power")!;
  s = tickSession(s, 9);
  assert.equal(s.objective, goal);
  assert.equal(s.state.malfunction, false);
  assert.equal(s.eventIds.includes(powerTask.id), false,
    "scripted warning cannot interrupt unrelated early orbital tasks");
  s.world.faults.push({id:"physical-fault",kind:"navigation",
    diagnosed:false,repaired:false,verified:false,at:s.state.minutes});
  s.simRate = 20;
  s = tickSession(s, 0.25);
  assert.equal(s.simRate, 1,"real hardware faults still slow the simulation");
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

test("existing NASA-inspired missions retain citations; new fictional distant sorties are clearly labeled", () => {
  const stories = missions.filter(m=>m.implemented);
  assert.deepEqual(stories.slice(0,4).map(m=>m.historical?.year),[1981,2009,1971,1972]);
  for (const m of stories.slice(0,12)) {
    assert.ok(m.historical);
    assert.match(m.historical!.source, /^https:\/\/www\.nasa\.gov\//);
    assert.match(m.historical!.disclaimer, /fictional|fiction|imagined/i);
    assert.ok(m.historical!.learning.length>=4);
  }
  for (const m of stories.slice(12)) {
    assert.equal(m.historical, undefined, "Do not invent a NASA mission link for fictional new flights");
    assert.match(m.description,/Educational cruise\/orbital training; no surface landing/);
    assert.ok(m.objectives.some(o=>/check|inspect|scan|record|collect|repair|test|verify/i.test(o.title)));
  }
});
test("settings load safely and reject invalid saved preferences", () => {
  const memory = new Map<string,string>();
  const storage={getItem:(k:string)=>memory.get(k)||null,setItem:(k:string,v:string)=>{memory.set(k,v)}};
  const defaults=readPreferences(storage);
  assert.equal(defaults.graphics,"balanced");
  writePreferences(storage,{graphics:"quality",lookSensitivity:1.4,showHints:false});
  const prefs=readPreferences(storage);
  assert.equal(prefs.graphics,"quality");
  assert.equal(prefs.lookSensitivity,1.4);
  assert.equal(prefs.showHints,false);
  memory.set("orbital-player-settings-v1", JSON.stringify({graphics:"invalid",lookSensitivity:100,showHints:"no"}));
  assert.deepEqual(readPreferences(storage),{graphics:"balanced",lookSensitivity:1.8,showHints:true});
  memory.set("orbital-player-settings-v1","{invalid");
  assert.deepEqual(readPreferences(storage),defaults);
});
test("published privacy page and release disclaimer exist", () => {
  assert.ok(existsSync("public/privacy.html"));
  const privacy=readFileSync("public/privacy.html","utf8");
  assert.match(privacy,/local storage/i);
  assert.match(privacy,/Reset campaign progress/i);
  assert.match(privacy,/NASA does not operate or endorse/i);
});

test("main menu contains exactly four commands with a combined history and story entry", () => {
  const menu = readFileSync("src/ModeSelect.tsx", "utf8");
  const history = readFileSync("src/history/HistoryHub.tsx", "utf8");
  assert.equal((menu.match(/id: "(?:commander|strategy|history|guide)", number:/g) || []).length, 4);
  assert.match(menu, /title: "Explore Space History"/);
  assert.match(menu, /experiences\.map\(item => <button/);
  assert.doesNotMatch(menu, /setMode\("stories"\)/);
  assert.match(history, />READ HISTORY<\/button>/);
  assert.match(history, />LIVE THE STORY<\/button>/);
});

test("all 55 history entries have mission-specific spacecraft and first-person objectives", () => {
  assert.equal(historyMissions.length,55);
  const scenarios=historyMissions.map(createStoryScenario);
  assert.equal(new Set(scenarios.map(s=>s.missionId)).size,55);
  assert.ok(new Set(scenarios.map(s=>s.family)).size>=10);
  for (let i=0;i<scenarios.length;i++){
    const s=scenarios[i],m=historyMissions[i];
    assert.equal(s.destination,m.destination);
    assert.ok(s.tasks.length>=4&&s.tasks.length<=7);
    if(m.title==="Apollo 11"){
      assert.equal(s.tasks[0].fieldAction,"egress");
      assert.equal(s.tasks.at(-1)?.fieldAction,"return");
      assert.ok(s.tasks.every(t=>t.fieldAction));
    }else{
      assert.equal(s.tasks[0].station,"brief");
      assert.ok(s.tasks.some(t=>t.station==="systems"));
      assert.ok(s.tasks.some(t=>t.station==="operations"));
      assert.ok(s.tasks.some(t=>t.station==="science"));
    }
    assert.equal(new Set(s.tasks.map(t=>t.id)).size,s.tasks.length);
    assert.ok(s.craft.length>12);
    for(const task of s.tasks){
      assert.ok(task.heading.length>=14);
      assert.ok(task.procedure.length>=22);
    }
    assert.equal(s.role==="astronaut",m.category==="Crewed"||m.category==="Space station");
    assert.match(s.historicalNote,/not an exact reconstruction/i);
  }
});
test("important spacecraft use period-specific equipment and historical tasks",()=>{
 const get=(title:string)=>createStoryScenario(historyMissions.find(m=>m.title===title)!);
 assert.match(get("Apollo 11").tasks[0].heading,/Exit Eagle/i);
 assert.match(get("Apollo 11").tasks[2].heading,/Photograph/i);
 assert.match(get("Apollo 13").tasks[1].procedure,/lifeboat/i);
 assert.match(get("Voyager 1").tasks[1].procedure,/without using solar/i);
 assert.match(get("Vostok 1").tasks[3].procedure,/parachute/i);
 assert.match(get("STS-125 Hubble servicing").tasks[2].heading,/service Hubble/i);
 assert.equal(get("Perseverance").role,"mission operator");
 assert.equal(historicalCraft(historyMissions.find(m=>m.title==="James Webb Telescope")!).family,"observatory");
});
test("live history starts a 3D first-person scene with controls",()=>{
 const hub=readFileSync("src/history/HistoryHub.tsx","utf8");
 const flight=readFileSync("src/history/StoryFlight.tsx","utf8");
 const world=readFileSync("src/history/storyWorld.ts","utf8");
 assert.match(hub,/if\(chosen&&view==="live"\)return <StoryFlight/);
 assert.match(flight,/joystickVector/);
 assert.match(flight,/INTERACT/);
 assert.match(flight,/VERIFY POWER & THERMAL STATUS/);
 assert.match(world,/new THREE.WebGLRenderer/);
 assert.match(world,/createHistoricVehicle/);
});

test("historic first-person missions use 55 distinctive vehicles and flight objectives",()=>{
 assert.equal(Object.keys(missionProfiles).length,55);
 for(const m of historyMissions){
  const sc=createStoryScenario(m),p=missionProfile(m.title);
  assert.equal(sc.craft,p.vehicle);
  assert.equal(sc.profile.hardware,p.hardware);
  if(m.title==="Apollo 11"){
    assert.deepEqual(sc.tasks.map(t=>t.fieldAction),["egress","walk","photo","sample","flag","return"]);
    assert.match(sc.tasks[3].procedure,/contingency/i);
  }else{
    assert.ok(sc.tasks.some(t=>t.procedure.includes(p.hardware)));
    assert.ok(sc.tasks.some(t=>t.procedure.includes(p.operation)));
    assert.ok(sc.tasks.some(t=>t.procedure.includes(p.observation)));
  }
 }
 assert.equal(historicalSetting(historyMissions.find(m=>m.title==="Apollo 8")!),"deep");
 assert.equal(historicalSetting(historyMissions.find(m=>m.title==="Apollo 13")!),"deep");
 assert.equal(historicalSetting(historyMissions.find(m=>m.title==="Apollo 11")!),"moon");
 assert.equal(historicalCraft(historyMissions.find(m=>m.title==="Ingenuity")!).family,"helicopter");
 assert.match(readFileSync("src/history/historicVehicles.ts","utf8"),/createHistoricVehicle/);
});

test("planet visuals classify orbital and planetary destinations accurately",()=>{
 assert.equal(planetKind("Moon"),"moon");
 assert.equal(planetKind("Jupiter system"),"jupiter");
 assert.equal(planetKind("Mars"),"mars");
 assert.equal(planetKind("Earth orbit"),"earth");
 const source=readFileSync("src/commander/celestial.ts","utf8");
 assert.match(source,/CanvasTexture/);
 assert.match(source,/makePlanet/);
 assert.match(source,/clouds/);
});
test("historical stories have airlocks, suit requirement, safe return and real exterior terrain",()=>{
 const s=readFileSync("src/history/StoryFlight.tsx","utf8");
 const world=readFileSync("src/history/storyWorld.ts","utf8");
 assert.match(s,/EQUIP PROTECTIVE SPACE SUIT/);
 assert.match(s,/CLOSE OUTER HATCH.*ENTER/);
 assert.match(s,/SIMULATE DEPRESSURIZATION/);
 assert.match(s,/verticalTouch/);
 assert.match(s,/if\(!canEva/);
 assert.match(s,/oxygenRef\.current<=0/);
 assert.match(world,/setExcursion/);
 assert.match(world,/nearHatch/);
 assert.match(world,/distanceToHatch/);
 assert.match(world,/motion.clampLength/);
 assert.match(world,/jumpSpeed/);
 assert.match(world,/tether.geometry.attributes.position/);
 assert.match(world,/floor\.visible=!next/);
 assert.match(world,/makePlanet/);
 assert.match(world,/SUIT/gi);
});
test("Commander cabinet inventory, visible EVA suit and both-sided hatch buttons",()=>{
 const cabin=readFileSync("src/commander/Cabin.tsx","utf8");
 const fixtures=readFileSync("src/commander/campaign/fixtures.ts","utf8");
 const field=readFileSync("src/commander/campaign/world.ts","utf8");
 const flight=readFileSync("src/commander/campaign/Flight.tsx","utf8");
 const engine=readFileSync("src/commander/campaign/engine.ts","utf8");
 assert.match(cabin,/kind:"airlock"/);
 assert.match(cabin,/for\(const x of \[-1\.08,1\.08,\.53,0\]\)/);
 assert.match(cabin,/distance:3\.5/);
 assert.match(cabin,/OPEN/);
 assert.match(fixtures,/for\(const face of \[-1,1\]\)/);
 assert.match(fixtures,/leafSwitches/);
 assert.match(fixtures,/hatchGreen/);
 assert.match(fixtures,/key==="eva"/);
 assert.match(fixtures,/key==="samples"/);
 assert.match(fixtures,/COMPARTMENT EMPTY/);
 assert.match(fixtures,/A hollow stowage compartment/);
 assert.match(field,/orbitEarth/);
 assert.match(flight,/target\?\.kind==="airlock"/);
 assert.match(engine,/atSite\(s, "outerHatch"\)/);
 const interior=readFileSync("src/commander/interior.ts","utf8");
 assert.match(interior,/evaHands\.visible/);
 assert.match(interior,/flightDoorButtons/);
 assert.match(interior,/EVA LOCKED/);
 assert.match(flight,/hatchNotice/);
});

test("realism update preserves physical EVA hatch targeting and distinct exterior physics",()=>{
 const story=readFileSync("src/history/storyWorld.ts","utf8");
 const flow=readFileSync("src/history/StoryFlight.tsx","utf8");
 const commander=readFileSync("src/commander/Cabin.tsx","utf8");
 const images=readFileSync("src/commander/celestial.ts","utf8");
 assert.match(story,/aimingAtHatch/);
 assert.match(story,/nearHatch\(\)/);
 assert.match(story,/tetherMaterial/);
 assert.match(story,/jumpSpeed-=gravity\*time/);
 assert.match(story,/if\(outside&&!dusty\)/);
 assert.match(flow,/hatchAim/);
 assert.match(flow,/AIRLOCK CONTROL · PRESS INTERACT/);
 assert.match(commander,/orbitalThrust\.current/);
 assert.match(commander,/SPACE\/CTRL EVA THRUSTERS/);
 assert.match(images,/TextureLoader/);
 assert.match(images,/earth_atmos_2048/);
 assert.match(images,/moon_1024/);
});

test("quality setting adds surface microdetail without affecting battery mode",()=>{
 const cabin=readFileSync("src/commander/Cabin.tsx","utf8");
 const interior=readFileSync("src/commander/interior.ts","utf8");
 assert.match(cabin,/graphics: props.settings\?\.graphics/);
 assert.match(interior,/options.graphics === "quality"/);
 assert.match(interior,/bumpMap/);
 assert.match(interior,/CanvasTexture/);
});

test("door aim feedback matches the real physical interaction distance",()=>{
 const cabin=readFileSync("src/commander/Cabin.tsx","utf8");
 const flight=readFileSync("src/commander/campaign/Flight.tsx","utf8");
 assert.match(cabin,/MOVE CLOSER/);
 assert.match(flight,/Move closer to the illuminated hatch control/);
 assert.match(flight,/Math\.abs\(s\.position\.z-door\.z\)>1\.6/);
});

test("new spacecraft visuals are instanced and do not relocate mission stations",()=>{
 const interior=readFileSync("src/commander/interior.ts","utf8");
 const architecture=readFileSync("src/commander/shipArchitecture.ts","utf8");
 const story=readFileSync("src/history/storyWorld.ts","utf8");
 const bridge=readFileSync("src/history/storyBridge.ts","utf8");
 assert.match(interior,/installShipArchitecture\(part,pipe,screen,label,mat/);
 assert.match(interior,/InstancedMesh/);
 assert.match(architecture,/panoramic canopy/i);
 assert.match(architecture,/pressure tunnel/i);
 assert.match(architecture,/FLIGHT CONTROL/);
 assert.match(story,/installStoryBridge\(deck,scenario\)/);
 assert.match(bridge,/new THREE.InstancedMesh/);
 assert.match(bridge,/CREW VEHICLE/);
 assert.match(bridge,/GROUND MISSION CONTROL/);
});
test("performance options adapt iPad image quality without removing controls",()=>{
 const cabin=readFileSync("src/commander/Cabin.tsx","utf8");
 const story=readFileSync("src/history/storyWorld.ts","utf8");
 assert.match(cabin,/targetFps=graphicsMode==="battery"\?30:60/);
 assert.match(cabin,/actualFps<targetFps/);
 assert.match(cabin,/renderer.setPixelRatio\(renderRatio\)/);
 assert.match(cabin,/movement.forward/);
 assert.match(cabin,/kind:"airlock"/);
 assert.match(story,/now-lastRender>=14/);
 assert.match(story,/pixelRatio=desired/);
 assert.match(story,/aimingAtHatch/);
});


test("mission 2 rendezvous objective advances when its cockpit procedure is confirmed",()=>{
 const mission=missionById("mission-2");
 const objective=mission.objectives.findIndex(o=>o.action==="approach");
 assert.ok(objective>0,"rendezvous task must exist");
 let s=createSession(mission,design,life,mission.requiredEquipment,qualified(1));
 s={...s,objective,position:{x:0,z:-5.2,heading:0},
     flight:{...s.flight,status:"orbit"},state:{...s.state,paused:false}};
 const completed=command(s,"approach");
 assert.ok(completed.objective>objective,
   "performing the navigation manoeuvre from the cockpit must advance the mission");
});
test("Mission 2 supports accessible tap-to-operate and an automatic alignment option",()=>{
 const flight=readFileSync("src/commander/campaign/Flight.tsx","utf8");
 const cabin=readFileSync("src/commander/Cabin.tsx","utf8");
 const panel=readFileSync("src/commander/campaign/RendezvousConsole.tsx","utf8");
 assert.match(flight,/RendezvousConsole/);
 assert.match(flight,/OPERATE RENDEZVOUS COMPUTER/);
 assert.match(flight,/onComplete=\{\(\)=>run\("approach"\)\}/);
 assert.match(cabin,/wasTap/);
 assert.match(cabin,/props.onInteract\(a\)/);
 assert.match(panel,/Run auto-guidance/);
 assert.match(panel,/Confirm approach manoeuvre/);
 assert.match(panel,/role="dialog"/);
});
test("Realism materials preserve performance and have an offline asset fallback",()=>{
 const file=readFileSync("src/commander/cabinDetailPass.ts","utf8");
 const interior=readFileSync("src/commander/interior.ts","utf8");
 assert.match(file,/installCabinDetail/);
 assert.match(file,/new T.CanvasTexture/);
 assert.match(file,/CatmullRomCurve3/);
 assert.match(file,/materials.fabric.bumpMap/);
 assert.match(interior,/disposeDetails\(\)/);
});

test("satellite reference model is lazy, attributed and has an offline fallback",()=>{
 const field=readFileSync("src/commander/campaign/world.ts","utf8");
 const interior=readFileSync("src/commander/Cabin.tsx","utf8");
 assert.match(field,/missionId==="mission-2"/);
 assert.match(field,/NASA-3D-Resources/);
 assert.match(field,/GLTFLoader/);
 assert.match(field,/Offline: original low-cost model remains visible/);
 assert.match(interior,/props.world!\.session.missionId/);
});

test("Mission 2 orbital rendezvous always has a discoverable touch control and a pause explanation",()=>{
 const flight=readFileSync("src/commander/campaign/Flight.tsx","utf8");
 const consoleSource=readFileSync("src/commander/campaign/RendezvousConsole.tsx","utf8");
 assert.match(flight,/OPEN NAVIGATION COMPUTER/);
 assert.match(flight,/setRendezvousOpen\(true\)/);
 assert.match(flight,/Controls and mission actions are disabled while paused/);
 assert.match(flight,/onComplete=\{\(\)=>run\("approach"\)\}/);
 assert.match(consoleSource,/Confirm approach manoeuvre/);
 assert.match(consoleSource,/rendezvousBlocker\(session\)/);
 assert.match(flight,/Close only after the actual campaign objective advances/);
});
test("Mission 2 confirmation advances valid objectives and explains blocked attempts",()=>{
 const mission=missionById("mission-2");
 const objective=mission.objectives.findIndex(o=>o.action==="approach");
 const started=createSession(mission,design,life,mission.requiredEquipment,qualified(1));
 const s={...started,objective,position:{x:0,z:-5.2,heading:0},
   flight:{...started.flight,status:"orbit" as const},
   state:{...started.state,paused:false}};
 assert.equal(rendezvousBlocker(s),null);
 assert.ok(command(s,"approach").objective>objective);
 const far={...s,position:{x:2.2,z:0.45,heading:0}};
 assert.match(rendezvousBlocker(far)!,/Flight deck/);
 const rejected=command(far,"approach");
 assert.equal(rejected.objective,objective);
 assert.match(rejected.notice,/Flight deck/);
 const paused={...s,state:{...s.state,paused:true}};
 assert.match(rendezvousBlocker(paused)!,/paused/);
 assert.equal(command(paused,"approach").objective,objective);
 const noNavigation={...s,world:{...s.world,switches:{...s.world.switches,navigation:false}}};
 assert.match(rendezvousBlocker(noNavigation)!,/navigation computer circuit/);
 assert.equal(command(noNavigation,"approach").objective,objective);
 const lowFuel={...s,state:{...s.state,fuel:1}};
 assert.match(rendezvousBlocker(lowFuel)!,/2 fuel/);
 assert.equal(command(lowFuel,"approach").objective,objective);
});
test("Mission 2 does not trigger its recovery fault during rendezvous and restores stuck saves",()=>{
 const m=missionById("mission-2");
 const rendezvous=m.objectives.findIndex(o=>o.action==="approach");
 const recovery=m.objectives.findIndex(o=>o.event==="power");
 const warning=m.objectives[recovery];
 assert.ok(recovery>rendezvous,"the scripted bus warning belongs to a later phase");
 let s=createSession(m,design,life,m.requiredEquipment,qualified(1));
 s={...s,objective:rendezvous,position:{x:0,z:-5.2,heading:0},
    flight:{...s.flight,status:"orbit"},state:{...s.state,paused:false,minutes:121},
    observations:{...s.observations,orbitMinute:95}};
 // Time in orbit exceeded 8 minutes, but the future recovery warning must wait.
 s=tickSession(s,0.5);
 assert.equal(s.state.malfunction,false);
 assert.equal(s.eventIds.includes(warning.id),false);
 // An existing iPad checkpoint may contain the premature scripted fault.
 const stale={...s,eventIds:[...s.eventIds,warning.id],
   state:{...s.state,malfunction:true}};
 assert.equal(rendezvousBlocker(stale),null);
 const fixed=command(stale,"approach");
 assert.ok(fixed.objective>rendezvous,"confirm must advance objective 15");
 assert.equal(fixed.state.malfunction,false);
 assert.equal(fixed.eventIds.includes(warning.id),false);
 // The warning still occurs at the actual recovery checklist, not earlier.
 let later={...fixed,objective:recovery};
 later=tickSession(later,0.5);
 assert.equal(later.state.malfunction,true);
 assert.ok(later.eventIds.includes(warning.id));
 // Real hardware failures remain blocking; the fix is not a safety bypass.
 const hardware={...stale,world:{...stale.world,faults:[{
   id:"actual-bus-fault",kind:"bus" as const,diagnosed:false,repaired:false,
   verified:false,at:120
 }]}};
 assert.match(rendezvousBlocker(hardware)!,/malfunction/);
 assert.equal(command(hardware,"approach").objective,rendezvous);
});
test("Task guide explains power choices, required diagnosis, guarded return burn and rendezvous",()=>{
 const m=missionById("mission-1");
 const initial=createSession(m,design,life,[],emptyProgress());
 const power=sitePosition("power",m.destination);
 const atPower={...initial,position:{...power,heading:0}};
 const planIndex=m.objectives.findIndex(o=>o.title==="Choose the orbital power plan.");
 assert.ok(planIndex>=0);
 const plan={...atPower,objective:planIndex};
 const planInstructions=objectiveGuide(plan);
 assert.match(planInstructions.next,/Tap one of the power-plan choices/);
 assert.match(planInstructions.steps.map(x=>x.text).join(" "),/Conserve power saves 0.10 kWh/);
 const warningIndex=m.objectives.findIndex(o=>o.title==="Resolve the power-bus warning.");
 const warning={...atPower,objective:warningIndex,
   state:{...atPower.state,malfunction:true},
   observations:{...atPower.observations,powerDiagnosed:false}};
 const before=structuredClone(warning);
 const instruction=objectiveGuide(warning);
 assert.match(instruction.next,/Inspect power and diagnose faults/);
 assert.match(instruction.steps.map(x=>x.text).join(" "),/Bypass the failed branch/);
 assert.match(instruction.steps.map(x=>x.text).join(" "),/maintenance access, isolate Bus B/);
 assert.deepEqual(warning,before,"Showing instructions must not change the saved session");
 const diagnosed={...warning,observations:{...warning.observations,powerDiagnosed:true}};
 assert.match(objectiveGuide(diagnosed).next,/Choose Bypass/);
 const returnIndex=m.objectives.findIndex(o=>o.action==="returnBurn");
 const cockpit=sitePosition("cockpit",m.destination);
 const burn={...initial,objective:returnIndex,position:{...cockpit,heading:0},
   world:{...initial.world,target:"earth" as const,switches:{...initial.world.switches,maneuver:false}}};
 assert.match(objectiveGuide(burn).next,/Turn ON Guarded manoeuvre arm/);
 const armed={...burn,world:{...burn.world,switches:{...burn.world.switches,maneuver:true}}};
 assert.match(objectiveGuide(armed).next,/Start the controlled return burn/);
 const elsewhere={...armed,position:{x:0,z:0,heading:0}};
 assert.match(objectiveGuide(elsewhere).next,/Go to Flight deck/);
 const m2=missionById("mission-2");
 const satellite=createSession(m2,design,life,m2.requiredEquipment,qualified(1));
 const rendezvous=m2.objectives.findIndex(o=>o.action==="approach");
 const aligned={...satellite,objective:rendezvous};
 assert.match(objectiveGuide(aligned).steps.map(x=>x.text).join(" "),/Run auto-guidance/);
});
test("Paused mission keeps Resume and Save accessible without overlapping objective help",()=>{
 const flight=readFileSync("src/commander/campaign/Flight.tsx","utf8");
 const css=readFileSync("src/commander/campaign/campaign.css","utf8");
 assert.ok(flight.includes('!s.state.paused && <div className={`campaign-guidance'),"hide HUD objective card while paused");
 assert.ok(flight.includes('      </div>}\n      {!recovery && m.id==="mission-2"'),"close the pause condition before other overlays");
 assert.match(flight,/s.state.paused && !tutorial && !tablet && !rendezvousOpen/);
 assert.match(flight,/role="region" aria-label="Mission paused"/);
 assert.match(flight,/onClick=\{\(\) => onTickPause\(false\)\}>Resume mission/);
 assert.match(flight,/onClick=\{onHome\}>Save & campaign/);
 assert.match(css,/\.campaign-paused\{z-index:30;/);
});
test("Movement remains available while mission hints start collapsed on iPad",()=>{
 const flight=readFileSync("src/commander/campaign/Flight.tsx","utf8");
 const css=readFileSync("src/commander/campaign/campaign.css","utf8");
 assert.match(flight,/\[helpOpen,setHelpOpen\] = useState\(false\)/);
 assert.match(flight,/helpOpen && <div id="campaign-objective-help"/);
 assert.match(flight,/aria-expanded=\{helpOpen\}/);
 assert.match(flight,/setHelpOpen\(false\); \/\/ Free the movement area/);
 assert.match(flight,/Hide help and move freely/);
 assert.match(css,/max-height: min\(40dvh, 300px\)/);
 assert.match(css,/\.campaign-flight \.campaign-guidance\.help-expanded/);
 assert.match(css,/\.campaign-task-guide \.campaign-guide-toggle/);
});
test("New task guide buttons and instructions are available from HUD and Mission Tablet",()=>{
 const flight=readFileSync("src/commander/campaign/Flight.tsx","utf8");
 const tablet=readFileSync("src/commander/campaign/CampaignTablet.tsx","utf8");
 const css=readFileSync("src/commander/campaign/campaign.css","utf8");
 assert.match(flight,/HOW TO COMPLETE/);
 assert.match(flight,/o\.choices\?\.map\(choice/);
 assert.match(flight,/onClick=\{\(\)=>run\("inspectPower"\)\}/);
 assert.match(flight,/onClick=\{\(\)=>onWorld\(\{kind:"switch",id:"maneuver"\}\)\}/);
 assert.match(flight,/onClick=\{\(\)=>run\("returnBurn"\)\}/);
 assert.match(flight,/campaign-guide-feedback/);
 assert.match(tablet,/campaign-tablet-help/);
 assert.match(css,/max-height: min\(40dvh, 300px\)/);
});
test("Redesigned ship uses stamped panel materials and shared instanced assets",()=>{
 const architecture=readFileSync("src/commander/shipArchitecture.ts","utf8");
 assert.match(architecture,/CanvasTexture/);
 assert.match(architecture,/PANEL ASSY/);
 assert.match(architecture,/INSPECT/);
 const interior=readFileSync("src/commander/interior.ts","utf8");
 assert.match(interior,/installShipArchitecture/);
});


test("all implemented Commander missions trigger scripted repairs at their own checklist, not earlier", () => {
  const progress = emptyProgress();
  progress.economy.balance = 100000;
  for (const m of missions) progress.completed[m.id] = {} as any;
  for (const m of missions.filter(m => m.implemented)) {
    const warningTasks = m.objectives.map((o,i)=>({o,i}))
      .filter(({o,i})=>i>0 && (o.event==="power" || o.event==="campPower"));
    for (const {o:warning,i} of warningTasks) {
      const base = createSession(m,design,life,m.requiredEquipment,progress);
      const early:Session={...base,objective:0,
        state:{...base.state,minutes:120},
        flight:{...base.flight,status:"orbit"},
        observations:{...base.observations,orbitMinute:90},
        camp:{...base.camp,battery:true,science:25}};
      const before=tickSession(early,0.25);
      assert.equal(before.eventIds.includes(warning.id),false,m.title+" activated "+warning.event+" too early");
      const stuck:Session={...before,
        eventIds:[...before.eventIds,warning.id],
        state:{...before.state,malfunction:warning.event==="power"},
        camp:{...before.camp,broken:warning.event==="campPower"}};
      const recovered=tickSession(stuck,0.25);
      assert.equal(recovered.eventIds.includes(warning.id),false,m.title+" could not restore older save");
      if(warning.event==="power") assert.equal(recovered.state.malfunction,false);
      if(warning.event==="campPower") assert.equal(recovered.camp.broken,false);
      const now=tickSession({...recovered,objective:i},0.25);
      assert.ok(now.eventIds.includes(warning.id),m.title+" did not trigger at correct task");
    }
  }
});
test("Level 3 lunar approach progresses from old premature power warnings and explains real faults",()=>{
  const m=missionById("mission-3"),progress=emptyProgress();
  progress.completed["mission-2"]={} as any;
  progress.economy.balance=100000;
  const base=createSession(m,design,life,m.requiredEquipment,progress);
  const at=m.objectives.findIndex(o=>o.action==="approach");
  const warning=m.objectives.find(o=>o.event==="power")!;
  const cockpit=sitePosition("cockpit",m.destination);
  const stale:Session={...base,objective:at,position:{...cockpit,heading:0},
    state:{...base.state,malfunction:true,minutes:120},
    flight:{...base.flight,status:"orbit"},eventIds:[warning.id],
    observations:{...base.observations,orbitMinute:90}};
  const corrected=command(stale,"approach");
  assert.ok(corrected.objective>at,"future power warnings cannot block lunar approach");
  assert.equal(corrected.state.malfunction,false);
  assert.equal(corrected.eventIds.includes(warning.id),false);
  const physical:Session={...stale,world:{...stale.world,faults:[
    {id:"real-fault",kind:"bus",diagnosed:false,repaired:false,verified:false,at:120}]}};
  assert.equal(command(physical,"approach").objective,at,"real hardware faults still require repair");
  const guide=objectiveGuide(physical);
  assert.equal(guide.recoveryStation,"power");
  assert.match(guide.steps.map(step=>step.text).join(" "),/Repair cabinet/);
  assert.match(guide.next,/Power & life support/);
  const flightSource=readFileSync("src/commander/campaign/Flight.tsx","utf8");
  assert.match(flightSource,/guide.recoveryStation/);
  assert.match(flightSource,/if \(blocked\) setHelpOpen\(true\)/);
});

test("every playable lunar landing teaches and operates destination and guarded arm before execution", () => {
  const progress = emptyProgress();
  progress.economy.balance = 100000;
  for (const m of missions) progress.completed[m.id] = {} as any;
  const landingMissions = missions.filter(m => m.implemented && m.objectives.some(o=>o.action==="land"));
  assert.ok(landingMissions.length>=3,"Campaign must include several lunar landings");
  for (const mission of landingMissions) {
    const base=createSession(mission,design,life,mission.requiredEquipment,progress);
    const index=mission.objectives.findIndex(o=>o.action==="land");
    const approach=mission.objectives.find(o=>o.action==="approach");
    assert.ok(approach,mission.title+" must require a prior approach");
    const cockpit=sitePosition("cockpit",mission.destination);
    let s:Session={...base,objective:index,position:{...cockpit,heading:0},
      flight:{...base.flight,status:"orbit"},
      observations:{...base.observations,achieved:[...base.observations.achieved,approach!.id]}};
    const first=objectiveGuide(s);
    const wording=first.steps.map(step=>step.text).join(" ");
    assert.match(wording,/Destination selector to Lunar approach/);
    assert.match(wording,/Guarded manoeuvre arm to ON/);
    assert.equal(first.next,"Set destination to Lunar approach.");
    assert.equal(command(s,"land").objective,index,"landing cannot skip destination selection");
    s=worldAction(s,{kind:"target",value:"moon"});
    assert.equal(objectiveGuide(s).next,"Turn ON Guarded manoeuvre arm.");
    assert.equal(command(s,"land").objective,index,"landing cannot skip guarded arm");
    s=worldAction(s,{kind:"switch",id:"maneuver"});
    assert.equal(objectiveGuide(s).next,"Press Execute lunar landing.");
    const result=command(s,"land");
    assert.equal(result.landed,true,mission.title+" must land after real switches are set");
    assert.ok(result.objective>index,mission.title+" landing objective must advance");
  }
});

test("lunar descent guidance and cockpit action buttons share the same preflight checklist",()=>{
  const mission=missionById("mission-3");
  const progress=emptyProgress();
  progress.completed["mission-2"]={} as any;
  progress.economy.balance=100000;
  const s=createSession(mission,design,life,mission.requiredEquipment,progress);
  const approach=mission.objectives.findIndex(o=>o.action==="approach");
  const before={...s,objective:approach};
  assert.match(objectiveGuide(before).steps.map(step=>step.text).join(" "),/NEXT landing step/);
  const flight=readFileSync("src/commander/campaign/Flight.tsx","utf8");
  assert.match(flight,/onWorld\(\{kind:"target",value:"moon"\}\)/);
  assert.match(flight,/onWorld\(\{kind:"switch",id:"maneuver"\}\)/);
  assert.match(flight,/onClick=\{\(\)=>run\("land"\)\}/);
});

test("Commander type pages navigate independently, preserve saves and show each local level", () => {
  const commander=readFileSync("src/commander/Commander.tsx","utf8");
  const home=readFileSync("src/commander/campaign/CampaignHome.tsx","utf8");
  const portal=readFileSync("src/ModeSelect.tsx","utf8");
  const css=readFileSync("src/home.css","utf8");
  assert.match(home,/Choose your/);
  assert.match(home,/campaigns\.map/);
  assert.match(home,/setSelectedRoute\(c\.id\)/);
  assert.match(home,/selectedCampaign && <section/);
  assert.match(home,/campaignLevel\(m\.id\)/);
  assert.match(home,/canStart\(m,progress\)/);
  assert.match(home,/Back to all mission types/);
  assert.match(home,/session && \(/);
  assert.match(home,/disabled=\{!ready \|\| readOnly\}/);
  assert.match(commander,/onResume=\{\(\) => setMode\("flight"\)\}/);
  assert.match(portal,/ENTER COMMANDER/);
  assert.match(portal,/Fly as an Astronaut/);
  assert.match(portal,/Build & Launch Missions/);
  assert.match(portal,/Explore Space History/);
  assert.match(css,/orbital-landing-hero/);
});

test("six Commander campaign branches each start at Level 1 and unlock only their next local level", () => {
  assert.equal(campaigns.length,6);
  assert.equal(new Set(campaigns.flatMap(c=>c.missionIds)).size,18);
  const fresh=emptyProgress();
  const initial=campaigns.map(c=>missions.find(m=>m.id===c.missionIds[0])!);
  for(const m of initial){
    assert.ok(m.implemented,"Every first level is fully implemented");
    assert.ok(canStart(m,fresh),m.title+" Level 1 should start unlocked");
    assert.equal(campaignLevel(m.id),1);
    assert.equal(previousInCampaign(m.id),undefined);
    assert.deepEqual(m.prerequisites,[]);
  }
  for(const c of campaigns){
    for(let i=1;i<c.missionIds.length;i++){
      const m=missionById(c.missionIds[i]);
      assert.equal(campaignLevel(m.id),i+1);
      assert.equal(previousInCampaign(m.id),c.missionIds[i-1]);
      assert.equal(canStart(m,fresh),false,m.title+" must start locked");
    }
    const next=missionById(c.missionIds[1]);
    const onlyPrevious=emptyProgress();
    onlyPrevious.completed[c.missionIds[0]]={score:95,rank:"A"} as any;
    assert.equal(canStart(next,onlyPrevious),true,c.name+" next level should unlock only from its own first level");
    for(const other of campaigns.filter(x=>x.id!==c.id)){
      assert.equal(canStart(missionById(other.missionIds[1]),onlyPrevious),false,
        other.name+" must not be affected by "+c.name);
    }
  }
});

test("a fixed Earth background and legible text cover the five non-flight views", () => {
  const global=readFileSync("src/style.css","utf8");
  const home=readFileSync("src/home.css","utf8");
  const campaign=readFileSync("src/commander/campaign/campaign.css","utf8");
  const history=readFileSync("src/history/history.css","utf8");
  const help=readFileSync("src/howTo.css","utf8");
  assert.match(global,/#root::before\s*\{/);
  assert.match(global,/position:fixed/);
  assert.match(global,/\.strategy-mission-board,\.app,\.history-hub,\.help-page,\.campaign-home/);
  assert.match(home,/\.orbital-hero-picture\{display:none\}/);
  assert.match(campaign,/campaign-home \.campaign-destination-picker/);
  assert.match(history,/history-hub \.history-card p/);
  assert.match(help,/help-page \.help-steps p/);
  assert.match(readFileSync("src/HowToPlay.tsx","utf8"),/Monitor food, water, oxygen/);
  assert.match(readFileSync("src/commander/campaign/Flight.tsx","utf8"),/onCommand/);
});

test("Level 3 scanner blockade becomes recovery, then automatically restores the exact original task", () => {
  const m = missionById("mission-3");
  const base = createSession(m, design, life, m.requiredEquipment, qualified(2));
  const objective = m.objectives.findIndex(task => task.action === "scan");
  assert.ok(objective > 0);
  const marker = sitePosition("survey", m.destination);
  const stalled: Session = {
    ...base, objective,
    position: { ...marker, heading: 0 },
    flight: { ...base.flight, status: "orbit" },
    landed: true,
    suit: { ...base.suit, equipped: true, power: 1 },
  };
  const recovery = recoveryMission(stalled);
  assert.equal(recovery?.id, "gear-scanner");
  assert.equal(recovery?.title, "Retrieve Geological scanner");
  assert.equal(recovery?.station, "science");
  assert.match(objectiveGuide(stalled).next, /Science/);
  assert.equal(currentObjective(stalled)?.id, m.objectives[objective].id);
  assert.equal(stalled.completed.length, 0);

  const science = sitePosition("science", m.destination);
  const atLocker: Session = {
    ...stalled, position: { ...science, heading: 0 },
    world: { ...stalled.world, lockers: { ...stalled.world.lockers, science: true } },
  };
  const loaded = worldAction(atLocker, { kind: "take", id: "scanner" }, 0);
  assert.ok(loaded.pack.includes("scanner"));
  assert.equal(recoveryMission(loaded), null, "recovery automatically clears after taking the scanner");
  assert.equal(currentObjective(loaded)?.id, m.objectives[objective].id);
  assert.deepEqual(loaded.completed, stalled.completed);
  assert.equal(loaded.objective, stalled.objective);
});

test("shared recovery applies to field equipment in every playable Commander mission", () => {
  const p = qualified(11);
  let checked = 0;
  for (const m of missions.filter(m => m.implemented)) {
    const taskIndex = m.objectives.findIndex(task =>
      ["scan", "sample", "drill", "photo", "measureRadiation", "measureTemperature"].includes(task.action || ""));
    if (taskIndex < 0) continue;
    const base = createSession(m, design, life, m.requiredEquipment, p);
    const blocked: Session = { ...base, objective: taskIndex, pack: [] };
    const recovery = recoveryMission(blocked);
    assert.ok(recovery, m.title + " should explain missing field gear");
    assert.match(recovery!.title, /Retrieve|Equipment unavailable/);
    assert.equal(blocked.objective, taskIndex);
    checked++;
  }
  assert.ok(checked >= 3, "check every existing field mission (at least three)");
});

test("critical switches and real hardware failures interrupt and resume without skipping mission steps", () => {
  const m = missionById("mission-3");
  const base = createSession(m, design, life, m.requiredEquipment, qualified(2));
  const landingIndex = m.objectives.findIndex(task => task.action === "land");
  const cockpit = sitePosition("cockpit", m.destination);
  let s: Session = { ...base, objective: landingIndex,
    position: { ...cockpit, heading: 0 },
    flight: { ...base.flight, status: "orbit" },
    world: { ...base.world, target: "moon" } };
  assert.equal(recoveryMission(s)?.id, "maneuver-arm");
  s = worldAction(s, { kind: "switch", id: "maneuver" }, 0);
  assert.equal(recoveryMission(s), null);
  assert.equal(s.objective, landingIndex);
  assert.deepEqual(s.completed, []);
  const broken: Session = { ...s,
    world: { ...s.world, faults: [{ id: "hardware", kind: "navigation",
      diagnosed: false, repaired: false, verified: false, at: 0 }],
      partsStored: 1 } };
  assert.equal(recoveryMission(broken)?.id, "fault-navigation");
  assert.match(objectiveGuide(broken).next, /Diagnose|Navigation/);
  assert.equal(broken.objective, landingIndex);
});

test("recovery is reflected in HUD and tablet but never replaces persisted mission indexes", () => {
  const hud = readFileSync("src/commander/campaign/Flight.tsx", "utf8");
  const tablet = readFileSync("src/commander/campaign/CampaignTablet.tsx", "utf8");
  const model = readFileSync("src/commander/campaign/recovery.ts", "utf8");
  assert.match(hud, /RECOVERY MISSION ACTIVE/);
  assert.match(hud, /Original task suspended/);
  assert.match(tablet, /TEMPORARY RECOVERY MISSION/);
  assert.match(tablet, /original mission resumes automatically/);
  assert.doesNotMatch(model, /objective:\s*s\.objective\s*\+/);
});

test("returning from preparation or flight retains its independent campaign levels page",()=>{
 const controller=readFileSync("src/commander/Commander.tsx","utf8");
 const home=readFileSync("src/commander/campaign/CampaignHome.tsx","utf8");
 assert.match(controller,/\[campaignRoute, setCampaignRoute\] = useState/);
 assert.match(controller,/setCampaignRoute\(campaignForMission\(m\.id\)/);
 assert.match(controller,/setCampaignRoute\(campaignForMission\(store\.session\.missionId\)/);
 assert.match(controller,/selectedRoute=\{campaignRoute\}/);
 assert.match(home,/selectedRoute: CampaignId \| null/);
});

test("engineer receives astronaut instructions and never flies the spacecraft",()=>{
 const app=readFileSync("src/App.tsx","utf8");
 const selection=readFileSync("src/ModeSelect.tsx","utf8");
 const brief=pilotBriefing(strategyChallenges[2]);
 assert.equal(pilot.role,"Astronaut / flight crew");
 assert.match(brief.message,/flight controls once you/);
 assert.ok(brief.requirements.some(r=>r.includes("radar")));
 assert.match(app,/Acknowledge astronaut briefing/);
 assert.match(app,/AUTHORIZE PILOT LAUNCH/);
 assert.match(app,/eventMessage\(selected\.title\)/);
 assert.match(app,/flightMessage\(progress,design\)/);
 assert.match(selection,/MISSION ENGINEER/);
});
test("official agency films open before the historical 3D scene",()=>{
 const hub=readFileSync("src/history/HistoryHub.tsx","utf8");
 const films=Object.values(officialFilms);
 assert.ok(films.length>=5);
 assert.match(hub,/!filmConfirmed/);
 assert.match(hub,/disabled=\{!filmOpened\}/);
 assert.match(hub,/WATCH VIDEO AT/);
 assert.match(hub,/setFilmOpened\(true\)/);
 assert.match(hub,/setFilmConfirmed\(true\)/);
 for(const v of films){
   assert.match(v.url,/^https:\/\/(plus\.nasa\.gov|images\.nasa\.gov)\//);
   assert.match(v.record,/^https:\/\/www\.nasa\.gov\//);
   assert.equal(v.publisher,"NASA");
   assert.ok(v.order.length>=5);
 }
 assert.equal(officialFilmFor("Apollo 11")?.kind,"original EVA broadcast");
 assert.equal(officialFilmFor("Sputnik 1"),undefined);
});
test("Apollo 11 3D recreates documented first step, photography, sampling and return in order",()=>{
 const sc=createStoryScenario(historyMissions.find(m=>m.title==="Apollo 11")!);
 const player=readFileSync("src/history/StoryFlight.tsx","utf8");
 assert.deepEqual(sc.tasks.map(t=>t.fieldAction),["egress","walk","photo","sample","flag","return"]);
 assert.equal(sc.tasks.length,officialFilmFor("Apollo 11")!.order.length-1);
 assert.match(player,/distanceToHatch\(\)/);
 assert.match(player,/completeField\(task\.fieldAction/);
 assert.match(player,/TAKE FIELD PHOTOGRAPH/);
 assert.match(player,/COLLECT CONTINGENCY SAMPLE/);
 assert.match(player,/DEPLOY FLAG WITH CREW/);
});

test("every one of the 55 Story Mode missions has a video chapter sequence backed by its existing history",()=>{
 assert.equal(historyMissions.length,55);
 const official=historyMissions.filter(m=>officialFilmFor(m.title));
 assert.ok(official.length>=12,"include expanded verified NASA documentaries");
 const animated=historyMissions.filter(m=>!officialFilmFor(m.title));
 assert.equal(official.length+animated.length,55);
 for(const mission of historyMissions){
   const chapters=storyVideoChapters(mission);
   assert.equal(chapters.length,6,mission.title);
   assert.deepEqual(chapters.map(c=>c.scene),["launch","orbit","science","warning","return","legacy"]);
   assert.equal(chapters[0].title,mission.title);
   assert.match(chapters[0].description,new RegExp(String(mission.year)));
   assert.equal(chapters[1].description,mission.background);
   assert.equal(chapters[2].description,mission.mission);
   assert.equal(chapters[3].description,mission.challenge);
   assert.equal(chapters[4].description,mission.outcome);
   assert.equal(chapters[5].description,mission.skill);
   assert.ok(["moon","earth","mars","outer"].includes(storyVideoWorld(mission)));
 }
 assert.equal(STORY_VIDEO_CHAPTER_SECONDS,6);
 const video=readFileSync("src/history/StoryBriefingVideo.tsx","utf8");
 const home=readFileSync("src/history/HistoryHub.tsx","utf8");
 assert.match(video,/ANIMATED RECONSTRUCTION · NOT ORIGINAL FILM/);
 assert.match(video,/setPlaying/);
 assert.match(video,/type="range"/);
 assert.match(video,/mission\.source/);
 assert.match(video,/onWatched/);
 assert.match(home,/StoryBriefingVideo/);
 assert.match(home,/mission=\{chosen\}/);
 assert.match(home,/Watch animated video → Live/);
 assert.match(home,/!filmConfirmed/);
});

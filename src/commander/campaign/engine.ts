import {
  newShip,
  tickShip,
  nominalCondition,
  faultCatalog,
  doors,
  type ShipState,
  type Condition,
} from "./ship";
import {
  emptyObservations,
  withObservations,
  observe,
  receipt,
  satisfied,
  type Observations,
} from "./observations";
import {
  initialEconomy,
  launchFinance,
  bookLaunch,
  financialReport,
  settle,
  technologies,
  type Technology,
  type Economy,
  type LaunchFinance,
  type FinancialReport,
} from "./economy";
import {
  act,
  tick,
  newMission,
  engineering,
  type State,
  type LifeSupport,
  type Area,
  type Action,
} from "../simulation";
import { deck, spawn, nearby, walkable, type Position } from "../layout";
import { rockets, type Design } from "../../game";
import {
  missionById,
  missions,
  type CampaignAction,
  type MissionDefinition,
  type Site,
} from "./definitions";
import {
  equipment,
  packMass,
  packCost,
  PACK_CAPACITY,
  type EquipmentId,
} from "./equipment";
import { environments, type Destination } from "./environments";
export type Airlock = {
  inner: boolean;
  outer: boolean;
  pressure: number;
  cycling: "vent" | "pressurize" | null;
};
export type Suit = {
  equipped: boolean;
  oxygen: number;
  power: number;
  condition: number;
  oxygenChecked: boolean;
  powerChecked: boolean;
};
export type Camp = {
  shelter: boolean;
  solar: boolean;
  battery: boolean;
  antenna: boolean;
  storage: boolean;
  sensor: boolean;
  broken: boolean;
  power: number;
  samples: number;
  science: number;
  sent: boolean;
};
export const emptyCamp = (): Camp => ({
  shelter: false,
  solar: false,
  battery: false,
  antenna: false,
  storage: false,
  sensor: false,
  broken: false,
  power: 0,
  samples: 0,
  science: 0,
  sent: false,
});
export type Session = {
  world: ShipState;
  observations: Observations;
  id: string;
  missionId: string;
  revision: number;
  state: State;
  design: Design;
  life: LifeSupport;
  selectedGear: EquipmentId[];
  pack: EquipmentId[];
  position: Position;
  objective: number;
  repetitions: number;
  objectiveStarted: number;
  completed: string[];
  startedAt: number;
  lastEat: number;
  lastDrink: number;
  airlock: Airlock;
  suit: Suit;
  camp: Camp;
  samples: {
    id: string;
    kind: string;
    destination: Destination;
    location?: string;
    mass?: number;
    collectedAt?: number;
    status?: string;
    scientificValue?: string;
  }[];
  experiments: string[];
  pendingTransmit: number;
  landed: boolean;
  eventIds: string[];
  completionMessage: string;
  report?: Report;
  notice: string;
  finance: LaunchFinance;
  upgrades: Technology[];
  optionalDone: string[];
  simRate: number;
  flight: {
    status: "pad" | "ascent" | "orbit" | "returning" | "recovered";
    countdown: number;
    altitude: number;
    velocity: number;
    throttle: number;
    pitch: number;
    separated: boolean;
    checks: string[];
  };
  systems: {
    satelliteDiagnosed: boolean;
    satelliteRepaired: boolean;
    satelliteOnline: boolean;
    campExposure: number;
  };
};
export type Report = {
  missionId: string;
  runId: string;
  success: boolean;
  score: number;
  rank: string;
  science: number;
  resources: number;
  condition: number;
  crew: number;
  power: number;
  fuel: number;
  communications: number;
  experiments: number;
  samples: number;
  optional: number;
  minutes: number;
  good: string[];
  improve: string[];
  timestamp: number;
  outcome: "SUCCESS" | "PARTIAL SUCCESS" | "FAILURE";
  finance?: FinancialReport;
  optionalResults: {
    id: string;
    title: string;
    complete: boolean;
    reward: number;
  }[];
  unlocks: Technology[];
  remaining: { fuel: number; battery: number; science: number };
  sampleManifest?: Session["samples"];
};
export type Progress = {
  completed: Record<string, Report>;
  history: Report[];
  tutorials: string[];
  outposts: Partial<Record<Destination, Camp>>;
  economy: Economy;
  condition?: Condition;
  equipmentCondition?: ShipState["equipment"];
  archive?: {
    completed: Record<string, unknown>;
    history: unknown[];
    checkpoint?: unknown;
    chapters: string[];
  };
};
export const emptyProgress = (): Progress => ({
  completed: {},
  history: [],
  tutorials: [],
  outposts: {},
  economy: initialEconomy(),
});
export const fieldSites: Record<
  string,
  { x: number; z: number; name: string }
> = {
  innerHatch: { x: 0, z: 7.05, name: "Inner airlock hatch" },
  airlock: { x: 0, z: 9, name: "Airlock chamber" },
  outerHatch: { x: 0, z: 10, name: "Outer airlock hatch" },
  survey: { x: 3, z: 16, name: "Survey marker" },
  crater: { x: -6, z: 23, name: "Shallow crater" },
  camp: { x: 6, z: 26, name: "Research camp" },
  relay: { x: -7, z: 32, name: "Distant survey" },
};
export function sitePosition(site: Site, destination: Destination) {
  if (site in deck) return deck[site as Area];
  const p = fieldSites[site];
  if (destination === "earth" && site === "survey")
    return { x: 1.8, z: 14, name: "Orbital work platform" };
  return p;
}
export const distance = (a: Position, b: { x: number; z: number }) =>
  Math.hypot(a.x - b.x, a.z - b.z);
export function atSite(s: Session, site: Site) {
  return (
    distance(
      s.position,
      sitePosition(site, missionById(s.missionId).destination),
    ) < (site === "airlock" ? 1.1 : site in deck ? 1.85 : 2)
  );
}
export const outside = (s: Session) => s.position.z > 10.4;
export function canStart(m: MissionDefinition, p: Progress) {
  return (
    missions.some((candidate) => candidate.id === m.id) &&
    m.implemented &&
    environments[m.destination].available &&
    m.prerequisites.every((id) => !!p.completed[id])
  );
}
export function engineeringCampaign(
  design: Design,
  life: LifeSupport,
  gear: EquipmentId[],
  eva: boolean,
  upgrades: Technology[] = [],
) {
  const e = engineering(design, life);
  return {
    ...e,
    mass:
      e.mass +
      gear.reduce((sum, id) => sum + equipment[id].mass, 0) +
      (eva ? 140 : 0) +
      upgrades.reduce((n, id) => n + technologies[id].mass, 0),
    cost:
      e.cost +
      packCost(gear) +
      (eva ? 12 : 0) +
      upgrades.reduce((n, id) => n + technologies[id].cost, 0),
    power:
      e.power - (eva ? 10 : 0) + (upgrades.includes("advancedSolar") ? 60 : 0),
    capacity: e.capacity + (upgrades.includes("reserveBattery") ? 1 : 0),
  };
}
export function createSession(
  m: MissionDefinition,
  d: Design,
  l: LifeSupport,
  gear: EquipmentId[],
  p: Progress,
  upgrades: Technology[] = [],
): Session {
  if (!canStart(m, p))
    throw new Error("This mission is locked or not implemented.");
  const problems = preflight(m, d, l, gear, p, upgrades);
  if (problems.length) throw Error(problems.join(" "));
  const effectiveLife = {
    ...l,
    batteries: l.batteries + (upgrades.includes("reserveBattery") ? 1 : 0),
  };
  const state = newMission(d, effectiveLife);
  state.notice =
    "Review the mission objective; normal systems remain available. Use station signage and the tablet map to locate equipment.";
  const s: Session = {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    missionId: m.id,
    revision: m.revision,
    state,
    design: structuredClone(d),
    life: effectiveLife,
    selectedGear: [...gear],
    pack: [],
    position: { ...spawn },
    objective: 0,
    repetitions: 0,
    objectiveStarted: 0,
    completed: [],
    startedAt: Date.now(),
    lastEat: -100,
    lastDrink: -100,
    airlock: { inner: false, outer: false, pressure: 101.3, cycling: null },
    suit: {
      equipped: false,
      oxygen: 0,
      power: 0,
      condition: 100,
      oxygenChecked: false,
      powerChecked: false,
    },
    camp:
      m.outpost === "existing"
        ? structuredClone(
            p.outposts[m.destination] || {
              ...emptyCamp(),
              shelter: true,
              solar: true,
              battery: true,
              antenna: true,
              storage: true,
              sensor: true,
              power: 0.5,
            },
          )
        : emptyCamp(),
    samples: [],
    experiments: [],
    pendingTransmit: 0,
    landed: m.startsLanded,
    eventIds: [],
    completionMessage: "",
    notice: state.notice,
    observations: emptyObservations(),
    world: newShip(gear, p.condition),
    finance: launchFinance(
      m,
      p,
      engineeringCampaign(d, l, gear, m.eva, upgrades).cost,
    ),
    upgrades: [...upgrades],
    optionalDone: [],
    simRate: 1,
    flight: {
      status: "pad",
      countdown: -1,
      altitude: 0,
      velocity: 0,
      throttle: 0.85,
      pitch: 90,
      separated: false,
      checks: [],
    },
    systems: {
      satelliteDiagnosed: false,
      satelliteRepaired: false,
      satelliteOnline: false,
      campExposure: 1,
    },
  };
  s.world.equipment = { ...s.world.equipment, ...p.equipmentCondition };
  s.world.radioQueue.push({
    due: 2,
    text: "Mission Control: flight authorization confirmed. Review readiness and report when prepared.",
  });
  return applyEvents(s);
}
export function launchMission(
  m: MissionDefinition,
  d: Design,
  l: LifeSupport,
  gear: EquipmentId[],
  p: Progress,
  upgrades: Technology[] = [],
) {
  const session = createSession(m, d, l, gear, p, upgrades);
  return { session, progress: bookLaunch(p, session) };
}
export function preflight(
  m: MissionDefinition,
  d: Design,
  l: LifeSupport,
  gear: EquipmentId[],
  p: Progress,
  upgrades: Technology[] = [],
) {
  const e = engineeringCampaign(d, l, gear, m.eva, upgrades);
  const errors: string[] = [];
  if (!canStart(m, p)) errors.push("Mission is locked or planned.");
  if (
    new Set(gear).size !== gear.length ||
    gear.some((g) => !m.allowedEquipment.includes(g))
  )
    errors.push("Invalid equipment loadout.");
  if (
    new Set(upgrades).size !== upgrades.length ||
    upgrades.some((id) => !p.economy.unlocks.includes(id))
  )
    errors.push("Technology is not yet unlocked.");
  if (e.mass > rockets[d.rocket].payload)
    errors.push("Payload exceeds rocket capacity.");
  if (e.power < 0)
    errors.push("Electrical generation cannot support essential systems.");
  if (e.fuel < (m.surface ? 20 : 12))
    errors.push("Insufficient fuel for the full mission.");
  if (!d.counts.antenna || !d.counts.spectrometer)
    errors.push("An antenna and science spectrometer are required.");
  if (packMass(gear) > PACK_CAPACITY) errors.push("EVA pack exceeds capacity.");
  for (const id of m.requiredEquipment)
    if (!gear.includes(id)) errors.push(`Pack the ${equipment[id].name}.`);
  try {
    launchFinance(m, p, e.cost);
  } catch (error) {
    errors.push((error as Error).message);
  }
  return errors;
}
export function currentObjective(s: Session) {
  return missionById(s.missionId).objectives[s.objective];
}
function say(s: Session, message: string) {
  return { ...s, notice: message, state: { ...s.state, notice: message } };
}
function logged(s: Session, message: string) {
  const n = s.world
    ? {
        ...say(s, message),
        world: {
          ...s.world,
          messages: [
            ...s.world.messages,
            {
              at: s.state.minutes,
              source: (message.includes("science") || message.includes("sample")
                ? "SCIENCE"
                : message.includes("warning")
                  ? "ALERTS"
                  : "SPACECRAFT SYSTEM") as ShipState["messages"][number]["source"],
              text: message,
            },
          ].slice(-120),
        },
      }
    : say(s, message);
  n.state = {
    ...n.state,
    log: [
      ...n.state.log,
      `T+${Math.floor(n.state.minutes)}m: ${message}`,
    ].slice(-100),
  };
  return n;
}
function advance(s: Session): Session {
  const m = missionById(s.missionId),
    o = currentObjective(s);
  if (!o) return s;
  let n = {
    ...s,
    objective: s.objective + 1,
    repetitions: 0,
    objectiveStarted: s.state.minutes,
    completed: [...s.completed, o.id],
    completionMessage: `${o.title} ✓`,
    simRate: 1,
  };
  n = logged(
    n,
    "Task complete. " +
      (m.objectives[n.objective]?.title || "Mission complete."),
  );
  if (n.objective >= m.objectives.length) {
    n.state = { ...n.state, ended: true };
    n.report = makeReport(n, true);
    n.notice = "Mission complete. Review your report to continue.";
  }
  return applyEvents(n);
}
export function evaluate(s: Session): Session {
  if (s.report || s.state.paused || s.state.ended) return s;
  let n = observe(s);
  const limit = missionById(n.missionId).objectives.length;
  for (let i = 0; i < limit && !n.report; i++) {
    const o = currentObjective(n);
    if (!o || !satisfied(n, o)) break;
    n = advance(n);
  }
  return n;
}
function applyEvents(s: Session) {
  let n = s;
  for (const e of missionById(s.missionId).hazards) {
    const id = e.type + e.at;
    if (s.state.minutes >= e.at && !n.eventIds.includes(id)) {
      n = {
        ...n,
        eventIds: [...n.eventIds, id],
        state: { ...n.state },
        camp: { ...n.camp },
      };
      if (e.type === "power") n.state.malfunction = true;
      if (e.type === "comms") n.state.communications = false;
      if (e.type === "campPower") n.camp.broken = true;
      n = logged(
        n,
        e.type === "campPower"
          ? "The research camp power connector needs repair."
          : e.type === "power"
            ? "A training fault has stopped a power unit. Follow the repair task."
            : "The radio link is down. Follow the communications task.",
      );
    }
  }
  for (const taskEvent of missionById(n.missionId).objectives.filter(
    (o) => o.event,
  )) {
    if (n.eventIds.includes(taskEvent.id) || n.completed.includes(taskEvent.id))
      continue;
    const elapsed =
      n.state.minutes - (n.observations?.orbitMinute ?? n.state.minutes);
    const ready =
      taskEvent.event === "campPower"
        ? n.camp.battery && n.camp.science >= 15
        : n.flight.status === "orbit" && elapsed >= 8;
    if (!ready) continue;
    n = {
      ...n,
      simRate: 1,
      eventIds: [...n.eventIds, taskEvent.id],
      state: { ...n.state },
      camp: { ...n.camp },
      observations: { ...n.observations },
    };
    if (taskEvent.event === "power") {
      n.state.malfunction = true;
      n.observations.powerDiagnosed = false;
      n.world = {
        ...n.world,
        condition: {
          ...n.world.condition,
          power: Math.max(20, n.world.condition.power - 8),
        },
      };
    }
    if (taskEvent.event === "campPower") {
      n.camp.broken = true;
      n.observations.campDiagnosed = false;
    }
    if (taskEvent.event === "comms") n.state.communications = false;
    n = logged(
      n,
      "System warning: " + taskEvent.title + " Inspect the affected console.",
    );
  }
  return n;
}
export function tickSession(s: Session, minutes = 1): Session {
  s = withObservations(s);
  if (s.state.paused || s.state.ended || s.report) return s;
  const waiting = currentObjective(s);
  if (waiting?.type === "WAIT" && waiting.condition === "minutes")
    minutes = Math.min(
      minutes,
      Math.max(
        0.01,
        (waiting.value || 1) - (s.state.minutes - s.objectiveStarted),
      ),
    );
  const env = environments[missionById(s.missionId).destination];
  let n = {
    ...s,
    state: tick(
      s.state,
      s.design,
      {
        ...s.life,
        waterRecycler:
          s.world.switches.water &&
          !s.world.faults.some((f) => f.kind === "water" && !f.verified)
            ? s.life.waterRecycler
            : 0,
        oxygenRecycler:
          s.world.switches.oxygen &&
          !s.world.faults.some((f) => f.kind === "oxygen" && !f.verified)
            ? s.life.oxygenRecycler
            : 0,
      },
      minutes,
      { scriptedEvents: false },
    ),
    airlock: { ...s.airlock },
    suit: { ...s.suit },
    camp: { ...s.camp },
    flight: { ...s.flight },
    observations: {
      ...s.observations,
      rest: s.observations.rest + (s.state.sleeping ? minutes : 0),
    },
  };
  const solarDelta =
    (s.design.counts.solar || 0) * 85 * (env.solar - 1) +
    (s.upgrades.includes("advancedSolar") ? 60 * env.solar : 0);
  n.state.battery = Math.max(
    0,
    Math.min(
      s.life.batteries,
      n.state.battery +
        ((solarDelta - (missionById(s.missionId).eva ? 10 : 0)) * minutes) /
          60000,
    ),
  );
  const seconds = minutes * 2;
  if (n.flight.status === "pad" && n.flight.countdown > 0)
    n.flight.countdown = Math.max(0, n.flight.countdown - seconds);
  if (n.flight.status === "ascent") {
    const targetPitch = Math.max(25, 90 - n.flight.altitude * 0.3);
    const guidance = Math.max(
      0.25,
      1 - Math.abs(targetPitch - n.flight.pitch) / 100,
    );
    n.flight.velocity = Math.max(
      0,
      n.flight.velocity + (n.flight.throttle * 0.18 - 0.025) * seconds,
    );
    n.flight.altitude += n.flight.velocity * guidance * seconds;
    n.state.fuel = Math.max(
      0,
      n.state.fuel - n.flight.throttle * 0.035 * seconds,
    );
    if (n.state.fuel <= 0) {
      n.state.ended = true;
      n.notice = "Launch aborted: propellant exhausted.";
    }
    if (
      (!n.flight.separated && n.flight.altitude >= 12) ||
      n.flight.altitude >= 180
    )
      n.simRate = 1;
  }
  if (s.airlock.cycling) {
    const delta = (101.3 / 3) * minutes;
    n.airlock.pressure = Math.max(
      0,
      Math.min(
        101.3,
        s.airlock.pressure + (s.airlock.cycling === "vent" ? -delta : delta),
      ),
    );
    if (n.airlock.pressure <= 0 || n.airlock.pressure >= 101.3)
      n.airlock.cycling = null;
  }
  if (
    s.suit.equipped &&
    (outside(s) || (s.position.z > 7.7 && s.airlock.pressure < 80))
  ) {
    n.state.oxygen = s.state.oxygen;
    n.suit.oxygen = Math.max(0, s.suit.oxygen - 0.0007 * minutes);
    n.suit.power = Math.max(0, s.suit.power - 0.001 * minutes);
    n.suit.condition = Math.max(
      0,
      s.suit.condition -
        (env.radiation * 0.006 * minutes) / (1 + (s.design.counts.shield || 0)),
    );
    if (n.suit.oxygen <= 0 || n.suit.power <= 0 || n.suit.condition <= 0) {
      n.state.ended = true;
      n.notice = "EVA safety abort: a suit reserve was exhausted.";
    }
  }
  if (n.camp.battery) {
    const watts =
      (n.camp.solar && !n.camp.broken
        ? 80 * env.solar * s.systems.campExposure
        : 0) -
      (n.camp.antenna ? 5 : 0) -
      (n.camp.sensor ? 5 : 0);
    n.camp.power = Math.max(
      0,
      Math.min(0.5, n.camp.power + (watts * minutes) / 60000),
    );
  }
  n = tickShip(applyEvents(n), minutes);
  const sw = n.world.switches,
    active = n.world.faults.filter((f) => !f.verified);
  const solarLoss =
    !sw.solar || active.some((f) => f.kind === "solar")
      ? (s.design.counts.solar || 0) * 85
      : 0;
  const savedLoad =
    (!sw.science ? 25 : 0) +
    (!sw.radio ? 12 : 0) +
    (sw.emergency ? 20 : 0) -
    (!sw.busB ? 18 : 0) -
    (!sw.busA ? 10 : 0);
  n.state.battery = Math.max(
    0,
    Math.min(
      n.life.batteries,
      n.state.battery + ((savedLoad - solarLoss) * minutes) / 60000,
    ),
  );
  if (!sw.cooling || active.some((f) => f.kind === "cooling"))
    n.state.temperature += 0.015 * minutes;
  else
    n.state.temperature +=
      (n.world.setpoint - n.state.temperature) * Math.min(0.1, minutes * 0.005);
  if (active.some((f) => f.kind === "bus")) n.state.malfunction = true;
  if (active.some((f) => f.kind === "comms") && n.world.antenna === 1)
    n.state.communications = false;
  if (active.length) n.simRate = 1;
  if (
    n.state.malfunction ||
    n.camp.broken ||
    n.state.battery / n.life.batteries < 0.2 ||
    n.state.oxygen < 0.5 ||
    n.state.energy < 25 ||
    !n.state.communications
  )
    n.simRate = 1;
  if (n.state.ended) {
    n.report = makeReport(n, false);
    n.notice = n.notice.startsWith("EVA safety") ? n.notice : n.state.notice;
    return n;
  }
  return evaluate(n);
}
export function moveSession(s: Session, p: Position) {
  if (
    s.state.paused ||
    s.state.sleeping ||
    s.state.ended ||
    s.flight?.status === "ascent"
  )
    return s;
  for (const [id, d] of Object.entries(doors)) {
    const state = s.world?.doors[id as keyof typeof doors];
    if (
      state &&
      (s.position.z - d.z) * (p.z - d.z) < 0 &&
      (!state.open || Date.now() < state.readyAt)
    )
      return s;
  }
  for (const [z, open] of [
    [7.75, s.airlock.inner],
    [10.25, s.airlock.outer],
  ] as const) {
    if ((s.position.z - z) * (p.z - z) < 0 && !open) return s;
  }
  if (!campaignWalkable(p.x, p.z, s)) return s;
  if (
    p.x === s.position.x &&
    p.z === s.position.z &&
    p.heading === s.position.heading
  )
    return evaluate(s);
  return evaluate({ ...s, position: p });
}
export function campaignWalkable(x: number, z: number, s: Session) {
  if (z <= 7.15) {
    for (const [id, d] of Object.entries(doors)) {
      const gate = s.world?.doors[id as keyof typeof doors];
      if (
        gate &&
        (!gate.open || Date.now() < gate.readyAt) &&
        Math.abs(z - d.z) < 0.2
      )
        return false;
    }
    return walkable(x, z);
  }
  if (!missionById(s.missionId).eva) return false;
  if (z < 10.45) {
    if (Math.abs(x) > 0.62) return false;
    if (Math.abs(z - 7.75) < 0.22 && !s.airlock.inner) return false;
    if (Math.abs(z - 10.25) < 0.22 && !s.airlock.outer) return false;
    return true;
  }
  if (
    s.flight &&
    (s.flight.status !== "orbit" ||
      (missionById(s.missionId).surface && !s.landed))
  )
    return false;
  if (!s.suit.equipped || (s.airlock.pressure > 1 && s.airlock.outer))
    return false;
  const dest = missionById(s.missionId).destination;
  return dest === "earth"
    ? Math.abs(x) < 3.8 && z < 18.5
    : Math.abs(x) < 18 && z < 40;
}
const baseActions = new Set<string>([
  "takeMeal",
  "eat",
  "fill",
  "drink",
  "dispenser",
  "sleep",
  "wake",
  "tools",
  "repair",
  "comms",
  "science",
  "course",
]);
const gearFor: Partial<Record<CampaignAction, EquipmentId>> = {
  scan: "scanner",
  sample: "containers",
  drill: "drill",
  photo: "camera",
  measureRadiation: "radiation",
  measureTemperature: "sensor",
  experiment: "experiment",
  deployShelter: "shelter",
  deploySolar: "solar",
  deployBattery: "battery",
  deployAntenna: "antenna",
  deployStorage: "storage",
  deploySensor: "sensor",
  repairCamp: "repair",
};
export function command(s: Session, action: CampaignAction): Session {
  s = withObservations(s);
  if (s.report || s.state.paused || s.state.ended) return s;
  if (s.state.sleeping && action !== "wake")
    return say(s, "Wake up before using equipment.");
  const m = missionById(s.missionId),
    o = currentObjective(s);
  if (!o) return s;
  const matching =
    o.action === action || !!o.choices?.some((c) => c.action === action);
  if (
    ["comms", "campTransmit"].includes(action) &&
    s.pendingTransmit > 0 &&
    s.state.minutes < s.pendingTransmit
  )
    return say(s, "The message is sending. Wait for confirmation.");
  let n: Session = {
    ...s,
    state: { ...s.state },
    airlock: { ...s.airlock },
    suit: { ...s.suit },
    camp: { ...s.camp },
    pack: [...s.pack],
    flight: { ...s.flight, checks: [...s.flight.checks] },
    systems: { ...s.systems },
    observations: { ...s.observations },
  };
  let success = false;
  const fail = (message: string) => say(s, message);
  const location: Partial<Record<CampaignAction, Site>> = {
    verifyPower: "power",
    verifyLife: "galley",
    verifyRadio: "communications",
    verifyFuel: "cockpit",
    sealHatch: "cockpit",
    armLaunch: "cockpit",
    returnBurn: "cockpit",
    recoverVehicle: "cockpit",
    powerSafe: "power",
    powerScience: "power",
    diagnose: "power",
    approach: "cockpit",
    land: "cockpit",
    selectCamp: "camp",
    alignSolar: "camp",
    experiment: "camp",
    repairCamp: "camp",
    campTransmit: "camp",
    deployShelter: "camp",
    deploySolar: "camp",
    deployBattery: "camp",
    deployAntenna: "camp",
    deployStorage: "camp",
    deploySensor: "camp",
  };
  if (location[action] && !atSite(s, location[action]!))
    return fail(
      "Access " +
        sitePosition(location[action]!, m.destination).name +
        " first.",
    );
  if (["sealHatch", "armLaunch"].includes(action) && s.flight.status !== "pad")
    return fail("Launch preparation is only available on the pad.");
  if (
    ["openInner", "vent", "openOuter"].includes(action) &&
    s.flight.status !== "orbit"
  )
    return fail("EVA requires a stable orbit or a landed vehicle.");
  if (
    m.surface &&
    ["openInner", "vent", "openOuter"].includes(action) &&
    !s.landed
  )
    return fail("Complete the lunar approach and landing before surface EVA.");
  const access: Partial<Record<CampaignAction, keyof ShipState["lockers"]>> = {
    takeMeal: "food",
    fill: "water",
    dispenser: "water",
    tools: "repair",
    packEquipment: "equipment",
    equipSuit: "eva",
  };
  const locker = access[action];
  if (locker && !s.world.lockers[locker])
    return fail("Open the " + locker + " storage compartment first.");
  const liveFaults = s.world.faults.filter((f) => !f.verified);
  if (
    ["science", "powerScience"].includes(action) &&
    (!s.world.switches.science || liveFaults.some((f) => f.kind === "sensor"))
  )
    return fail("The science circuit is isolated or its sensor needs repair.");
  if (
    ["comms", "verifyRadio"].includes(action) &&
    (!s.world.switches.radio ||
      liveFaults.some((f) => f.kind === "comms" && s.world.antenna === 1))
  )
    return fail("Restore the radio circuit and antenna feed.");
  if (
    ["course", "approach", "land"].includes(action) &&
    (!s.world.switches.navigation ||
      liveFaults.some((f) => f.kind === "navigation"))
  )
    return fail("Restore the navigation computer circuit.");
  if (["land", "returnBurn"].includes(action) && !s.world.switches.maneuver)
    return fail("Arm the guarded manoeuvre confirmation at Navigation.");
  if (baseActions.has(action)) {
    if (
      (outside(s) ||
        (s.position.z > 7.7 && s.airlock.pressure < 80) ||
        s.flight.status === "ascent") &&
      ["eat", "drink", "dispenser", "sleep"].includes(action)
    )
      return fail(
        "Keep your helmet on outside. Return through the airlock before eating, drinking or resting.",
      );
    if (
      action === "eat" &&
      (s.state.minutes - s.lastEat < 20 || s.state.nutrition >= 98)
    )
      return fail(
        "You do not need another meal yet. Wait a little before eating again.",
      );
    if (
      (action === "drink" || action === "dispenser") &&
      (s.state.minutes - s.lastDrink < 2 || s.state.hydration >= 99)
    )
      return fail("You are hydrated. Wait a little before drinking again.");
    if (
      action === "repair" &&
      s.state.malfunction &&
      !s.observations.powerDiagnosed
    )
      return fail(
        "Inspect the power console to diagnose the fault before repairing it.",
      );
    if (
      action === "repair" &&
      (!s.world.lockers.maintenance || s.world.switches.busB)
    )
      return fail(
        "Open the maintenance panel and isolate Bus B before hardware repair.",
      );
    if (action === "course" && s.state.course) n.state.course = false;
    if (s.pack.includes("repair")) n.state.tools = true;
    if (action === "comms" && s.state.battery < 0.01)
      return fail("Radio operation needs 0.01 kWh reserve.");
    const before = n.state;
    const result = act(
      before,
      action as Action,
      nearby(s.position.x, s.position.z),
      s.design,
      {
        ...s.life,
        waterRecycler:
          s.world.switches.water && !liveFaults.some((f) => f.kind === "water")
            ? s.life.waterRecycler
            : 0,
      },
    );
    success = result.log !== before.log;
    n.state = result;
    if (!success) return say(s, result.notice);
    if (action === "tools") {
      if (!n.pack.includes("repair") && n.world.stored.includes("repair")) {
        n.pack.push("repair");
        n.world = {
          ...n.world,
          stored: n.world.stored.filter((g) => g !== "repair"),
        };
      }
    }
    if (action === "repair")
      n.world = {
        ...n.world,
        condition: {
          ...n.world.condition,
          power: Math.min(100, n.world.condition.power + 8),
        },
      };
    if (action === "comms")
      n.state.battery = Math.max(0, n.state.battery - 0.01);
    if (action === "eat") n.lastEat = s.state.minutes;
    if (action === "drink" || action === "dispenser")
      n.lastDrink = s.state.minutes;
  } else {
    const req = gearFor[action];
    if (req && !s.pack.includes(req))
      return fail(
        `You need the ${equipment[req].name.toLowerCase()}. Prepare it at the equipment locker before leaving.`,
      );
    if (req && (!outside(s) || !s.suit.equipped))
      return fail(
        "This field equipment is used outside while wearing your suit.",
      );
    if (req && s.suit.power < equipment[req].power)
      return fail("Suit battery is too low. Return to the spacecraft.");
    if (req) {
      const condition = s.world.equipment[req] || 100;
      n.suit.power = Math.max(
        0,
        n.suit.power - equipment[req].power * (1 + (100 - condition) / 100),
      );
      n.world = {
        ...n.world,
        equipment: {
          ...n.world.equipment,
          [req]: Math.max(5, condition - 0.15),
        },
      };
    }
    switch (action) {
      case "inspectPower":
      case "inspectLife":
      case "inspectComms":
      case "inspectScience":
      case "inspectStorage":
      case "inspectEquipment":
      case "inspectCamp": {
        const station = {
          inspectPower: "power",
          inspectLife: "power",
          inspectComms: "communications",
          inspectScience: "science",
          inspectStorage: "galley",
          inspectEquipment: "equipment",
          inspectCamp: "camp",
        }[action] as Site;
        if (!atSite(s, station))
          return fail(
            "Access the " +
              sitePosition(station, m.destination).name +
              " to inspect it.",
          );
        if (action === "inspectPower")
          n.observations.powerDiagnosed = s.state.malfunction;
        if (action === "inspectCamp")
          n.observations.campDiagnosed = s.camp.broken;
        const e = engineeringCampaign(
          s.design,
          s.life,
          s.selectedGear,
          m.eva,
          s.upgrades,
        );
        return evaluate(
          logged(
            n,
            action === "inspectPower"
              ? `POWER: battery ${s.state.battery.toFixed(2)} / ${s.life.batteries} kWh; net margin ${e.power.toFixed(0)} W; ${s.state.malfunction ? "Bus fault diagnosed." : "bus operating normally."}`
              : action === "inspectComms"
                ? `RADIO: ${s.state.communications ? "Earth link connected" : "link unavailable"}; ${s.design.counts.antenna || 0} antennas; ${environments[m.destination].communicationDelay} scenario delay units.`
                : action === "inspectLife"
                  ? `LIFE SUPPORT: O2 ${s.state.oxygen.toFixed(2)} kg; pressure ${s.state.pressure.toFixed(1)} kPa; temperature ${s.state.temperature.toFixed(1)} C; water recycler ${s.life.waterRecycler}; CO2/environment control ${s.life.environment}.`
                  : action === "inspectScience"
                    ? `SCIENCE: ${s.state.science} data points, ${s.samples.length + s.camp.samples} samples; ${s.experiments.length} experiments. Installed spectrometers: ${s.design.counts.spectrometer || 0}.`
                    : action === "inspectStorage"
                      ? `GALLEY: ${s.state.food} stored meals; ${s.state.water.toFixed(2)} L stored water; ${s.state.meals} carried meals; bottle ${s.state.bottle.toFixed(2)} L.`
                      : action === "inspectCamp"
                        ? `CAMP: ${s.camp.power.toFixed(2)} kWh; solar ${s.camp.solar ? "deployed" : "stowed"}; antenna ${s.camp.antenna ? "deployed" : "stowed"}; sensor ${s.camp.sensor ? "deployed" : "stowed"}; ${s.camp.broken ? "connector fault diagnosed" : "power connector normal"}.`
                        : `EQUIPMENT: ${s.pack.length} field items carried; ${s.state.parts} spare parts; toolkit ${s.state.tools ? "carried" : "stored"}.`,
          ),
        );
      }
      case "packEquipment":
        if (!atSite(s, "equipment") || outside(s))
          return fail("Collect the prepared equipment from Equipment Storage.");
        const loading = s.world.stored.filter(
          (id) =>
            ![
              "scanner",
              "drill",
              "camera",
              "containers",
              "sensor",
              "radiation",
              "experiment",
              "repair",
            ].includes(id),
        );
        n.pack = [...new Set([...s.pack, ...loading])];
        n.world = {
          ...s.world,
          stored: s.world.stored.filter((id) => !loading.includes(id)),
        };

        break;

      case "verifyPower":
      case "verifyLife":
      case "verifyRadio":
      case "verifyFuel":
        if (
          action === "verifyPower" &&
          (s.state.battery < 0.1 || s.state.malfunction)
        )
          return fail("Electrical power is not ready for launch.");
        if (
          action === "verifyLife" &&
          (s.state.oxygen < 0.3 ||
            s.state.water <= 0 ||
            s.state.food <= 0 ||
            s.state.pressure < 90)
        )
          return fail("Restore cabin supplies and pressure before launch.");
        if (action === "verifyRadio" && !s.state.communications)
          return fail("Restore the radio link before launch.");
        if (action === "verifyFuel" && s.state.fuel < 12)
          return fail("Insufficient propellant for departure and return.");
        n.flight.checks.push(action);
        break;
      case "sealHatch":
        if (
          !["verifyPower", "verifyLife", "verifyRadio", "verifyFuel"].every(
            (k) => s.flight.checks.includes(k),
          ) ||
          !s.state.course
        )
          return fail(
            "Finish the power, life support, radio, navigation and fuel checks first.",
          );
        n.flight.checks.push("sealed");
        break;
      case "armLaunch":
        if (!s.flight.checks.includes("sealed"))
          return fail("Seal the vehicle after pre-launch checks.");
        n.flight.countdown = 6;
        n.simRate = 1;
        break;
      case "ignite":
        if (s.flight.countdown !== 0 || s.flight.status !== "pad")
          return fail("Complete the launch countdown first.");
        n.flight.status = "ascent";
        n.flight.throttle = 0.85;
        break;
      case "separate":
        if (
          s.flight.status !== "ascent" ||
          s.flight.altitude < 12 ||
          s.flight.separated
        )
          return fail("Booster separation is not yet available.");
        n.flight.separated = true;
        n.state.fuel -= 1;
        break;
      case "insertOrbit":
        if (
          !s.flight.separated ||
          s.flight.altitude < 180 ||
          s.flight.velocity < 7.8
        )
          return fail("Reach 180 km and 7.8 km/s after booster separation.");
        n.world = {
          ...n.world,
          radioQueue: [
            ...n.world.radioQueue,
            {
              due: s.state.minutes + 1.5,
              text: "Telemetry confirms stable orbit. Payload operations authorized when ready.",
            },
          ],
        };
        n.flight.status = "orbit";
        n.observations.orbitMinute = s.state.minutes;
        n.simRate = 1;
        n.state.fuel -= 1;
        break;
      case "returnBurn":
        if (s.world.target !== "earth")
          return fail(
            "Select Earth recovery at Navigation before the return burn.",
          );
        if (s.flight.status !== "orbit")
          return fail("Return manoeuvres require a stable operational orbit.");
        if (
          m.objectives.some(
            (task) =>
              task.phase !== "RETURN & RECOVERY" &&
              !s.completed.includes(task.id) &&
              !satisfied(s, task),
          )
        )
          return fail(
            "Mission-critical operations remain incomplete. Review MISSION before committing to recovery.",
          );
        if (outside(s) || s.airlock.outer || s.state.fuel < (s.landed ? 6 : 3))
          return fail(
            "Return inside, close the outer hatch and reserve enough fuel for recovery.",
          );
        n.state.fuel -= s.landed ? 6 : 3;
        n.landed = false;
        n.world = {
          ...n.world,
          switches: { ...n.world.switches, maneuver: false },
        };
        n.flight.status = "returning";
        n.observations.returnMinute = s.state.minutes;
        n.simRate = 1;
        break;
      case "recoverVehicle":
        if (
          s.flight.status !== "returning" ||
          s.state.minutes - s.observations.returnMinute < 12
        )
          return fail("Perform the return burn first.");
        n.flight.status = "recovered";
        break;
      case "powerSafe":
        if (
          s.observations.achieved.some((id) =>
            m.objectives.some(
              (t) =>
                t.id === id && t.choices?.some((c) => c.action === "powerSafe"),
            ),
          )
        )
          return fail("The conservation plan is already active.");
        n.state.battery = Math.min(s.life.batteries, s.state.battery + 0.1);
        break;
      case "powerScience":
        if (s.state.malfunction)
          return fail(
            "Restore the diagnosed power fault before high-power science operation.",
          );
        if (s.state.battery < 0.16)
          return fail("The high-resolution observation needs 0.16 kWh.");
        n.state.battery -= 0.16;
        n.state.science = Math.min(100, s.state.science + 20);
        break;
      case "eventReset":
      case "eventReroute": {
        const campFault = atSite(s, "camp");
        if (!campFault && !atSite(s, "power"))
          return fail("Access the affected power system first.");
        if (campFault ? !s.camp.broken : !s.state.malfunction)
          return fail("The selected power system is operating normally.");
        if (
          campFault
            ? !s.observations.campDiagnosed
            : !s.observations.powerDiagnosed
        )
          return fail("Inspect and diagnose the affected power system first.");
        if (
          action === "eventReset" &&
          !campFault &&
          (!s.world.lockers.maintenance || s.world.switches.busB)
        )
          return fail("Open maintenance access and isolate Bus B for repair.");
        if (action === "eventReset") {
          if (!s.state.tools && !s.pack.includes("repair"))
            return fail(
              "Collect the repair toolkit before replacing hardware.",
            );
          if (s.state.parts < 1)
            return fail("No spare parts remain. Use the bypass option.");
          n.state.parts--;
        } else if (campFault) {
          if (s.camp.power < 0.16)
            return fail("The camp bypass needs 0.16 kWh.");
          n.camp.power -= 0.16;
        } else {
          if (s.state.battery < 0.12) return fail("The bypass needs 0.12 kWh.");
          n.state.battery -= 0.12;
          n.state.science = Math.max(0, s.state.science - 8);
        }
        if (campFault) n.camp.broken = false;
        else n.state.malfunction = false;
        n.simRate = 1;
        break;
      }
      case "selectCamp":
        n.systems.campExposure = 0.8;
        break;
      case "alignSolar":
        n.systems.campExposure = 1;
        n.suit.condition = Math.max(0, s.suit.condition - 4);
        break;
      case "diagnoseSatellite":
        if (
          m.id !== "mission-2" ||
          (!atSite(s, "power") && !(outside(s) && atSite(s, "survey")))
        )
          return fail(
            "Inspect satellite telemetry at Engineering or access its exterior service panel.",
          );
        n.systems.satelliteDiagnosed = true;
        break;
      case "repairSatellite":
        if (
          !outside(s) ||
          !atSite(s, "survey") ||
          !s.pack.includes("repair") ||
          !s.systems.satelliteDiagnosed ||
          s.state.parts < 1
        )
          return fail(
            "Inspect the satellite outside with a toolkit and spare part.",
          );
        n.state.parts--;
        n.suit.power = Math.max(0, n.suit.power - 0.05);
        n.systems.satelliteRepaired = true;
        break;
      case "testSatellite":
        if (
          !outside(s) ||
          !atSite(s, "survey") ||
          !s.systems.satelliteRepaired ||
          s.suit.power < 0.02
        )
          return fail("Repair the satellite connector first.");
        n.systems.satelliteOnline = true;
        n.suit.power -= 0.02;
        n.state.science = Math.min(100, n.state.science + 30);
        break;

      case "equipSuit":
        if (!atSite(s, "equipment")) return fail("Go to the equipment locker.");
        if (!s.selectedGear.includes("suit"))
          return fail("An EVA suit was not loaded during preparation.");
        if (packMass(s.selectedGear) > PACK_CAPACITY)
          return fail(
            "Your field pack is too heavy. Change your loadout before the mission.",
          );
        if (!s.suit.equipped) {
          if (
            s.state.oxygen <
              (s.upgrades.includes("improvedSuit") ? 0.5 : 0.35) ||
            s.state.battery < 0.15
          )
            return fail(
              "You need 0.35 kg spacecraft oxygen and 0.15 kWh to charge the suit.",
            );
          n.state.oxygen -= s.upgrades.includes("improvedSuit") ? 0.5 : 0.35;
          n.state.battery -= 0.15;
          n.suit = {
            equipped: true,
            oxygen: s.upgrades.includes("improvedSuit") ? 0.5 : 0.35,
            power: s.upgrades.includes("improvedSuit") ? 1.25 : 1,
            condition: 100,
            oxygenChecked: false,
            powerChecked: false,
          };
        }
        break;
      case "checkOxygen":
        if (!s.suit.equipped || s.suit.oxygen < 0.1)
          return fail("Put on a charged suit before checking oxygen.");
        if (!atSite(s, "equipment"))
          return fail("Use the equipment locker for the suit checkout.");
        n.suit.oxygenChecked = true;
        break;
      case "checkPower":
        if (!s.suit.equipped || s.suit.power < 0.2)
          return fail("Put on a charged suit before checking its battery.");
        if (!atSite(s, "equipment"))
          return fail("Use the equipment locker for the suit checkout.");
        n.suit.powerChecked = true;
        break;
      case "openInner":
        if (s.airlock.outer || s.airlock.cycling || s.airlock.pressure < 100)
          return fail(
            "Close the outside hatch and refill the airlock with air first.",
          );
        if (!atSite(s, "innerHatch") && !atSite(s, "airlock"))
          return fail("Stand beside the inside hatch.");
        n.airlock.inner = true;
        break;
      case "closeInner":
        if (!atSite(s, "airlock"))
          return fail("Walk into the airlock before closing the hatch.");
        n.airlock.inner = false;
        break;
      case "vent":
        if (!atSite(s, "airlock") || s.airlock.inner || s.airlock.outer)
          return fail("Enter the airlock and close both hatches.");
        if (!s.suit.equipped || !s.suit.oxygenChecked || !s.suit.powerChecked)
          return fail("Equip your suit and check its oxygen and power first.");
        n.airlock.cycling = "vent";
        break;
      case "openOuter":
        if (
          !atSite(s, "airlock") ||
          s.airlock.pressure > 0 ||
          s.airlock.inner ||
          s.airlock.cycling ||
          !s.suit.equipped
        )
          return fail(
            "The inside hatch must be closed and the chamber must be at vacuum.",
          );
        n.airlock.outer = true;
        break;
      case "closeOuter":
        if (!atSite(s, "airlock")) return fail("Walk into the airlock first.");
        n.airlock.outer = false;
        break;
      case "pressurize":
        if (!atSite(s, "airlock") || s.airlock.outer || s.airlock.inner)
          return fail("Close both hatches before adding air.");
        if (s.state.oxygen < 0.02 || s.state.battery < 0.01)
          return fail(
            "Refilling the airlock needs 0.02 kg oxygen and 0.01 kWh. Return reserves are too low.",
          );
        n.state.oxygen -= 0.02;
        n.state.battery -= 0.01;
        n.airlock.cycling = "pressurize";
        break;
      case "checkSystems":
        if (!atSite(s, "power") && !atSite(s, "cockpit"))
          return fail("Use the power station or cockpit.");
        if (s.state.battery < 0.1 || s.state.oxygen < 0.3)
          return fail(
            "Power or oxygen reserves are too low. Restock before the mission.",
          );
        break;
      case "approach":
      case "land":
        if (action === "land" && s.world.target !== "moon")
          return fail("Select the lunar landing destination at Navigation.");
        if (s.flight.status !== "orbit")
          return fail("Establish orbit before approach operations.");
        if (
          action === "land" &&
          (!m.surface ||
            !s.observations.achieved.some((id) =>
              m.objectives.some((t) => t.id === id && t.action === "approach"),
            ))
        )
          return fail(
            "A lunar landing requires a completed destination approach.",
          );
        if (action === "land" && s.landed)
          return fail("The vehicle is already landed.");
        if (
          s.state.battery < 0.1 ||
          s.state.pressure < 90 ||
          s.state.malfunction
        )
          return fail(
            "Check and restore power and cabin pressure before the manoeuvre.",
          );
        if (!atSite(s, "cockpit")) return fail("Go to the navigation console.");
        if (s.state.fuel < (action === "land" ? 5 : 2))
          return fail("Not enough fuel for this manoeuvre.");
        n.state.fuel -= action === "land" ? 5 : 2;
        if (action === "land") {
          n.landed = true;
          n.world = {
            ...n.world,
            switches: { ...n.world.switches, maneuver: false },
            radioQueue: [
              ...n.world.radioQueue,
              {
                due: s.state.minutes + 2,
                text: "Surface telemetry received. Verify vehicle condition before EVA.",
              },
            ],
          };
        }
        break;
      case "diagnose":
        n.observations.powerDiagnosed = s.state.malfunction;
        if (!atSite(s, "power")) return fail("Go to the power station.");
        break;
      case "scan":
      case "photo":
      case "measureRadiation":
      case "measureTemperature":
      case "experiment": {
        if (
          action === "experiment" &&
          (!s.camp.shelter ||
            !s.camp.battery ||
            s.camp.power < 0.03 ||
            s.camp.broken)
        )
          return fail(
            "Deploy a working powered camp before running this experiment.",
          );
        const fieldSite =
          (["camp", "crater", "relay", "survey"] as Site[]).find((site) =>
            atSite(s, site),
          ) || "field";
        const name = `${action} / ${m.destination} / ${fieldSite}`;
        if (!n.experiments.includes(name))
          n.experiments = [...n.experiments, name];
        n.state.science = Math.min(100, n.state.science + 15);
        if (action === "experiment") {
          n.camp.power -= 0.03;
          n.camp.science += 15;
        }
        break;
      }
      case "sample":
      case "drill":
        if (!s.pack.includes("containers"))
          return fail("Sample containers were not packed.");
        if (
          packMass(s.pack) +
            s.samples.reduce((sum, v) => sum + (v.mass || 0.42), 0) +
            (action === "drill" ? 0.32 : 0.42) >
          PACK_CAPACITY
        )
          return fail("Sample mass would exceed the field-pack limit.");
        if (s.samples.length >= 6)
          return fail("Sample containers are full. Store samples at the camp.");
        n.samples = [
          ...n.samples,
          {
            id: `${s.id}-${s.world.storedSamples.length + s.samples.length}`,
            kind:
              action === "drill" ? "Shallow subsurface sample" : "Rock sample",
            destination: m.destination,
            location:
              (["survey", "crater", "relay", "camp"] as Site[]).find((site) =>
                atSite(s, site),
              ) || "surface",
            mass: action === "drill" ? 0.32 : 0.42,
            collectedAt: s.state.minutes,
            status: "Carried · labelled",
            scientificValue: action === "drill" ? "High" : "Contextual",
          },
        ];
        n.state.science = Math.min(100, n.state.science + 20);
        break;
      case "deployShelter":
        n.camp.shelter = true;
        break;
      case "deploySolar":
        n.camp.solar = true;
        break;
      case "deployBattery":
        n.camp.battery = true;
        n.camp.power = 0.5;
        break;
      case "deployAntenna":
        n.camp.antenna = true;
        break;
      case "deployStorage":
        n.camp.storage = true;
        break;
      case "deploySensor":
        n.camp.sensor = true;
        break;
      case "storeSamples":
        if (!atSite(s, "camp") || !s.camp.storage)
          return fail("Use deployed sample storage at the research camp.");
        if (!s.samples.length)
          return fail("There are no carried samples to store.");
        n.world = {
          ...n.world,
          storedSamples: [
            ...n.world.storedSamples,
            ...s.samples.map((v) => ({ ...v, status: "Stored at camp" })),
          ],
        };
        n.camp.samples += s.samples.length;
        n.samples = [];
        break;
      case "repairCamp":
        if (!s.camp.broken)
          return fail("The field connector is working normally.");
        if (s.state.parts < 1) return fail("A spare part is required.");
        n.state.parts--;
        if (!s.observations.campDiagnosed)
          return fail(
            "Inspect the camp connector to diagnose the fault first.",
          );
        n.camp.broken = false;
        break;
      case "campTransmit":
        if (
          !s.camp.antenna ||
          !s.camp.battery ||
          s.camp.power <= 0.01 ||
          s.camp.broken ||
          s.camp.science <= 0
        )
          return fail("The research camp needs working power and an antenna.");
        n.camp.power -= 0.01;
        n.camp.sent = true;
        n.state.sent = true;
        break;
      default:
        return fail("This operation is not available.");
    }
    if (action.startsWith("deploy") && req)
      n.pack = n.pack.filter((id) => id !== req);
    n = logged(
      n,
      matching
        ? o.title.replace(/\.$/, "") + " — done."
        : action + " complete.",
    );
    success = true;
  }
  if (success && baseActions.has(action))
    n = {
      ...n,
      world: {
        ...n.world,
        messages: [
          ...n.world.messages,
          {
            at: n.state.minutes,
            source: (action === "science"
              ? "SCIENCE"
              : "CREW ACTION") as ShipState["messages"][number]["source"],
            text: n.state.notice,
          },
        ].slice(-120),
      },
    };
  if (success) {
    if (action === "comms" || action === "campTransmit") {
      n = receipt(n, action);
      if (s.state.science <= 0 && action === "comms")
        return evaluate(
          logged(
            n,
            "Earth link checked; no science data available for transmission.",
          ),
        );
      n.observations.queuedScience = n.state.science;
      n.pendingTransmit =
        s.state.minutes +
        Math.max(1.5, environments[m.destination].communicationDelay / 10) /
          (Math.max(1, s.design.counts.antenna || 1) *
            (s.upgrades.includes("highGain") ? 1.5 : 1));
      return evaluate(say(n, "Data queued. Awaiting acknowledgement."));
    }
    n = receipt(n, action);
    return evaluate(applyEvents(n));
  }
  return n;
}
export function makeReport(s: Session, success: boolean): Report {
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  const science = clamp(
    missionById(s.missionId).experiments.length ? s.state.science * 2 : 100,
  );
  const resources = clamp(
    (((s.state.food + s.state.meals) / s.life.food +
      (s.state.water + s.state.bottle) / s.life.water +
      s.state.oxygen / s.life.oxygen) /
      3) *
      100,
  );
  const crew = clamp(s.state.energy);
  const power = clamp((s.state.battery / s.life.batteries) * 100);
  const fuel = clamp(
    (s.state.fuel / Math.max(1, newMission(s.design, s.life).fuel)) * 100,
  );
  const communications = s.state.communications ? 100 : 0;
  const condition = clamp(
    (s.state.malfunction ? 60 : 100) *
      (s.suit.equipped ? s.suit.condition / 100 : 1),
  );
  const weights = missionById(s.missionId).scoring;
  const score = Math.round(
    (science * weights.science * 0.6 +
      resources * weights.resources * 0.6 +
      crew * weights.crew * 0.6 +
      power * 0.1 +
      fuel * 0.1 +
      communications * 0.1 +
      condition * 0.1) *
      (success ? 1 : 0.5),
  );
  return {
    missionId: s.missionId,
    runId: s.id,
    success,
    score,
    rank: success ? (score >= 90 ? "A" : score >= 75 ? "B" : "C") : "ABORT",
    science,
    resources,
    condition,
    crew,
    power,
    fuel,
    communications,
    experiments: s.experiments.length,
    samples: s.samples.length + s.world.storedSamples.length,
    sampleManifest: [...s.samples, ...s.world.storedSamples],
    remaining: {
      fuel: s.state.fuel,
      battery: s.state.battery,
      science: s.state.science,
    },
    optional: completedOptional(s).length,
    optionalResults: (missionById(s.missionId).optional || []).map((o) => ({
      id: o.id,
      title: o.title,
      reward: o.reward,
      complete: completedOptional(s).includes(o.id),
    })),
    outcome: success
      ? "SUCCESS"
      : s.state.science >= 30
        ? "PARTIAL SUCCESS"
        : "FAILURE",
    finance: financialReport(
      s,
      missionById(s.missionId),
      success,
      (missionById(s.missionId).optional || [])
        .filter((o) => completedOptional(s).includes(o.id))
        .reduce((sum, o) => sum + o.reward, 0),
    ),
    unlocks: success
      ? ((missionById(s.missionId).unlocks || []) as Technology[])
      : [],
    minutes: s.state.minutes,
    good: [
      success
        ? "All required mission conditions and safety procedures were fulfilled."
        : "A mission record was saved for review.",
      ...(s.state.energy >= 60 ? ["Crew energy remained healthy."] : []),
      ...(s.airlock.inner && s.airlock.pressure >= 100
        ? ["Airlock return procedures were completed safely."]
        : []),
    ],
    improve: [
      ...(resources < 75
        ? ["Provision more supplies or improve recycling."]
        : []),
      ...(s.state.energy < 60
        ? ["Eat, drink and rest before extended field work."]
        : []),
      ...(s.state.malfunction ? ["Repair the spacecraft power unit."] : []),
      ...(!success ? ["Restart the mission with more reserve capacity."] : []),
    ],
    timestamp: Date.now(),
  };
}
export function recordReport(p: Progress, s: Session): Progress {
  if (!s.report) return p;
  p = settle(p, s);
  if (p.history.some((r) => r.runId === s.id)) return p;
  const r = s.report;
  return {
    ...p,
    completed: r.success
      ? {
          ...p.completed,
          [s.missionId]:
            !p.completed[s.missionId] ||
            r.score > p.completed[s.missionId].score
              ? r
              : p.completed[s.missionId],
        }
      : p.completed,
    history: [r, ...p.history].slice(0, 100),
    condition: s.finance.practice ? p.condition : { ...s.world.condition },
    equipmentCondition: s.finance.practice
      ? p.equipmentCondition
      : {
          ...s.world.equipment,
          ...(s.suit.equipped ? { suit: s.suit.condition } : {}),
        },
    outposts:
      r.success && s.camp.shelter
        ? {
            ...p.outposts,
            [missionById(s.missionId).destination]: structuredClone(s.camp),
          }
        : p.outposts,
  };
}
export const unlockedChapters = (p: Progress) => [
  ...new Set(
    missions
      .filter((m) => m.prerequisites.every((id) => p.completed[id]))
      .map((m) => m.chapter),
  ),
];

export function currentPhase(s: Session) {
  const m = missionById(s.missionId);
  if (s.report) return "MISSION REPORT";
  if (currentObjective(s)?.phase) return currentObjective(s)!.phase!;
  const returnIndex = m.objectives.findIndex((o) => o.type === "RETURN");
  if (m.eva && returnIndex >= 0 && s.objective >= returnIndex)
    return "RETURN TO SPACECRAFT";
  if (m.eva && outside(s)) {
    const candidate =
      currentObjective(s)?.site === "camp"
        ? "RESEARCH CAMP"
        : "FIELD EXPEDITION";
    return m.phases.includes(candidate) ? candidate : "EVA";
  }
  if (m.eva) return s.position.z > 7.7 ? "EVA" : "EVA PREPARATION";
  return m.phases[0];
}

export function completedOptional(s: Session): string[] {
  const m = missionById(s.missionId);
  return (m.optional || [])
    .filter(
      (o) =>
        s.optionalDone.includes(o.id) ||
        (o.condition === "battery" &&
          s.state.battery / s.life.batteries >= (o.value || 0)) ||
        (o.condition === "fuel" && s.state.fuel > (o.value || 0)) ||
        (o.condition === "samples" &&
          s.samples.length + s.camp.samples >= (o.value || 0)) ||
        (o.condition === "suit" &&
          s.suit.equipped &&
          s.suit.oxygen / (s.upgrades.includes("improvedSuit") ? 0.5 : 0.35) >=
            (o.value || 0) &&
          s.suit.power >= (o.value || 0)),
    )
    .map((o) => o.id);
}
export function optionalCommand(s: Session, id: string): Session {
  if (
    s.state.paused ||
    s.state.sleeping ||
    s.report ||
    s.state.ended ||
    s.flight.status !== "orbit"
  )
    return s;
  const o = missionById(s.missionId).optional?.find((o) => o.id === id);
  if (!o?.action || s.optionalDone.includes(id))
    return say(s, "This optional operation is unavailable or complete.");
  if (o.site && !atSite(s, o.site))
    return say(
      s,
      "Optional task: go to " +
        sitePosition(o.site, missionById(s.missionId).destination).name +
        ".",
    );
  if (o.gear && !s.pack.includes(o.gear))
    return say(
      s,
      "This optional task needs the " + equipment[o.gear].name + ".",
    );
  const exterior = o.site && !(o.site in deck);
  if (exterior && (!outside(s) || !s.suit.equipped || s.suit.power < 0.06))
    return say(
      s,
      "This task requires an EVA suit with power, outside the spacecraft.",
    );
  if (o.id === "rare" && s.samples.length >= 6)
    return say(
      s,
      "The sample containers are full. Leave capacity for this optional sample.",
    );
  const usesPart = o.action === "repairSecondary" || o.id === "recover";
  if (usesPart && s.state.parts < 1)
    return say(s, "Keep a spare part for this optional recovery.");
  if (!exterior && s.state.battery < 0.1)
    return say(s, "The calibration needs 0.10 kWh battery reserve.");
  const n = {
    ...s,
    state: { ...s.state },
    suit: { ...s.suit },
    optionalDone: [...s.optionalDone, id],
    samples: [...s.samples],
    simRate: 1,
  };
  n.state.parts -= usesPart ? 1 : 0;
  n.state.energy = Math.max(0, n.state.energy - 5);
  if (exterior) n.suit.power -= 0.06;
  else n.state.battery -= 0.1;
  n.state.science = Math.min(100, n.state.science + 12);
  if (o.id === "rare")
    n.samples.push({
      id: s.id + ":rare",
      kind: "Distant survey sample",
      destination: missionById(s.missionId).destination,
    });
  return logged(
    n,
    `OPTIONAL COMPLETE: ${o.title}. +$${o.reward}M on successful recovery.`,
  );
}
export function setSimRate(s: Session, rate: number): Session {
  if (![1, 5, 20, 100].includes(rate) || s.report) return s;
  // Do not accelerate ascent, EVA, low reserves or a live warning/decision.
  const o = currentObjective(s);
  if (
    rate > 1 &&
    (s.flight.status === "pad" ||
      s.flight.status === "ascent" ||
      outside(s) ||
      s.airlock.cycling ||
      o?.choices ||
      o?.type !== "WAIT" ||
      s.state.malfunction ||
      s.camp.broken ||
      s.state.battery / s.life.batteries < 0.2 ||
      s.state.oxygen < 0.5 ||
      s.state.energy < 25)
  )
    return say(
      { ...s, simRate: 1 },
      "Normal speed is required for active operations or low reserves. Acceleration is available during monitored travel and rest waits.",
    );
  return { ...s, simRate: rate };
}
export function flightControls(
  s: Session,
  throttle: number,
  pitch: number,
): Session {
  if (s.state.paused || s.flight.status !== "ascent") return s;
  return {
    ...s,
    flight: {
      ...s.flight,
      throttle: Math.max(0, Math.min(1, throttle)),
      pitch: Math.max(0, Math.min(90, pitch)),
    },
  };
}

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
import type { Design } from "../../game";
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
  samples: { id: string; kind: string; destination: Destination }[];
  experiments: string[];
  pendingTransmit: number;
  landed: boolean;
  eventIds: string[];
  completionMessage: string;
  report?: Report;
  notice: string;
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
};
export type Progress = {
  completed: Record<string, Report>;
  history: Report[];
  tutorials: string[];
  outposts: Partial<Record<Destination, Camp>>;
};
export const emptyProgress = (): Progress => ({
  completed: {},
  history: [],
  tutorials: [],
  outposts: {},
});
export const fieldSites: Record<
  string,
  { x: number; z: number; name: string }
> = {
  innerHatch: { x: 0, z: 7.05, name: "Inside hatch" },
  airlock: { x: 0, z: 9, name: "Airlock chamber" },
  outerHatch: { x: 0, z: 10, name: "Outside hatch" },
  survey: { x: 3, z: 16, name: "Survey marker" },
  crater: { x: -6, z: 23, name: "Shallow crater" },
  camp: { x: 6, z: 26, name: "Research camp" },
  relay: { x: -7, z: 32, name: "Distant survey" },
};
export function sitePosition(site: Site, destination: Destination) {
  if (site in deck) return deck[site as Area];
  const p = fieldSites[site];
  if (destination === "earth" && site === "survey")
    return { x: 1.8, z: 14, name: "Training target" };
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
) {
  const e = engineering(design, life);
  return {
    ...e,
    mass:
      e.mass +
      gear.reduce((sum, id) => sum + equipment[id].mass, 0) +
      (eva ? 140 : 0),
    cost: e.cost + packCost(gear) + (eva ? 12 : 0),
    power: e.power - (eva ? 10 : 0),
  };
}
export function createSession(
  m: MissionDefinition,
  d: Design,
  l: LifeSupport,
  gear: EquipmentId[],
  p: Progress,
): Session {
  if (!canStart(m, p))
    throw new Error("This mission is locked or not implemented.");
  const state = newMission(d, l);
  state.notice =
    "Follow the current task. Use the waypoint to find the right equipment.";
  const s: Session = {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    missionId: m.id,
    revision: m.revision,
    state,
    design: structuredClone(d),
    life: { ...l },
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
  };
  return applyEvents(s);
}
export function currentObjective(s: Session) {
  return missionById(s.missionId).objectives[s.objective];
}
function say(s: Session, message: string) {
  return { ...s, notice: message, state: { ...s.state, notice: message } };
}
function logged(s: Session, message: string) {
  const n = say(s, message);
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
  return n;
}
export function evaluate(s: Session): Session {
  if (s.report || s.state.paused || s.state.ended) return s;
  const o = currentObjective(s);
  if (!o) return s;
  if (
    (o.type === "GO_TO" || o.type === "RETURN") &&
    o.site &&
    atSite(s, o.site)
  )
    return advance(s);
  if (
    o.type === "TRANSMIT" &&
    s.pendingTransmit > 0 &&
    s.state.minutes >= s.pendingTransmit
  )
    return advance({
      ...s,
      pendingTransmit: 0,
      state: { ...s.state, sent: true },
    });
  if (o.type === "WAIT") {
    const passed =
      o.condition === "vacuum"
        ? s.airlock.pressure <= 0 && !s.airlock.cycling
        : o.condition === "pressurized"
          ? s.airlock.pressure >= 101.3 && !s.airlock.cycling
          : o.condition === "science"
            ? s.state.science >= (o.value || 30)
            : s.state.minutes - s.objectiveStarted >= (o.value || 1);
    if (passed) return advance(s);
  }
  return s;
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
  return n;
}
export function tickSession(s: Session, minutes = 1): Session {
  if (s.state.paused || s.state.ended || s.report) return s;
  const env = environments[missionById(s.missionId).destination];
  let n = {
    ...s,
    state: tick(s.state, s.design, s.life, minutes, { scriptedEvents: false }),
    airlock: { ...s.airlock },
    suit: { ...s.suit },
    camp: { ...s.camp },
  };
  const solarDelta = (s.design.counts.solar || 0) * 85 * (env.solar - 1);
  n.state.battery = Math.max(
    0,
    Math.min(
      s.life.batteries,
      n.state.battery +
        ((solarDelta - (missionById(s.missionId).eva ? 10 : 0)) * minutes) /
          60000,
    ),
  );
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
      (n.camp.solar && !n.camp.broken ? 80 * env.solar : 0) -
      (n.camp.antenna ? 5 : 0) -
      (n.camp.sensor ? 5 : 0);
    n.camp.power = Math.max(
      0,
      Math.min(0.5, n.camp.power + (watts * minutes) / 60000),
    );
  }
  n = applyEvents(n);
  if (n.state.ended) {
    n.report = makeReport(n, false);
    n.notice = n.notice.startsWith("EVA safety") ? n.notice : n.state.notice;
    return n;
  }
  return evaluate(n);
}
export function moveSession(s: Session, p: Position) {
  if (s.state.paused || s.state.sleeping || s.state.ended) return s;
  for (const [z, open] of [[7.75, s.airlock.inner], [10.25, s.airlock.outer]] as const) {
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
  if (z <= 7.15) return walkable(x, z);
  if (!missionById(s.missionId).eva) return false;
  if (z < 10.45) {
    if (Math.abs(x) > 0.62) return false;
    if (Math.abs(z - 7.75) < 0.22 && !s.airlock.inner) return false;
    if (Math.abs(z - 10.25) < 0.22 && !s.airlock.outer) return false;
    return true;
  }
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
  if (s.report || s.state.paused || s.state.ended) return s;
  if (s.state.sleeping && action !== "wake")
    return say(s, "Wake up before using equipment.");
  const m = missionById(s.missionId),
    o = currentObjective(s);
  if (!o) return s;
  const matching = o.action === action;
  if (matching && o.type === "TRANSMIT" && s.pendingTransmit > 0)
    return say(s, "The message is sending. Wait for confirmation.");
  const locked = m.objectives
    .slice(s.objective + 1)
    .some((v) => v.action === action);
  if (!matching && locked) return say(s, "First: " + o.title);
  let n: Session = {
    ...s,
    state: { ...s.state },
    airlock: { ...s.airlock },
    suit: { ...s.suit },
    camp: { ...s.camp },
    pack: [...s.pack],
  };
  let success = false;
  const fail = (message: string) => say(s, message);
  if (matching && o.site && !atSite(s, o.site))
    return fail(
      "Go to " + sitePosition(o.site, m.destination).name + " first.",
    );
  if (baseActions.has(action)) {
    if (outside(s) && ["eat", "drink", "dispenser", "sleep"].includes(action))
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
    if (action === "course" && s.state.course) n.state.course = false;
    const before = n.state;
    const result = act(
      before,
      action as Action,
      nearby(s.position.x, s.position.z),
      s.design,
      s.life,
    );
    success = result.log !== before.log;
    n.state = result;
    if (!success) return say(s, result.notice);
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
    if (req) n.suit.power = Math.max(0, n.suit.power - equipment[req].power);
    switch (action) {
      case "equipSuit":
        if (!atSite(s, "equipment")) return fail("Go to the equipment locker.");
        if (!s.selectedGear.includes("suit"))
          return fail("An EVA suit was not loaded during preparation.");
        if (packMass(s.selectedGear) > PACK_CAPACITY)
          return fail(
            "Your field pack is too heavy. Change your loadout before the mission.",
          );
        if (!s.suit.equipped) {
          if (s.state.oxygen < 0.35 || s.state.battery < 0.15)
            return fail(
              "You need 0.35 kg spacecraft oxygen and 0.15 kWh to charge the suit.",
            );
          n.state.oxygen -= 0.35;
          n.state.battery -= 0.15;
          n.suit = {
            equipped: true,
            oxygen: 0.35,
            power: 1,
            condition: 100,
            oxygenChecked: false,
            powerChecked: false,
          };
          n.pack = s.selectedGear.filter((id) => id !== "suit");
        }
        break;
      case "checkOxygen":
        if (!s.suit.equipped || s.suit.oxygen < 0.1)
          return fail("Put on a charged suit before checking oxygen.");
        n.suit.oxygenChecked = true;
        break;
      case "checkPower":
        if (!s.suit.equipped || s.suit.power < 0.2)
          return fail("Put on a charged suit before checking its battery.");
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
        if (action === "land") n.landed = true;
        break;
      case "diagnose":
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
        const name = `${action} / ${m.destination} / ${o.site || "field"}`;
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
        if (s.samples.length >= 6)
          return fail("Sample containers are full. Store samples at the camp.");
        n.samples = [
          ...n.samples,
          {
            id: `${s.id}-${s.samples.length}`,
            kind:
              action === "drill" ? "Shallow subsurface sample" : "Rock sample",
            destination: m.destination,
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
        n.camp.samples += s.samples.length;
        n.samples = [];
        break;
      case "repairCamp":
        if (!s.camp.broken)
          return fail("The field connector is working normally.");
        if (s.state.parts < 1) return fail("A spare part is required.");
        n.state.parts--;
        n.camp.broken = false;
        break;
      case "campTransmit":
        if (
          !s.camp.antenna ||
          !s.camp.battery ||
          s.camp.power <= 0.01 ||
          s.camp.broken
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
  if (success && matching) {
    if (o.type === "TRANSMIT") {
      n.pendingTransmit = s.state.minutes +
        Math.max(1.5, environments[m.destination].communicationDelay / 10) /
        Math.max(1, s.design.counts.antenna || 1);
      return say(n, "Sending data. Wait for the radio confirmation.");
    }
    n.repetitions++;
    if (n.repetitions >= (o.count || 1)) return advance(n);
    n = say(
      n,
      `${n.repetitions} / ${o.count} observations collected. Use the station again.`,
    );
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
    samples: s.samples.length + s.camp.samples,
    optional: 0,
    minutes: s.state.minutes,
    good: [
      success
        ? "All required tasks were completed in order."
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
  if (!s.report || p.history.some((r) => r.runId === s.id)) return p;
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

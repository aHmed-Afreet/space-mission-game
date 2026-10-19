import { emptyObservations } from "./observations";
import { decodeStore as decodeLegacy } from "./legacySave";
import { technologies } from "./economy";
import {
  defaultDesign,
  defaultLife,
  lifeOptions,
  type LifeSupport,
} from "../simulation";
import { components, rockets, trajectories, type Design } from "../../game";
import { missions, missionById } from "./definitions";
import { equipment, type EquipmentId } from "./equipment";
import {
  emptyProgress,
  campaignWalkable,
  type Progress,
  type Session,
  type Report,
} from "./engine";
import { spawn } from "../layout";
export const SAVE_KEY = "orbital-campaign-v3";
export type Store = {
  version: 3;
  design: Design;
  life: LifeSupport;
  progress: Progress;
  session: Session | null;
};
export const newStore = (): Store => ({
  version: 3,
  design: structuredClone(defaultDesign),
  life: { ...defaultLife },
  progress: emptyProgress(),
  session: null,
});
const finite = (v: unknown) => typeof v === "number" && Number.isFinite(v);
function configuration(d: any, l: any) {
  if (!d?.counts || !rockets[d.rocket] || !trajectories[d.trajectory] || !l)
    throw Error("Invalid spacecraft configuration");
  for (const c of components)
    if (
      !Number.isInteger(d.counts[c.id] || 0) ||
      (d.counts[c.id] || 0) < 0 ||
      (d.counts[c.id] || 0) > 2
    )
      throw Error("Invalid hardware");
  for (const o of lifeOptions)
    if (
      !finite(l[o.key]) ||
      l[o.key] < o.min ||
      l[o.key] > o.max + (o.key === "batteries" ? 1 : 0)
    )
      throw Error("Invalid life support");
}
function validCamp(c: any) {
  return (
    c &&
    [
      "shelter",
      "solar",
      "battery",
      "antenna",
      "storage",
      "sensor",
      "broken",
      "sent",
    ].every((k) => typeof c[k] === "boolean") &&
    ["power", "samples", "science"].every((k) => finite(c[k]) && c[k] >= 0)
  );
}
function report(r: any): r is Report {
  return (
    !!r &&
    typeof r.runId === "string" &&
    missions.some((m) => m.id === r.missionId) &&
    typeof r.success === "boolean" &&
    finite(r.score) &&
    r.score >= 0 &&
    r.score <= 100 &&
    typeof r.rank === "string" &&
    !!r.remaining &&
    [r.remaining.fuel, r.remaining.battery, r.remaining.science].every(
      finite,
    ) &&
    ["SUCCESS", "PARTIAL SUCCESS", "FAILURE"].includes(r.outcome) &&
    Array.isArray(r.optionalResults) &&
    Array.isArray(r.unlocks) &&
    !!r.finance &&
    [
      "before",
      "allocation",
      "assistance",
      "cost",
      "base",
      "optional",
      "science",
      "efficiency",
      "recovery",
      "insurance",
      "repair",
      "earned",
      "after",
    ].every((k) => finite(r.finance[k]) && r.finance[k] >= 0) &&
    [
      "science",
      "resources",
      "condition",
      "crew",
      "power",
      "fuel",
      "communications",
      "experiments",
      "samples",
      "optional",
      "minutes",
      "timestamp",
    ].every((k) => finite(r[k]) && r[k] >= 0) &&
    Array.isArray(r.good) &&
    r.good.every((v: unknown) => typeof v === "string") &&
    Array.isArray(r.improve) &&
    r.improve.every((v: unknown) => typeof v === "string")
  );
}
export function decodeStore(raw: string): Store {
  const v = JSON.parse(raw);
  if (v.version !== 3) throw Error("Unsupported save version");
  configuration(v.design, v.life);
  if (
    !v.progress ||
    !v.progress.completed ||
    !Array.isArray(v.progress.history) ||
    !Array.isArray(v.progress.tutorials)
  )
    throw Error("Invalid campaign progress");
  for (const [id, r] of Object.entries(v.progress.completed))
    if (!report(r) || (r as Report).missionId !== id || !(r as Report).success)
      throw Error("Invalid mission completion");
  const economy = v.progress.economy;
  if (
    !economy ||
    !finite(economy.balance) ||
    economy.balance < 0 ||
    !["funded", "settled", "launched", "unlocks", "ledger"].every((k) =>
      Array.isArray(economy[k]),
    )
  )
    throw Error("Invalid Agency Budget");
  if (
    [...economy.funded, ...economy.settled, ...economy.launched].some(
      (id) => typeof id !== "string",
    ) ||
    economy.unlocks.some((id: string) => !(id in technologies))
  )
    throw Error("Invalid economy records");
  for (const row of economy.ledger)
    if (
      typeof row.id !== "string" ||
      typeof row.label !== "string" ||
      !finite(row.amount) ||
      !finite(row.balance)
    )
      throw Error("Invalid funding ledger");
  v.progress.history = v.progress.history.filter(report).slice(0, 100);
  v.progress.tutorials = v.progress.tutorials.filter(
    (s: any) => typeof s === "string",
  );
  v.progress.outposts = v.progress.outposts || {};
  for (const [destination, camp] of Object.entries(v.progress.outposts))
    if (
      !["earth", "moon", "mars", "asteroid", "deep-space", "europa"].includes(
        destination,
      ) ||
      !validCamp(camp)
    )
      throw Error("Invalid saved outpost");
  if (v.session) {
    const s = v.session as Session;
    const m = missionById(s.missionId);
    if (s.observations)
      s.observations = { ...emptyObservations(), ...s.observations };
    if (!s.observations)
      s.observations = { ...emptyObservations(), achieved: [...s.completed] };
    if (
      !Array.isArray(s.observations.achieved) ||
      !Array.isArray(s.observations.visits) ||
      !Array.isArray(s.observations.pending) ||
      !finite(s.observations.rest) ||
      s.observations.rest < 0 ||
      !finite(s.observations.transmitted)
    )
      throw Error("Invalid operational observations");
    for (const flag of [
      "exterior",
      "vacuum",
      "powerDiagnosed",
      "campDiagnosed",
    ] as const)
      if (typeof s.observations[flag] !== "boolean")
        throw Error("Invalid observation state");
    configuration(s.design, s.life);
    if (
      !Array.isArray(s.upgrades) ||
      s.upgrades.some((id) => !(id in technologies)) ||
      !Array.isArray(s.optionalDone) ||
      ![1, 5, 20, 100].includes(s.simRate) ||
      !s.flight ||
      !s.systems ||
      !s.finance
    )
      throw Error("Invalid flight checkpoint");
    if (
      !["pad", "ascent", "orbit", "returning", "recovered"].includes(
        s.flight.status,
      ) ||
      !Array.isArray(s.flight.checks) ||
      [
        s.flight.altitude,
        s.flight.velocity,
        s.flight.throttle,
        s.flight.pitch,
        s.flight.countdown,
        s.systems.campExposure,
      ].some((v) => !finite(v))
    )
      throw Error("Invalid flight controls");
    if (
      [
        s.finance.before,
        s.finance.allocation,
        s.finance.assistance,
        s.finance.cost,
      ].some((v) => !finite(v) || v < 0) ||
      typeof s.finance.practice !== "boolean"
    )
      throw Error("Invalid flight spending");
    if (!v.progress.economy.launched.includes(s.id))
      throw Error("Mission spending record missing");
    if (
      !missions.some((candidate) => candidate.id === s.missionId) ||
      !m.implemented ||
      s.revision !== m.revision ||
      !s.state ||
      !s.position ||
      !s.airlock ||
      !s.suit ||
      !s.camp ||
      !Array.isArray(s.pack) ||
      !Array.isArray(s.selectedGear) ||
      !Array.isArray(s.samples) ||
      !Array.isArray(s.experiments) ||
      !Array.isArray(s.completed) ||
      !Array.isArray(s.eventIds) ||
      !Number.isInteger(s.objective) ||
      s.objective < 0 ||
      s.objective > m.objectives.length ||
      !finite(s.repetitions) ||
      !finite(s.objectiveStarted) ||
      !finite(s.lastEat) ||
      !finite(s.lastDrink) ||
      !finite(s.pendingTransmit) ||
      typeof s.id !== "string"
    )
      throw Error("Invalid mission checkpoint");
    for (const g of [...s.pack, ...s.selectedGear])
      if (!(g in equipment)) throw Error("Invalid equipment");
    for (const k of [
      "minutes",
      "food",
      "water",
      "oxygen",
      "battery",
      "energy",
      "nutrition",
      "hydration",
      "sleepDebt",
      "pressure",
      "temperature",
      "radiation",
      "science",
      "fuel",
      "meals",
      "bottle",
      "parts",
    ] as const)
      if (!finite(s.state[k])) throw Error("Invalid resource");
    for (const k of ["x", "z", "heading"] as const)
      if (!finite(s.position[k])) throw Error("Invalid position");
    for (const k of ["oxygen", "power", "condition"] as const)
      if (!finite(s.suit[k]) || s.suit[k] < 0) throw Error("Invalid suit");
    for (const k of [
      "shelter",
      "solar",
      "battery",
      "antenna",
      "storage",
      "sensor",
      "broken",
      "sent",
    ] as const)
      if (typeof s.camp[k] !== "boolean") throw Error("Invalid camp");
    for (const k of ["power", "samples", "science"] as const)
      if (!finite(s.camp[k]) || s.camp[k] < 0)
        throw Error("Invalid camp resources");
    if (
      ["inner", "outer"].some(
        (k) => typeof (s.airlock as any)[k] !== "boolean",
      ) ||
      typeof s.suit.equipped !== "boolean" ||
      typeof s.suit.oxygenChecked !== "boolean" ||
      typeof s.suit.powerChecked !== "boolean"
    )
      throw Error("Invalid suit/airlock state");
    if (
      !finite(s.airlock.pressure) ||
      s.airlock.pressure < 0 ||
      s.airlock.pressure > 101.3 ||
      !Array.isArray(s.state.log)
    )
      throw Error("Invalid airlock/log");
    if (
      (s.airlock.inner && s.airlock.outer) ||
      (s.airlock.inner && s.airlock.pressure < 100) ||
      (s.airlock.outer && s.airlock.pressure > 0)
    )
      throw Error("Unsafe airlock checkpoint");
    if (!m.prerequisites.every((id) => v.progress.completed[id]))
      throw Error("Checkpoint prerequisites missing");
    if (!campaignWalkable(s.position.x, s.position.z, s))
      s.position = { ...spawn };
    s.state.paused = true;
    s.simRate = 1;
    if (
      s.report &&
      (!report(s.report) ||
        s.report.runId !== s.id ||
        s.report.missionId !== s.missionId)
    )
      throw Error("Invalid report");
  }
  return v as Store;
}
export function loadStore(storage: Pick<Storage, "getItem">): {
  store: Store;
  warning: string;
  readOnly: boolean;
  legacy: boolean;
} {
  let legacy = false;
  try {
    const old = storage.getItem("orbital-commander-v1");
    if (old) {
      const v = JSON.parse(old);
      configuration(v.design, v.life);
      legacy = !!v.mission;
    }
  } catch {
    /* Leave an old unknown save untouched. */
  }
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.version > 3)
        return {
          store: newStore(),
          warning:
            "A newer campaign save exists. It has not been changed. Use the newer app version to continue.",
          readOnly: true,
          legacy,
        };
      return { store: decodeStore(raw), warning: "", readOnly: false, legacy };
    }
  } catch {
    try {
      const backup = storage.getItem(SAVE_KEY + ".backup");
      if (backup)
        return {
          store: decodeStore(backup),
          warning: "Your previous valid campaign backup was restored.",
          readOnly: false,
          legacy,
        };
    } catch {}
    return {
      store: newStore(),
      warning:
        "The campaign save could not be read. Your older save was left untouched; a new campaign can be started.",
      readOnly: false,
      legacy,
    };
  }
  const store = newStore();
  try {
    const older = storage.getItem("orbital-campaign-v2");
    if (older) {
      const previous = decodeLegacy(older);
      store.design = previous.design;
      store.life = previous.life;
      store.progress.outposts = previous.progress.outposts;
      const trainingComplete = [1, 2, 3, 4, 5, 6].every(
        (n) => previous.progress.completed[`level-${n}`],
      );
      const lunarComplete = [7, 8, 9, 10, 11, 12].every(
        (n) => previous.progress.completed[`level-${n}`],
      );
      store.progress.archive = {
        completed: previous.progress.completed,
        history: previous.progress.history,
        checkpoint: previous.session,
        chapters: [
          ...(trainingComplete ? ["Command Training"] : []),
          ...(lunarComplete ? ["Lunar Expedition"] : []),
        ],
      };
      if (trainingComplete) store.progress.economy.unlocks = ["highGain"];
      return {
        store,
        warning:
          "Previous task-level achievements, results, spacecraft and checkpoint are archived. Complete missions now begin with Orbital Qualification. The original v2 save is untouched.",
        readOnly: false,
        legacy,
      };
    }
  } catch {
    return {
      store,
      warning:
        "The older campaign could not be migrated safely. It remains untouched; a new campaign is available.",
      readOnly: false,
      legacy,
    };
  }
  if (legacy) {
    try {
      const old = JSON.parse(storage.getItem("orbital-commander-v1")!);
      store.design = old.design;
      store.life = old.life;
    } catch {}
  }
  return {
    store,
    warning: legacy
      ? "Your previous readiness sortie is preserved separately. Campaign training begins at Level 1."
      : "",
    readOnly: false,
    legacy,
  };
}
export function persist(
  storage: Pick<Storage, "getItem" | "setItem">,
  store: Store,
) {
  const encoded = JSON.stringify(store);
  decodeStore(encoded);
  const previous = storage.getItem(SAVE_KEY);
  if (previous) {
    let version = 0;
    try {
      version = JSON.parse(previous).version;
    } catch {
      /* Replace corrupt data only after validating the new checkpoint. */
    }
    if (version > 3)
      throw Error("A newer campaign save cannot be overwritten.");
    try {
      decodeStore(previous);
      storage.setItem(SAVE_KEY + ".backup", previous);
    } catch {}
  }
  storage.setItem(SAVE_KEY, encoded);
}
export function toggleGear(gear: EquipmentId[], id: EquipmentId) {
  return gear.includes(id) ? gear.filter((g) => g !== id) : [...gear, id];
}

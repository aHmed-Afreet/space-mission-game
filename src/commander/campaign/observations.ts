import { acknowledgeScientificResults } from "./scientificResults";
import type { Session } from "./engine";
import { atSite, outside } from "./engine";
import {
  missionForSession,
  type CampaignAction,
  type Objective,
  type Site,
} from "./definitions";
export const airlockActions = ["openInner", "closeInner", "vent", "openOuter", "closeOuter", "pressurize"] as const;
export type AirlockAction = (typeof airlockActions)[number];
export type AirlockProcedure = {
  version: 1;
  epoch: number;
  zone: "cabin" | "chamber" | "exterior";
  leg: "outbound" | "inbound";
  receipts: Partial<Record<AirlockAction, number>>;
  legacy: boolean;
};
export function validAirlockProcedure(value: unknown): value is AirlockProcedure {
  if (!value || typeof value !== "object") return false;
  const v = value as AirlockProcedure;
  return v.version === 1 && Number.isSafeInteger(v.epoch) && v.epoch >= 0 &&
    ["cabin", "chamber", "exterior"].includes(v.zone) && ["outbound", "inbound"].includes(v.leg) &&
    typeof v.legacy === "boolean" && !!v.receipts && !Array.isArray(v.receipts) && Object.entries(v.receipts).every(([action, epoch]) =>
      airlockActions.includes(action as AirlockAction) && Number.isSafeInteger(epoch) && epoch >= 0 && epoch <= v.epoch);
}
/** Crossing a pressure boundary starts fresh evidence. A cabin service detour
 * cannot certify the next excursion's return, even after save/reload. */
function procedure(s: Session): AirlockProcedure {
  const zone = outside(s) ? "exterior" : s.position.z > 7.7 ? "chamber" : "cabin";
  const previous = s.observations.airlockProcedure;
  if (!previous) return { version: 1, epoch: 0, zone,
    leg: missionForSession(s).objectives[s.objective]?.phase?.includes("EVA RETURN") ? "inbound" : "outbound",
    receipts: {}, legacy: true };
  if (zone === previous.zone) return { ...previous, receipts: { ...previous.receipts } };
  return { version: 1, epoch: previous.epoch + 1, zone,
    leg: previous.zone === "exterior" || zone === "cabin" ? "inbound" : "outbound",
    receipts: {}, legacy: false };
}
function airlockSafe(s: Session, action: AirlockAction): boolean {
  const a = s.airlock;
  switch (action) {
    case "openInner": return a.inner && !a.outer && a.pressure >= 100 && !a.cycling;
    case "closeInner": return !a.inner;
    case "vent": return !a.inner && !a.outer && (a.cycling === "vent" || a.pressure === 0);
    case "openOuter": return a.outer && !a.inner && a.pressure === 0 && !a.cycling;
    case "closeOuter": return !a.outer;
    case "pressurize": return !a.inner && !a.outer && (a.cycling === "pressurize" || a.pressure >= 101.3);
  }
}
export type Observations = {
  airlockProcedure?: AirlockProcedure;
  achieved: string[];
  visits: Site[];
  rest: number;
  exterior: boolean;
  vacuum: boolean;
  powerDiagnosed: boolean;
  campDiagnosed: boolean;
  transmitted: number;
  queuedScience: number;
  returnMinute: number;
  orbitMinute: number;
  pending: string[];
};
export const emptyObservations = (): Observations => ({
  achieved: [],
  visits: [],
  rest: 0,
  exterior: false,
  vacuum: false,
  powerDiagnosed: false,
  campDiagnosed: false,
  transmitted: 0,
  queuedScience: 0,
  returnMinute: -1,
  orbitMinute: -1,
  pending: [],
});
export function withObservations(s: Session): Session {
  return s.observations
    ? s
    : {
        ...s,
        observations: { ...emptyObservations(), achieved: [...s.completed] },
      };
}
function eventReady(s: Session, index: number) {
  const prior = missionForSession(s)
    .objectives.slice(0, index)
    .filter((o) => o.event)
    .at(-1);
  return (
    !prior ||
    (s.eventIds.includes(prior.id) &&
      (prior.event === "campPower"
        ? !s.camp.broken
        : prior.event === "power"
          ? !s.state.malfunction
          : s.state.communications))
  );
}
export function receipt(s: Session, action: CampaignAction): Session {
  s = withObservations(s);
  // Food and water may be prepared before an unrelated scripted warning.
  // Each successful operation still belongs to just one specific task.
  const provision = ["takeMeal", "fill", "eat", "drink"].includes(action);
  const m = missionForSession(s),
    obs = {
      ...s.observations,
      achieved: [...s.observations.achieved],
      pending: [...s.observations.pending],
      airlockProcedure: procedure(s),
    };
  const airlockAction = airlockActions.includes(action as AirlockAction);
  if (airlockAction) {
    obs.airlockProcedure.receipts[action as AirlockAction] = obs.airlockProcedure.epoch;
    obs.airlockProcedure.legacy = false;
  }
  // One operation satisfies one measurement/procedure, not every repeated measurement in the mission.
  const index = m.objectives.findIndex(
    (o, i) =>
      (!airlockAction || i === s.objective) &&
      !s.completed.includes(o.id) &&
      !obs.achieved.includes(o.id) &&
      !obs.pending.includes(o.id) &&
      (o.action === action || o.choices?.some((c) => c.action === action)) &&
      (!o.site || atSite(s, o.site)) &&
      (provision || eventReady(s, i)) &&
      (!o.phase?.includes("EVA RETURN") || obs.exterior) &&
      (!["science", "course"].includes(action) ||
        o.phase === "PRE-LAUNCH" ||
        s.flight.status === "orbit") &&
      (![
        "experiment",
        "sample",
        "scan",
        "photo",
        "drill",
        "measureTemperature",
        "measureRadiation",
      ].includes(action) ||
        outside(s)),
  );
  if (index >= 0) {
    const task = m.objectives[index];
    if (task.type === "TRANSMIT") {
      if (s.state.science > 0) obs.pending.push(task.id);
    } else obs.achieved.push(task.id);
  }
  return { ...s, observations: obs };
}
export function observe(s: Session): Session {
  s = withObservations(s);
  const obs = {
    ...s.observations,
    achieved: [...s.observations.achieved],
    visits: [...s.observations.visits],
    airlockProcedure: procedure(s),
  };
  obs.exterior ||= outside(s);
  obs.vacuum ||= s.airlock.pressure === 0;
  for (const o of missionForSession(s).objectives) {
    if (o.site && atSite(s, o.site) && !obs.visits.includes(o.site))
      obs.visits.push(o.site);
  }
  if (s.pendingTransmit > 0 && s.state.minutes >= s.pendingTransmit) {
    obs.achieved.push(...obs.pending);
    obs.pending = [];
    obs.transmitted = Math.max(obs.transmitted, obs.queuedScience);
  }
  const next = { ...s, observations: obs };
  return s.pendingTransmit > 0 && s.state.minutes >= s.pendingTransmit
    ? acknowledgeScientificResults(next) : next;
}
export function satisfied(s: Session, o: Objective): boolean {
  const obs = s.observations;
  if (o.type === "RETURN") return !!o.site && atSite(s, o.site);
  if (o.type === "GO_TO") return !!o.site && obs.visits.includes(o.site);
  if (o.type === "TRANSMIT")
    return (
      obs.achieved.includes(o.id) &&
      obs.transmitted > 0 &&
      obs.transmitted >= s.state.science
    );
  // Physical safety and this pressure-boundary crossing take precedence over
  // old achieved IDs. Legacy saves may contain receipts for a different sortie.
  if (o.action && airlockActions.includes(o.action as AirlockAction)) {
    const p = procedure(s), action = o.action as AirlockAction;
    return (!o.phase?.includes("EVA RETURN") || p.leg === "inbound") &&
      p.receipts[action] === p.epoch && airlockSafe(s, action);
  }
  if (o.type === "WAIT" && (o.condition === "vacuum" || o.condition === "pressurized")) {
    const p = procedure(s);
    const action = o.condition === "vacuum" ? "vent" : "pressurize";
    const evidence = p.receipts[action] === p.epoch || p.legacy;
    return evidence && !s.airlock.cycling && !s.airlock.outer &&
      (o.condition === "vacuum"
        ? !s.airlock.inner && s.airlock.pressure === 0
        : p.leg === "inbound" && s.airlock.pressure >= 101.3);
  }
  if (s.missionId === "mission-7" && s.revision >= 4 && o.action === "measureTemperature" &&
    !s.measurements?.some(r => r.action === "measureTemperature" && r.unit === "°C" && Number.isFinite(r.value))) return false;
  if (obs.achieved.includes(o.id) || s.completed.includes(o.id)) return true;
  // Provision actions are events, recorded for one objective by receipt().
  // Persistent nutrition, bottle contents or an earlier meal cannot certify a
  // later duty shift; early preparation still keeps its own task receipt.
  switch (o.action) {
    case "tools":
      return s.state.tools || s.pack.includes("repair");
    case "equipSuit":
      return s.suit.equipped;
    case "checkOxygen":
      return s.suit.oxygenChecked && s.suit.oxygen > 0;
    case "checkPower":
      return s.suit.powerChecked && s.suit.power > 0;
    case "sleep":
      return s.state.sleeping || obs.rest > 0;
    case "wake":
      return obs.rest > 0 && !s.state.sleeping;
  }
  if (o.event && s.eventIds.includes(o.id))
    return o.event === "campPower"
      ? !s.camp.broken
      : o.event === "power"
        ? !s.state.malfunction
        : s.state.communications;
  if (o.type === "WAIT") {
    if (o.condition === "countdown")
      return s.flight.countdown === 0 || s.flight.status !== "pad";
    if (o.condition === "staging") return s.flight.altitude >= 12;
    if (o.condition === "orbitHeight")
      return s.flight.altitude >= 180 && s.flight.velocity >= 7.8;
    if (o.phase?.includes("RECOVERY") || o.phase?.includes("TRANSFER")) {
      if (o.site === "sleep")
        return (
          obs.rest >= (o.value || 1) || (s.state.rested && s.state.energy >= 95)
        );
    }
    return s.state.minutes - s.objectiveStarted >= (o.value || 1);
  }
  return false;
}

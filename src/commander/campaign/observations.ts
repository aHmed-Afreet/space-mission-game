import type { Session } from "./engine";
import { atSite, outside } from "./engine";
import {
  missionById,
  type CampaignAction,
  type Objective,
  type Site,
} from "./definitions";
export type Observations = {
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
  const prior = missionById(s.missionId)
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
  const m = missionById(s.missionId),
    obs = {
      ...s.observations,
      achieved: [...s.observations.achieved],
      pending: [...s.observations.pending],
    };
  // One operation satisfies one measurement/procedure, not every repeated measurement in the mission.
  const index = m.objectives.findIndex(
    (o, i) =>
      !s.completed.includes(o.id) &&
      !obs.achieved.includes(o.id) &&
      !obs.pending.includes(o.id) &&
      (o.action === action || o.choices?.some((c) => c.action === action)) &&
      (!o.site || atSite(s, o.site)) &&
      eventReady(s, i) &&
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
  };
  obs.exterior ||= outside(s);
  obs.vacuum ||= s.airlock.pressure === 0;
  for (const o of missionById(s.missionId).objectives) {
    if (o.site && atSite(s, o.site) && !obs.visits.includes(o.site))
      obs.visits.push(o.site);
  }
  if (s.pendingTransmit > 0 && s.state.minutes >= s.pendingTransmit) {
    obs.achieved.push(...obs.pending);
    obs.pending = [];
    obs.transmitted = Math.max(obs.transmitted, obs.queuedScience);
  }
  return { ...s, observations: obs };
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
  if (obs.achieved.includes(o.id) || s.completed.includes(o.id)) return true;
  switch (o.action) {
    case "takeMeal":
      return s.state.meals > 0;
    case "fill":
      return s.state.bottle > 0;
    case "eat":
      return s.lastEat >= 0;
    case "drink":
      return s.lastDrink >= 0;
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
    if (o.condition === "vacuum") return obs.vacuum;
    if (o.condition === "pressurized")
      return obs.exterior && s.airlock.pressure >= 101.3 && !s.airlock.cycling;
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

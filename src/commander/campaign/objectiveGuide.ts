import { atSite, currentObjective, sitePosition, type Session } from "./engine";
import { missionById } from "./definitions";

/** Context-aware, player-facing instructions. No mission state is changed here. */
export type GuideStep = { text: string; done: boolean };
export type ObjectiveGuide = { steps: GuideStep[]; next: string };
export function objectiveGuide(s: Session): ObjectiveGuide {
  const o = currentObjective(s);
  if (!o) return { steps: [], next: "Review your mission report." };
  const mission = missionById(s.missionId);
  const here = !o.site || atSite(s, o.site);
  const steps: GuideStep[] = [];
  if (o.site) steps.push({
    text: `Reach ${sitePosition(o.site, mission.destination).name} using MAP and the movement controls.`,
    done: here,
  });
  if (s.state.paused) return {
    steps: [{ text: "Press Resume (▶) to enable mission controls.", done: false }, ...steps],
    next: "Resume the mission before operating any controls.",
  };
  if (s.state.sleeping && o.action !== "wake") return {
    steps: [{ text: "Wake up before operating equipment.", done: false }, ...steps],
    next: "Wake up to continue.",
  };
  if (o.choices?.some(choice => choice.action === "powerSafe")) {
    steps.push({
      text: "At Power & life support, choose one of the two operating plans below. No separate INTERACT press is required.",
      done: false,
    });
    steps.push({
      text: "Conserve power saves 0.10 kWh; high-resolution observation spends 0.16 kWh for extra science. An active bus failure blocks the high-power choice.",
      done: false,
    });
    return { steps, next: here ? "Tap one of the power-plan choices below." : "Go to Power & life support." };
  }
  if (o.event === "power" && o.choices) {
    steps.push({
      text: "Press Inspect power and diagnose faults at this station BEFORE choosing a repair method.",
      done: s.observations.powerDiagnosed,
    });
    steps.push({
      text: "Easy option: Bypass the failed branch (uses 0.12 kWh and costs 8 science points; no toolkit needed).",
      done: false,
    });
    steps.push({
      text: "Full repair: collect toolkit and a spare part at Equipment storage; open maintenance access, isolate Bus B, then select Isolate and repair the bus.",
      done: false,
    });
    if (s.state.battery < 0.12)
      steps.push({ text: "Battery too low for bypass. Recharge or use the full repair route.", done: false });
    return {
      steps,
      next: !here ? "Go to Power & life support." :
        !s.observations.powerDiagnosed ? "Tap Inspect power and diagnose faults below." :
          "Choose Bypass (easiest) or complete the full repair steps.",
    };
  }
  if (o.action === "returnBurn") {
    steps.push({
      text: "At Navigation, set Destination selector to Earth orbit / recovery.",
      done: s.world.target === "earth",
    });
    steps.push({
      text: "Switch Guarded manoeuvre arm to ON (not ISOLATED). Use the button below or the Navigation switch.",
      done: s.world.switches.maneuver,
    });
    steps.push({
      text: "Press Start the controlled return burn. Keep sufficient fuel and complete earlier mission tasks first.",
      done: false,
    });
    return {
      steps,
      next: !here ? "Go to Flight deck." :
        s.world.target !== "earth" ? "Set Earth orbit / recovery." :
          !s.world.switches.maneuver ? "Turn ON Guarded manoeuvre arm." :
            "Press Start the controlled return burn.",
    };
  }
  if (o.action === "approach" && s.missionId === "mission-2") {
    steps.push({ text: "Open the Satellite Rendezvous Computer from the button below.", done: false });
    steps.push({ text: "Run auto-guidance (or adjust bearing, closing speed and distance into the green corridor).", done: false });
    steps.push({ text: "Confirm approach. Resolve any fault message shown before trying again.", done: false });
    return { steps, next: here ? "Open the navigation computer." : "Go to Flight deck." };
  }
  if (o.choices?.length) {
    steps.push({
      text: "Choose one of the task options shown below. Each button explains the resource trade-off.",
      done: false,
    });
    return { steps, next: here ? "Select a task option." : "Reach the indicated location." };
  }
  if (o.type === "WAIT") {
    steps.push({ text: "Keep the simulation running while the required mission time passes. No INTERACT button is needed.", done: false });
    return { steps, next: "Let mission time advance." };
  }
  if (o.action === "eat" || o.action === "drink") {
    steps.push({ text: "Open INVENTORY, then use the carried food or water. Collect supplies from the galley if necessary.", done: false });
    return { steps, next: "Open INVENTORY." };
  }
  if (o.action === "wake") {
    steps.push({ text: "Tap Wake up in the rest panel.", done: false });
    return { steps, next: "Wake up." };
  }
  if (o.action) {
    steps.push({ text: "At the required station, tap the objective action below. You can also press INTERACT at its console to use the station menu.", done: false });
    if (o.action === "repair" || o.action === "eventReset")
      steps.push({ text: "Inspect the fault, gather a toolkit and parts, and follow the maintenance/isolation requirements before repair.", done: false });
    return { steps, next: here ? "Use the objective action below." : "Reach the required station using MAP." };
  }
  return { steps: steps.length ? steps : [{ text: o.instruction, done: false }], next: o.instruction };
}

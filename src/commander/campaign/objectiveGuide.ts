import { atSite, currentObjective, outside, satelliteRepairBlocker, sitePosition, type Session } from "./engine";
import { missionById, type Site } from "./definitions";
import { faultCatalog } from "./ship";
import { recoveryMission } from "./recovery";

/** Context-aware, player-facing instructions. No mission state is changed here. */
export type GuideStep = { text: string; done: boolean };
export type ObjectiveGuide = { steps: GuideStep[]; next: string; recoveryStation?: Site };

/** Shared, state-aware recovery instructions for all campaign missions. */
function systemRecoveryGuide(s: Session): ObjectiveGuide | null {
  const action = currentObjective(s)?.action;
  if (!action || !["approach","land","course","science","powerScience"].includes(action)) return null;
  const name = (site: Site) => sitePosition(site, missionById(s.missionId).destination).name;
  const live = s.world.faults.filter(f=>!f.verified);
  const navigation = ["approach","land","course"].includes(action);
  const fault = live.find(f=>
    (f.kind==="bus" && s.state.malfunction) ||
    (f.kind==="navigation" && navigation) ||
    (f.kind==="sensor" && ["science","powerScience"].includes(action)));
  if (fault) {
    const c=faultCatalog[fault.kind];
    const station:Site=c.system==="navigation"?"cockpit":c.system==="science"?"science":"power";
    const tools=s.state.tools || s.pack.includes("repair");
    const isolated=!s.world.switches[c.isolation];
    const steps:GuideStep[]=[
      {text:`Go to ${name(station)}, open station controls and diagnose ${c.name}.`,done:fault.diagnosed},
      {text:"At Power & life support open the Power maintenance panel.",done:s.world.lockers.maintenance},
      {text:`At ${name(station)}, set ${c.isolation} to ISOLATED before repair.`,done:isolated || fault.repaired},
      {text:"At Equipment storage open Repair cabinet and take the repair toolkit.",done:tools},
      {text:"Bring one spare part (initial missions include spares; stored spares can be collected from Repair cabinet).",done:s.state.parts>0 || fault.repaired},
      {text:`Return to ${name(station)} and press Replace failed hardware.`,done:fault.repaired},
      {text:`Turn ${c.isolation} back ON, then press Verify operation at ${name(station)}.`,done:fault.verified},
    ];
    const recoveryStation:Site=!fault.diagnosed?station:
      !s.world.lockers.maintenance?"power":
      !fault.repaired && !isolated?station:
      !fault.repaired && (!tools || s.state.parts<1)?"equipment":station;
    const next=!atSite(s,recoveryStation)?`Open MAP and go to ${name(recoveryStation)} for fault recovery.`:
      !fault.diagnosed?`Open station controls and press Diagnose for ${c.name}.`:
      !s.world.lockers.maintenance?"Open the Power maintenance panel.":
      !fault.repaired && !isolated?`Set ${c.isolation} to ISOLATED.`:
      !fault.repaired && (!tools || s.state.parts<1)?"Collect repair toolkit and a spare part.":
      !fault.repaired?"Press Replace failed hardware.":
      !s.world.switches[c.isolation]?`Turn ${c.isolation} back ON.`:"Press Verify operation.";
    return {steps,next,recoveryStation};
  }
  if (s.state.malfunction) {
    const steps:GuideStep[]=[
      {text:"At Power & life support open station controls and press Inspect power and diagnose faults.",done:s.observations.powerDiagnosed},
      {text:"After diagnosis choose Bypass diagnosed power fault (requires 0.12 kWh and costs 8 science points).",done:false},
      {text:"Alternatively, at Equipment storage take the repair toolkit and a spare part. At Power & life support open the maintenance panel, isolate Bus B, press Repair diagnosed power fault, and switch Bus B back ON.",done:false},
    ];
    const recoveryStation:Site=s.observations.powerDiagnosed && s.state.battery<0.12 &&
      !s.state.tools && !s.pack.includes("repair")?"equipment":"power";
    const next=!atSite(s,recoveryStation)?`Open MAP and go to ${name(recoveryStation)}.`:
      !s.observations.powerDiagnosed?"Press Inspect power and diagnose faults.":
      recoveryStation==="equipment"?"Open Repair cabinet and take toolkit.":
      s.state.battery>=0.12?"Press Bypass diagnosed power fault.":
      "Open maintenance panel, isolate Bus B, and repair the diagnosed fault.";
    return {steps,next,recoveryStation};
  }
  if (navigation && !s.world.switches.navigation) return {
    recoveryStation:"cockpit",steps:[{text:"At the Flight deck open station controls and turn Navigation computer ON.",done:false}],
    next:"Turn ON Navigation computer at the Flight deck."};
  if (["approach","land"].includes(action) && s.state.battery<0.1) return {
    recoveryStation:"power",steps:[{text:"At Power & life support turn Solar input ON, shed optional loads, and let battery recharge to 0.10 kWh.",done:false}],
    next:"Recharge the battery to at least 0.10 kWh."};
  if (["approach","land"].includes(action) && s.state.pressure<90) return {
    recoveryStation:"power",steps:[{text:"At Power & life support restore oxygen recycling and cabin cooling, repair any subsystem fault, then let cabin pressure recover to at least 90 kPa.",done:false}],
    next:"Restore cabin pressure to at least 90 kPa."};
  return null;
}
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
  const interruption = recoveryMission(s);
  if (interruption) return {
    steps: interruption.steps,
    next: interruption.next,
    recoveryStation: interruption.station,
  };
  const recovery = systemRecoveryGuide(s);
  if (recovery) return recovery;
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
  // All lunar landings use the same flight-deck checklist, not a generic
  // "press the action" hint. Show prerequisites before a failed attempt.
  if (o.action === "land") {
    const approached = mission.objectives.some(task =>
      task.action === "approach" &&
      (s.completed.includes(task.id) || s.observations.achieved.includes(task.id)));
    steps.push({
      text: "At Flight deck → Show station controls → NAVIGATION, turn Navigation computer ON.",
      done: s.world.switches.navigation,
    });
    steps.push({
      text: "In NAVIGATION, set Destination selector to Lunar approach (not Earth orbit / recovery).",
      done: s.world.target === "moon",
    });
    steps.push({
      text: "In NAVIGATION, switch Guarded manoeuvre arm to ON (not ISOLATED).",
      done: s.world.switches.maneuver,
    });
    steps.push({
      text: "Complete the lunar approach in orbit before landing.",
      done: s.flight.status === "orbit" && approached,
    });
    steps.push({
      text: "Keep at least 5 fuel units and healthy cabin power/pressure, then press Execute lunar landing.",
      done: s.state.fuel >= 5 && s.state.battery >= 0.1 &&
        s.state.pressure >= 90 && !s.state.malfunction,
    });
    return {
      steps,
      next: !here ? "Go to Flight deck using MAP." :
        !s.world.switches.navigation ? "Turn ON Navigation computer." :
        s.world.target !== "moon" ? "Set destination to Lunar approach." :
        !s.world.switches.maneuver ? "Turn ON Guarded manoeuvre arm." :
        s.flight.status !== "orbit" ? "Establish stable orbit before landing." :
        !approached ? "Complete the lunar approach objective first." :
        s.landed ? "Vehicle already landed; review mission progress." :
        s.state.fuel < 5 ? "Landing needs at least 5 fuel units." :
        "Press Execute lunar landing.",
    };
  }
  if (o.action === "approach" && s.missionId !== "mission-2") {
    steps.push({
      text: "Confirm the vehicle has reached a stable operational orbit.",
      done: s.flight.status === "orbit",
    });
    steps.push({
      text: "At Flight deck → NAVIGATION, keep the Navigation computer ON.",
      done: s.world.switches.navigation,
    });
    if (mission.surface) steps.push({
      text: "For the NEXT landing step, set Destination selector to Lunar approach and Guarded manoeuvre arm to ON. These are landing settings, not requirements for the braking action.",
      done: s.world.target === "moon" && s.world.switches.maneuver,
    });
    return {
      steps,
      next: !here ? "Go to Flight deck using MAP." :
        s.flight.status !== "orbit" ? "Establish stable orbit first." :
        !s.world.switches.navigation ? "Turn ON Navigation computer." :
        "Press the approach manoeuvre action. Before the later landing, configure the Lunar approach destination and manoeuvre arm.",
    };
  }
  if (o.action === "repairSatellite") {
    const atWorksite = outside(s) && atSite(s, "survey");
    steps.push({
      text: "Wear your EVA suit, return through the airlock, and stand beside the satellite service connector (MAP).",
      done: atWorksite && s.suit.equipped,
    });
    steps.push({
      text: "Inspect the satellite service panel first. If already diagnosed, this step is complete.",
      done: s.systems.satelliteDiagnosed,
    });
    steps.push({
      text: "Carry the Repair toolkit in your EVA pack. If missing, return inside to Equipment storage, open Repair cabinet and TAKE the toolkit.",
      done: s.pack.includes("repair"),
    });
    steps.push({
      text: "Carry one spare part. If missing, return inside and choose Take spare part at the Repair cabinet.",
      done: s.state.parts >= 1,
    });
    steps.push({
      text: "Keep at least 5% EVA suit battery. Then tap Replace satellite connector to complete the objective.",
      done: s.suit.power >= 0.05,
    });
    const blocker = satelliteRepairBlocker(s);
    return { steps, next: blocker ?? "Ready: tap Replace satellite connector." };
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

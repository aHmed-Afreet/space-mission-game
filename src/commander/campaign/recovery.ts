import { atSite, currentObjective, outside, sitePosition, type Session } from "./engine";
import { missionById, type CampaignAction, type Site } from "./definitions";
import { equipment, packMass, PACK_CAPACITY, type EquipmentId } from "./equipment";
import { equipmentLocker, lockers, faultCatalog } from "./ship";

/**
 * An independent, derived emergency checklist. It DOES NOT advance, replace, or
 * renumber mission objectives. Thus reloads and older saves retain their place.
 * When the problem is fixed, the checklist disappears without a manual skip.
 */
export type RecoveryStep = { text: string; done: boolean };
export type RecoveryMission = {
  id: string;
  title: string;
  cause: string;
  station?: Site;
  steps: RecoveryStep[];
  next: string;
  retry?: boolean;
};
const fieldGear: Partial<Record<CampaignAction, EquipmentId>> = {
  scan: "scanner", sample: "containers", drill: "drill", photo: "camera",
  measureRadiation: "radiation", measureTemperature: "sensor",
  experiment: "experiment", repairCamp: "repair",
  deployShelter: "shelter", deploySolar: "solar", deployBattery: "battery",
  deployAntenna: "antenna", deployStorage: "storage", deploySensor: "sensor",
};
const name = (s: Session, site: Site) =>
  sitePosition(site, missionById(s.missionId).destination).name;
function rescue(
  s: Session, id: string, title: string, cause: string, station: Site | undefined,
  steps: RecoveryStep[], next: string, retry = false,
): RecoveryMission {
  return { id, title, cause, station, steps, next, retry };
}
function fromStation(s: Session, site: Site, operation: string) {
  return atSite(s, site)
    ? operation
    : `Open MAP and go to ${name(s, site)}. ${outside(s) ? "Return through the airlock safely first." : ""}`;
}
const step = (text: string, done = false): RecoveryStep => ({ text, done });

export function recoveryMission(s: Session): RecoveryMission | null {
  const o = currentObjective(s);
  if (!o || s.report || s.state.ended) return null;
  // Never interrupt launch itself or objective-free roaming with field recovery.
  const action = o.action;
  if (!action) return null;

  const item = fieldGear[action];
  if (item && !s.pack.includes(item)) {
    const locker = equipmentLocker(item);
    const station = lockers[locker].area as Site;
    const available = s.world.stored.includes(item);
    const capacity = packMass([...s.pack, item]) <= PACK_CAPACITY;
    const label = equipment[item].name;
    if (!available) return rescue(s, "gear-unavailable-"+item,
      "Equipment unavailable — recovery required",
      `${label} is not carried and no spare is present aboard this flight.`,
      undefined, [
        step(`Required equipment: ${label}.`),
        step("There is no remaining stored copy. This flight cannot complete the field task as configured."),
        step("Save your progress and return to the campaign to review the flight or retry with the necessary equipment."),
      ], "Save & campaign, then prepare a new flight with the missing equipment.", true);
    return rescue(s, "gear-"+item,
      `Retrieve ${label}`,
      `Your current mission needs ${label} before the field operation can succeed.`,
      station, [
        step("If outside, return through the airlock and enter the spacecraft.", !outside(s)),
        step(`Use MAP to reach ${name(s, station)}.`, atSite(s, station)),
        step(`At the station, open ${lockers[locker].name} using INTERACT or station controls.`,
          s.world.lockers[locker]),
        ...(!capacity ? [step("Your backpack is full. Put an unneeded item back in its proper cabinet to make room.")] : []),
        step(`Press Take ${label}; check INVENTORY before leaving again.`,
          s.pack.includes(item)),
        step("Return to the original field location and continue the suspended objective."),
      ],
      fromStation(s, station, !capacity
        ? "Make backpack space by storing unused gear, then take the required item."
        : s.world.lockers[locker] ? `Press Take ${label} in station controls.`
          : `Open ${lockers[locker].name}, then press Take ${label}.`));
  }

  // Exterior tasks require a usable EVA suit. Avoid restarting the sortie.
  if (item && outside(s) && !s.suit.equipped)
    return rescue(s,"eva-suit","Restore EVA suit protection",
      "Field operations cannot proceed without an equipped EVA suit.",
      "equipment",[
        step("Return safely through the airlock into the spacecraft."),
        step("At Equipment Storage, open the EVA suit locker."),
        step("Equip the suit, verify oxygen and battery, then return outside."),
      ],fromStation(s,"equipment","Open the EVA suit locker and equip the suit."));
  if (item && outside(s) && s.suit.power < equipment[item].power)
    return rescue(s,"eva-battery","Restore EVA suit battery",
      "Suit power is insufficient for this equipment operation.","equipment",[
        step("Return to the spacecraft through the airlock."),
        step("Use the EVA suit locker and recharge or prepare a powered suit."),
        step("Confirm adequate suit power before returning to the field."),
      ],fromStation(s,"equipment","Inspect the EVA suit power before resuming."));

  // Physical faults require genuine isolation, replacement and verification.
  const activity = ["course","approach","land","returnBurn","science","powerScience","scan","comms","verifyRadio"];
  const active = s.world.faults.filter(f=>!f.verified);
  const systemFault = activity.includes(action) ? active.find(f=>
    (f.kind==="bus" && s.state.malfunction) ||
    (f.kind==="navigation" && ["course","approach","land","returnBurn"].includes(action)) ||
    (f.kind==="sensor" && ["science","powerScience","scan"].includes(action)) ||
    (f.kind==="comms" && ["comms","verifyRadio"].includes(action))
  ) : undefined;
  if (systemFault) {
    const c = faultCatalog[systemFault.kind], circuit = c.isolation;
    const station: Site = c.system==="navigation" ? "cockpit" :
      c.system==="science" ? "science" :
      c.system==="communications" ? "communications" : "power";
    const tools = s.state.tools || s.pack.includes("repair");
    const parts = s.state.parts > 0;
    const hasTools = tools || s.world.stored.includes("repair");
    const hasParts = parts || s.world.partsStored > 0;
    if (!hasTools || !hasParts)
      return rescue(s,"hardware-unavailable-"+systemFault.kind,
        "Hardware repair needs supplies",
        `The ${c.name} cannot be repaired with the current toolkit/spare inventory.`,
        "equipment",[
          step("Open MAP and go to Equipment Storage."),
          step("Open the Repair cabinet and check for a toolkit and spare part."),
          step("If the required supplies are unavailable, return to campaign and retry with a recoverable flight."),
        ],fromStation(s,"equipment","Check the Repair cabinet. If supplies are exhausted, return to campaign."),true);
    const stationToVisit: Site = !systemFault.diagnosed ? station :
      !tools || !parts ? "equipment" :
      !s.world.lockers.maintenance ? "power" : station;
    return rescue(s,"fault-"+systemFault.kind,`Repair ${c.name}`,
      "A real spacecraft fault blocks this operation; it must be diagnosed and verified first.",
      stationToVisit,[
        step(`At ${name(s,station)}, press Diagnose for ${c.name}.`,systemFault.diagnosed),
        step("At Equipment Storage, open Repair cabinet and take a toolkit and spare part.",tools && parts),
        step("At Power & life support, open the Power maintenance panel.",s.world.lockers.maintenance),
        step(`At ${name(s,station)}, isolate circuit ${circuit} before replacement.`,
          !s.world.switches[circuit] || systemFault.repaired),
        step(`At ${name(s,station)}, select Replace failed hardware.`,systemFault.repaired),
        step(`Turn ${circuit} back ON and select Verify operation.`,systemFault.verified),
      ],
      fromStation(s,stationToVisit,
        !systemFault.diagnosed ? `Press Diagnose for ${c.name}.` :
        !tools || !parts ? "Open Repair cabinet and take toolkit and spare part." :
        !s.world.lockers.maintenance ? "Open Power maintenance panel." :
        !systemFault.repaired ? `Isolate ${circuit}, then press Replace failed hardware.` :
        `Restore ${circuit} and press Verify operation.`));
  }
  const flightAction = ["course","approach","land","returnBurn"].includes(action);
  const navAction = ["approach","land","returnBurn"].includes(action);
  if (flightAction && !s.world.switches.navigation)
    return rescue(s,"navigation-switch","Restore Navigation computer",
      "Navigation is OFF, preventing the manoeuvre.","cockpit",[
        step("Go to Flight deck using MAP.",atSite(s,"cockpit")),
        step("Open NAVIGATION station controls and switch Navigation computer ON."),
      ],fromStation(s,"cockpit","Turn Navigation computer ON in station controls."));
  if (navAction && s.state.malfunction)
    return rescue(s,"bus-warning","Restore spacecraft power bus",
      "Power distribution is unstable. The planned manoeuvre cannot proceed.","power",[
        step("Go to Power & life support and inspect power to diagnose the warning.",s.observations.powerDiagnosed),
        step("After diagnosis choose Bypass diagnosed power fault if battery permits, or repair the circuit using maintenance access and spare parts."),
        step("Verify the warning is cleared before returning to Navigation."),
      ],fromStation(s,"power",s.observations.powerDiagnosed
        ? "Choose Bypass diagnosed power fault or complete the repair procedure."
        : "Select Inspect power and diagnose faults."));
  if (navAction && s.state.battery < .1)
    return rescue(s,"battery","Restore battery reserve",
      "Battery is below the minimum needed for the manoeuvre.","power",[
        step("Go to Power & life support."),
        step("Enable solar input, shed optional loads and let time pass until battery reaches 0.10 kWh."),
      ],fromStation(s,"power","Recharge the battery to at least 0.10 kWh."));
  if (navAction && s.state.pressure < 90)
    return rescue(s,"pressure","Restore cabin pressure",
      "Cabin pressure is below the safe manoeuvre threshold.","power",[
        step("Go to Power & life support and check oxygen recycling, cooling and active faults."),
        step("Restore cabin pressure above 90 kPa before retrying."),
      ],fromStation(s,"power","Restore oxygen and cooling, then allow pressure to recover."));
  // Select the destination first, then arm the manoeuvre: same order as
  // the working preflight console and existing lunar landing checklist.
  if (action==="land" && s.world.target!=="moon")
    return rescue(s,"destination-moon","Set lunar landing destination",
      "Navigation is targeting Earth, not the Moon.","cockpit",[
        step("Go to Flight deck and open NAVIGATION.",atSite(s,"cockpit")),
        step("In NAVIGATION set Destination selector to Lunar approach."),
        step("Then switch Guarded manoeuvre arm to ON before executing the landing."),
      ],atSite(s,"cockpit")?"Set destination to Lunar approach.":fromStation(s,"cockpit","Set destination to Lunar approach."));
  if (action==="returnBurn" && s.world.target!=="earth")
    return rescue(s,"destination-earth","Set Earth recovery destination",
      "The return manoeuvre requires an Earth orbit / recovery target.","cockpit",[
        step("Go to Flight deck and open NAVIGATION.",atSite(s,"cockpit")),
        step("Set Destination selector to Earth orbit / recovery."),
        step("Then switch Guarded manoeuvre arm to ON."),
      ],atSite(s,"cockpit")?"Set Earth orbit / recovery.":fromStation(s,"cockpit","Set Earth orbit / recovery."));
  if (["land","returnBurn"].includes(action) && !s.world.switches.maneuver)
    return rescue(s,"maneuver-arm","Arm guarded manoeuvre",
      "The guarded manoeuvre safety switch is OFF.","cockpit",[
        step("Go to Flight deck and open NAVIGATION controls.",atSite(s,"cockpit")),
        step("Turn ON Guarded manoeuvre arm."),
      ],fromStation(s,"cockpit","Turn ON Guarded manoeuvre arm."));
  if (["science","powerScience"].includes(action) && !s.world.switches.science)
    return rescue(s,"science-switch","Restore science circuit",
      "Science instruments are disconnected.","power",[
        step("Go to Power & life support and open station controls.",atSite(s,"power")),
        step("Switch Science circuit ON."),
      ],fromStation(s,"power","Turn Science circuit ON."));
  if (["comms","verifyRadio"].includes(action) && !s.world.switches.radio)
    return rescue(s,"radio-switch","Restore radio link",
      "The radio circuit is isolated.","communications",[
        step("Go to Communications and open station controls.",atSite(s,"communications")),
        step("Turn the Radio circuit ON."),
      ],fromStation(s,"communications","Switch Radio circuit ON."));

  if (action==="campTransmit" && s.camp.broken)
    return rescue(s,"camp-power","Repair research camp connector",
      "Research data cannot transmit while camp power is broken.","camp",[
        step("At the Research camp, inspect the connector to diagnose it.",s.observations.campDiagnosed),
        step("Bring one spare part from Equipment Storage."),
        step("At camp, select Repair diagnosed camp connector."),
      ],fromStation(s,"camp","Inspect the connector and repair it with a spare part."));
  if (["sample","drill"].includes(action) && s.samples.length >= 6)
    return rescue(s,"samples-full","Free sample storage",
      "All six sample slots are occupied.","camp",[
        step("Go to the research camp and deploy sample storage if available."),
        step("Store the collected samples, then return to the original field site."),
      ],fromStation(s,"camp","Open sample storage and store carried samples."));
  if (navAction && s.state.fuel < (action==="land"?5:2))
    return rescue(s,"fuel-unrecoverable","Insufficient fuel for manoeuvre",
      "The required fuel reserve is not available, and there is no in-flight refuelling.","cockpit",[
        step("Review fuel and completed objectives in the Mission tablet."),
        step("Save and return to campaign. Retry with a configuration that has adequate fuel."),
      ],"Return to campaign for a safe retry.",true);
  return null;
}

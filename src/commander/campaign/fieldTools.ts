import type { CampaignAction } from "./definitions";
import type { Session } from "./engine";
import { equipment, type EquipmentId } from "./equipment";

export const fieldGear: Partial<Record<CampaignAction, EquipmentId>> = {
  scan: "scanner", sample: "containers", drill: "drill", photo: "camera",
  measureRadiation: "radiation", measureTemperature: "sensor", experiment: "experiment",
  repairCamp: "repair", repairSatellite: "repair", deployShelter: "shelter",
  deploySolar: "solar", deployBattery: "battery", deployAntenna: "antenna",
  deployStorage: "storage", deploySensor: "sensor",
};
/** Explicit minimum remaining suit charge, in fractions of a full charge (0.1%).
 * This avoids accepting an action that itself exhausts a life-support reserve.
 * It is not an estimate of the charge needed to walk back to the spacecraft. */
export const FIELD_TOOL_POWER_RESERVE = 0.001;
export const suitPowerText = (charge: number) => `${(charge * 100).toFixed(3)}%`;
export type FieldToolUse = {
  item?: EquipmentId;
  condition: number;
  powerCost: number;
  reserve: number;
  requiredPower: number;
  problem: "missing" | "broken" | "power" | null;
  reason: string | null;
};
/** Shared by action execution, controls, guidance and recovery. Missing legacy
 * condition means nominal; a recorded zero always means broken. */
export function fieldToolUse(s: Session, action: CampaignAction): FieldToolUse | null {
  const item = fieldGear[action];
  if (!item && action !== "testSatellite") return null;
  const condition = item ? s.world.equipment[item] ?? 100 : 100;
  const nominal = action === "repairSatellite" ? 0.05
    : action === "testSatellite" ? 0.02 : equipment[item!].power;
  const powerCost = nominal * (1 + (100 - condition) / 100);
  const reserve = powerCost > 0 ? FIELD_TOOL_POWER_RESERVE : 0;
  const requiredPower = powerCost + reserve;
  const problem = item && !s.pack.includes(item) ? "missing"
    : item && condition <= 0 ? "broken"
    : s.suit.power < requiredPower ? "power" : null;
  const reason = problem === "missing" ? `Return inside and TAKE the ${equipment[item!].name.toLowerCase()} from its equipment cabinet.`
    : problem === "broken" ? `${equipment[item!].name} is broken (0% condition). Return safely and finish or end this flight, then use paid Equipment service at the campaign before a new launch.`
    : problem === "power" ? `${action === "repairSatellite" && s.suit.power < 0.05 ? "Suit battery below 5%. " : ""}Suit battery needs ${suitPowerText(requiredPower)}: this operation uses ${suitPowerText(powerCost)} plus an explicit ${suitPowerText(reserve)} remaining reserve. Return inside and recharge before retrying.`
    : null;
  return { item, condition, powerCost, reserve, requiredPower, problem, reason };
}
export function fieldToolCostText(use: FieldToolUse): string {
  return `Suit charge: ${suitPowerText(use.powerCost)} cost${use.reserve ? `; keep ${suitPowerText(use.reserve)} reserve` : ""}. Tool condition ${use.condition.toFixed(2)}%.`;
}

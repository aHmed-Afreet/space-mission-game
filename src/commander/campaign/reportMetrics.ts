import { equipment } from "./equipment";
import type { Session } from "./engine";
import { categories, equipmentServiceCost, type Condition, type Fault, type ShipState } from "./ship";

export type ConditionSnapshot = {
  version: 1;
  components: Condition;
  equipment: ShipState["equipment"];
  unresolvedFaults: Fault[];
  powerWarning: boolean;
  campConnectorBroken: boolean;
  componentMean: number;
  equipmentMean: number | null;
  faultPenalty: number;
  estimatedComponentService: number;
  estimatedEquipmentService: number;
};
const mean = (values: number[]) => values.reduce((sum, n) => sum + n, 0) / values.length;
/** Version 2: physical component mean; minus 5 points per unresolved fault,
 * power warning and broken camp connector. Equipment is disclosed separately,
 * so stowing a worn suit cannot improve the spacecraft's condition score.
 * Costs are the existing paid service prices, estimates only, never charges. */
export function conditionMetrics(s: Session): { condition: number; snapshot: ConditionSnapshot } {
  const components = { ...s.world.condition };
  const gear = Object.fromEntries(s.selectedGear.map(id => [id, s.world.equipment[id] ?? 100]));
  if (s.selectedGear.includes("suit") && s.suit.equipped) gear.suit = s.suit.condition;
  const unresolvedFaults = s.world.faults.filter(f => !f.verified).map(f => ({ ...f }));
  const componentMean = mean(categories.map(id => components[id]));
  const equipmentValues = Object.values(gear);
  const faultPenalty = 5 * (unresolvedFaults.length + Number(s.state.malfunction) + Number(s.camp.broken));
  return {
    condition: Math.max(0, Math.min(100, componentMean - faultPenalty)),
    snapshot: {
      version: 1, components, equipment: gear, unresolvedFaults,
      powerWarning: s.state.malfunction, campConnectorBroken: s.camp.broken,
      componentMean, equipmentMean: equipmentValues.length ? mean(equipmentValues) : null,
      faultPenalty,
      estimatedComponentService: categories.reduce((sum, id) => sum + Math.round((100 - components[id]) * 4) / 100, 0),
      estimatedEquipmentService: equipmentValues.reduce((sum, value) => sum + equipmentServiceCost(value), 0),
    },
  };
}
export function validConditionSnapshot(value: unknown): value is ConditionSnapshot {
  if (!value || typeof value !== "object") return false;
  const v = value as ConditionSnapshot;
  const number = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0;
  const percent = (n: unknown) => number(n) && (n as number) <= 100;
  return v.version === 1 && !!v.components && categories.every(id => percent(v.components[id])) &&
    !!v.equipment && !Array.isArray(v.equipment) && Object.entries(v.equipment).every(([id, value]) => id in equipment && percent(value)) &&
    Array.isArray(v.unresolvedFaults) && v.unresolvedFaults.every(f =>
      !!f && typeof f.id === "string" && ["bus", "solar", "comms", "cooling", "oxygen", "water", "sensor", "navigation"].includes(f.kind) &&
      typeof f.diagnosed === "boolean" && typeof f.repaired === "boolean" && f.verified === false && number(f.at)) &&
    typeof v.powerWarning === "boolean" && typeof v.campConnectorBroken === "boolean" &&
    percent(v.componentMean) && (v.equipmentMean === null || percent(v.equipmentMean)) &&
    number(v.faultPenalty) && number(v.estimatedComponentService) && number(v.estimatedEquipmentService);
}

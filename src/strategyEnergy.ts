import {BUDGET, components, resources, rockets, clamp, zero, outcome, type Design, type Delta, type Choice, type MissionEvent} from './game';

/** Fictional planning hardware, not a validated Mars flight model. Legacy
 * game.ts calculations remain unchanged for Commander and old saved reports. */
export const STRATEGY_MODEL_VERSION = 2 as const;
export const strategyEnergyAssumptions = {
  operatingHours: 2, nominalHours: 1, eventHours: 1 / 3,
  busGenerationW: 40, housekeepingW: 20,
  batteryWh: 140, batteryDischargeW: 35, batteryChargeW: 35,
  solarFluxWm2: 590, arrayAreaM2: 0.6, arrayEfficiency: 0.3,
  arrayPointingFactor: 85 / (590 * 0.6 * 0.3), arrayW: 85,
};
export const strategyComponents = components.map(component => component.id === 'battery'
  ? {...component, power: 0, description: 'Stores 140 Wh; discharges at up to 35 W. Finite energy keeps buffered observations powered in safe mode.'}
  : component.id === 'solar'
    ? {...component, description: '85 W under the stated reference sunlight, cell efficiency and pointing assumptions. No output is banked without a battery.'}
    : component);
export type StrategyEnergy = {
  version: typeof STRATEGY_MODEL_VERSION; elapsedHours: number; chargeWh: number;
  generatedWh: number; consumedWh: number; spilledWh: number; unservedWh: number;
};
export function initialStrategyEnergy(design: Design): StrategyEnergy {
  return {version: STRATEGY_MODEL_VERSION, elapsedHours: 0,
    chargeWh: (design.counts.battery || 0) * strategyEnergyAssumptions.batteryWh,
    generatedWh: 0, consumedWh: 0, spilledWh: 0, unservedWh: 0};
}
export function strategyPower(design: Design, delta: Delta = zero) {
  const generationW = strategyEnergyAssumptions.busGenerationW + (design.counts.solar || 0) * strategyEnergyAssumptions.arrayW;
  // Positive event power is an explicit load reduction; negative is extra load.
  const payloadW = components.reduce((sum, c) => sum + Math.max(0, -c.power) * (design.counts[c.id] || 0), 0);
  const loadW = Math.max(strategyEnergyAssumptions.housekeepingW, strategyEnergyAssumptions.housekeepingW + payloadW - delta.power);
  return {generationW, loadW, netW: generationW - loadW,
    capacityWh: (design.counts.battery || 0) * strategyEnergyAssumptions.batteryWh,
    dischargeLimitW: (design.counts.battery || 0) * strategyEnergyAssumptions.batteryDischargeW};
}
export function advanceStrategyEnergy(design: Design, delta: Delta, state: StrategyEnergy, hours: number): StrategyEnergy {
  const power = strategyPower(design, delta);
  const surplusWh = Math.max(0, power.netW * hours);
  const deficitWh = Math.max(0, -power.netW * hours);
  const chargedWh = Math.min(surplusWh, Math.max(0, power.capacityWh - state.chargeWh),
    (design.counts.battery || 0) * strategyEnergyAssumptions.batteryChargeW * hours);
  const dischargedWh = Math.min(deficitWh, state.chargeWh, power.dischargeLimitW * hours);
  return {version: STRATEGY_MODEL_VERSION, elapsedHours: state.elapsedHours + hours,
    chargeWh: state.chargeWh + chargedWh - dischargedWh,
    generatedWh: state.generatedWh + power.generationW * hours,
    consumedWh: state.consumedWh + power.loadW * hours,
    spilledWh: state.spilledWh + surplusWh - chargedWh,
    unservedWh: state.unservedWh + deficitWh - dischargedWh};
}
export function launchStrategyEnergy(design: Design) {
  return advanceStrategyEnergy(design, zero, initialStrategyEnergy(design), strategyEnergyAssumptions.nominalHours);
}
export function strategyResources(design: Design, delta: Delta = zero, energy = initialStrategyEnergy(design), hours = strategyEnergyAssumptions.eventHours) {
  const legacy = resources(design, delta), power = strategyPower(design, delta);
  // Dispatchable reserve is limited both by the battery rating and its remaining
  // energy over this operating interval. It is never called generated power.
  const batteryW = Math.min(power.dischargeLimitW, energy.chargeWh / hours);
  return {...legacy, power: power.netW + batteryW, ...power, chargeWh: energy.chargeWh};
}
export function strategyEnergyIssues(design: Design, delta: Delta = zero, energy?: StrategyEnergy) {
  if (energy) return energy.unservedWh > 1e-8 ? [`Electrical demand exceeded available generation/storage by ${energy.unservedWh.toFixed(1)} Wh.`] : [];
  const initial = initialStrategyEnergy(design);
  const projection = advanceStrategyEnergy(design, delta, initial, strategyEnergyAssumptions.operatingHours);
  const reserve = strategyResources(design, delta, initial, strategyEnergyAssumptions.operatingHours).power;
  return [projection.unservedWh > 1e-8 ? 'The 2-hour operating plan runs out of electrical energy.' : '',
    reserve < 10 ? 'At least 10 W dispatchable reserve is required over the 2-hour operating plan.' : ''].filter(Boolean);
}
export function strategyErrors(design: Design, budgetCap = BUDGET) {
  const r = strategyResources(design);
  return [r.cost > budgetCap ? `Total cost exceeds the $${budgetCap}M budget.` : '',
    r.mass > rockets[design.rocket].payload ? 'Spacecraft exceeds the selected rocket’s payload limit.' : '',
    r.fuel < 10 ? 'At least 10 fuel units must remain after transfer.' : '',
    !design.counts.spectrometer ? 'Add a water spectrometer to search for water.' : '',
    !design.counts.antenna ? 'Add a deep-space antenna to send results home.' : '', ...strategyEnergyIssues(design)].filter(Boolean);
}
export function strategyOutcome(choice: Choice, event: MissionEvent, design: Design, energy?: StrategyEnergy): Delta {
  const impact = outcome(choice, event, design);
  // A battery supplies a real deficit; it cannot make the event's load vanish.
  if (event.id === 'power' && choice.delta.power < 0) impact.power = choice.delta.power;
  if (event.id === 'solar' && choice.delta.science < 0 && energy && energy.chargeWh <= 0) impact.science = choice.delta.science;
  return impact;
}
export function strategyChoiceEnabled(choice: Choice, design: Design, delta: Delta, energy: StrategyEnergy) {
  const r = strategyResources(design, delta, energy);
  return !choice.need || r[choice.need] >= (choice.amount || 0);
}
export function strategyChoiceDescription(choice: Choice, event: MissionEvent) {
  if (event.id === 'power') return choice.delta.power < 0
    ? 'Extra load +15 W for this and later windows • science +5 • batteries supply the deficit until depleted'
    : 'Reduce payload load by 12 W for this and later windows • science −10 • reliability index +4';
  if (event.id === 'comms' && choice.delta.power < 0) return 'Extra load +8 W for this and later windows • communication +18 • cost +$4M';
  return choice.description.replace(/reliability/g, 'reliability index');
}
export function strategyReport(design: Design, delta: Delta, energy?: StrategyEnergy) {
  const r = strategyResources(design, delta, energy);
  const science = clamp(r.science), budget = clamp(100 - Math.max(0, r.cost - 160) * 1.4);
  const reliability = clamp(r.reliability - (strategyEnergyIssues(design, delta, energy).length ? 25 : 0) - (r.fuel < 0 ? 25 : 0));
  const fuel = clamp(60 + r.fuel * .8), communication = clamp(r.communication);
  const score = Math.round(science * .3 + budget * .15 + reliability * .3 + fuel * .1 + communication * .15);
  return {modelVersion: STRATEGY_MODEL_VERSION, score, science, budget, reliability, fuel, communication, r};
}

export function strategyDecisionLog(event: MissionEvent, choice: Choice, impact: Delta) {
  const changes = Object.entries(impact).filter(([, value]) => value !== 0).map(([key, value]) => {
    const signed = key === 'fuel' ? -value : value;
    return `${key === 'power' ? 'load W' : key === 'reliability' ? 'reliability index' : key} ${key === 'power' ? -signed : signed > 0 ? '+' + signed : signed}`;
  }).join(', ');
  return `${event.title}: ${choice.name}. ${changes}.`;
}

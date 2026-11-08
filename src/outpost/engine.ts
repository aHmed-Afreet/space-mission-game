/**
 * Junior Astronaut Outpost — educational trade-off model.
 * Percentages, credits, "sols" and resource quantities are game units.
 * They are NOT certified lunar/Martian life-support engineering rates.
 * Pure immutable transitions make simulations reproducible and testable.
 */
export type Destination = "moon" | "mars";
export type Priority = "crew" | "balanced" | "crops";
export type Action = "monitor" | "shield" | "solar" | "recycler" | "greenhouse" | "harvest" | "repair" | "supplies" | "rest";
export type Phase = "active" | "won" | "lost";
export type ResourceKey = "oxygen" | "water" | "food" | "battery" | "safety" | "radiation" | "crop";
export type Outpost = {
  version: 1; destination: Destination; sol: number; phase: Phase;
  oxygen: number; water: number; food: number; battery: number;
  safety: number; radiation: number; crop: number; foodProduced: number;
  credits: number; integrity: number; shielding: number; solar: number;
  recycling: number; greenhouses: number; priority: Priority;
  selected: Action | null; log: string[]; lastReport: string[];
};
export const MISSION_LENGTH = 10;
export const GAME_KEY = "orbital-junior-outpost-v1";
const clamp = (x: number, max = 100) => Math.max(0, Math.min(max, Math.round(x * 10) / 10));
export const WORLD: Record<Destination, { label: string; subtitle: string; difficulty: string }> = {
  moon: { label: "Lunar Research Outpost", subtitle: "A research habitat on the Moon", difficulty: "Beginner" },
  mars: { label: "Martian Science Outpost", subtitle: "A research habitat on Mars", difficulty: "Advanced" },
};
export function initialOutpost(destination: Destination): Outpost {
  return { version: 1, destination, sol: 1, phase: "active",
    oxygen: 74, water: 78, food: 65, battery: destination === "moon" ? 76 : 85,
    safety: 94, radiation: 0, crop: 8, foodProduced: 0,
    credits: 105, integrity: 92, shielding: 1, solar: 2,
    recycling: 1, greenhouses: 1, priority: "balanced", selected: null,
    log: ["Mission Control: Ten days to demonstrate a sustainable research outpost."],
    lastReport: ["Outpost commissioned. Check the next environmental forecast."] };
}
export type Forecast = {
  title: string; detail: string; sunlight: number; radiation: number;
  extraDemand: number; dust: boolean; storm: boolean;
};
export function forecast(destination: Destination, sol: number): Forecast {
  if (destination === "moon") {
    if (sol === 5 || sol === 6) return { title: "Lunar night", detail: "Solar arrays make no electricity. Rely on stored battery energy and prioritize essentials.", sunlight: 0, radiation: 6, extraDemand: 8, dust: false, storm: false };
    if (sol === 3 || sol === 9) return { title: "Solar particle event", detail: "Radiation rises. Additional shielding protects the crew but uses the outpost budget.", sunlight: 0.9, radiation: 17, extraDemand: 0, dust: false, storm: true };
    return { title: "Sunlit lunar operations", detail: "Strong sunlight supports life support and the greenhouse. Prepare reserves before lunar night.", sunlight: 1, radiation: 7, extraDemand: 0, dust: false, storm: false };
  }
  if (sol === 4 || sol === 5 || sol === 8) return { title: "Martian dust storm", detail: "Dust reduces sunlight reaching the arrays. Battery reserves matter.", sunlight: 0.2, radiation: 7, extraDemand: 4, dust: true, storm: false };
  if (sol === 3 || sol === 9) return { title: "Radiation warning", detail: "Check your shield rating before the crew's surface operations.", sunlight: 0.7, radiation: 16, extraDemand: 0, dust: false, storm: true };
  return { title: "Martian field operations", detail: "Mars receives less sunlight than Earth; careful electrical planning is essential.", sunlight: 0.68, radiation: 9, extraDemand: 0, dust: false, storm: false };
}
export const ACTIONS: { id: Action; title: string; description: string; cost: number; note: string }[] = [
  { id: "monitor", title: "Monitor systems", description: "Observe resource changes without spending credits.", cost: 0, note: "No immediate changes" },
  { id: "shield", title: "Reinforce radiation shelter", description: "Build water-lined shielding to lower future exposure.", cost: 22, note: "Shield +1 · Lower radiation dose" },
  { id: "solar", title: "Expand solar arrays", description: "Increase future daytime electricity generation.", cost: 20, note: "Solar array +1 · Higher power production" },
  { id: "recycler", title: "Upgrade air & water recycling", description: "Recover more oxygen and water each day, but consume more power.", cost: 23, note: "Recycler +1 · Higher air/water recovery" },
  { id: "greenhouse", title: "Expand greenhouse", description: "Grow more food, at the cost of energy and water.", cost: 20, note: "Greenhouse +1 · Faster crop growth" },
  { id: "harvest", title: "Harvest food crops", description: "Turn grown crops into food for the crew.", cost: 0, note: "10 crop points → +22 food · Food produced +22" },
  { id: "repair", title: "Repair habitat hardware", description: "Restore equipment integrity using spare parts.", cost: 15, note: "Integrity +30" },
  { id: "supplies", title: "Unpack emergency supplies", description: "Use limited stored cargo to recover water, air and food.", cost: 24, note: "Oxygen +18 · Water +18 · Food +12" },
  { id: "rest", title: "Crew safety & recovery", description: "Rest and run emergency drills to improve crew readiness.", cost: 9, note: "Crew safety +8" },
];
export function availableAction(state: Outpost, action: Action): { ok: boolean; reason?: string } {
  if (state.phase !== "active") return { ok: false, reason: "This mission has ended." };
  if (state.selected) return { ok: false, reason: "Already performed one operation this sol." };
  const item = ACTIONS.find(a => a.id === action);
  if (!item) return { ok: false, reason: "Unknown operation." };
  if (state.credits < item.cost) return { ok: false, reason: "Insufficient mission credits." };
  if (action === "harvest" && state.crop < 10) return { ok: false, reason: "At least 10 grown crop points are needed." };
  if (action === "shield" && state.shielding >= 4) return { ok: false, reason: "Shelter is already fully reinforced." };
  if (action === "solar" && state.solar >= 5) return { ok: false, reason: "Array capacity limit reached." };
  if (action === "recycler" && state.recycling >= 3) return { ok: false, reason: "Recycler is at maximum capacity." };
  if (action === "greenhouse" && state.greenhouses >= 3) return { ok: false, reason: "Greenhouse is at maximum capacity." };
  return { ok: true };
}
export function setPriority(state: Outpost, priority: Priority): Outpost {
  if (state.phase !== "active") return state;
  if (priority !== "crew" && priority !== "balanced" && priority !== "crops") return state;
  return { ...state, priority };
}
export function perform(state: Outpost, action: Action): Outpost {
  if (!availableAction(state, action).ok) return state;
  const item = ACTIONS.find(a => a.id === action)!;
  const n: Outpost = { ...state, credits: state.credits - item.cost, selected: action, log: [...state.log] };
  switch (action) {
    case "shield": n.shielding++; break;
    case "solar": n.solar++; break;
    case "recycler": n.recycling++; break;
    case "greenhouse": n.greenhouses++; break;
    case "harvest": n.crop -= 10; n.food = clamp(n.food + 22); n.foodProduced += 22; break;
    case "repair": n.integrity = clamp(n.integrity + 30); break;
    case "supplies": n.oxygen = clamp(n.oxygen + 18); n.water = clamp(n.water + 18); n.food = clamp(n.food + 12); break;
    case "rest": n.safety = clamp(n.safety + 8); break;
    case "monitor": break;
  }
  n.log.push("Sol " + n.sol + " decision: " + item.title + ".");
  return n;
}
export type Projection = { generation: number; demand: number; projectedBattery: number; supply: Forecast; note: string };
export function projectPower(s: Outpost): Projection {
  const supply = forecast(s.destination, s.sol);
  const generation = Math.round(s.solar * 15 * supply.sunlight);
  const cropPower = s.priority === "crew" ? 0 : s.greenhouses * (s.priority === "crops" ? 7 : 5);
  const recyclePower = s.recycling * 4;
  const demand = 16 + supply.extraDemand + cropPower + recyclePower;
  return { generation, demand, supply,
    projectedBattery: clamp(s.battery + generation - demand),
    note: generation >= demand ? "Solar generation meets today's demand." : "The outpost must draw energy from its battery." };
}
export function advanceSol(s: Outpost): Outpost {
  if (s.phase !== "active" || !s.selected) return s;
  const n: Outpost = { ...s, log: [...s.log], lastReport: [] };
  const p = projectPower(s);
  const supplied = s.battery + p.generation;
  const shortage = Math.max(0, p.demand - supplied);
  n.battery = clamp(supplied - p.demand);
  n.oxygen = clamp(s.oxygen - 6 + s.recycling * (shortage > 0 ? 1 : 3));
  n.water = clamp(s.water - 6 + s.recycling * (shortage > 0 ? 1 : 3) -
    (s.priority === "crops" ? 3 : s.priority === "balanced" ? 1 : 0));
  n.food = clamp(s.food - (s.priority === "crew" ? 4 : 5));
  const growth = shortage > 0 || s.integrity < 30 ? 0 : s.priority === "crew" ? 0 : s.greenhouses * (s.priority === "crops" ? 5 : 3);
  n.crop = clamp(s.crop + growth, 100);
  const dose = p.supply.radiation / (1 + s.shielding * 0.8);
  n.radiation = clamp(s.radiation + dose, 200);
  n.integrity = clamp(s.integrity - (p.supply.dust ? 7 : p.supply.storm ? 5 : 2));
  n.lastReport.push("Power: solar +" + p.generation + ", systems −" + p.demand + " · battery " + n.battery + "%.");
  n.lastReport.push("Life support: O₂ " + n.oxygen + " · water " + n.water + " · food " + n.food + ".");
  n.lastReport.push("Crop growth +" + growth + ", radiation exposure +" + dose.toFixed(1) + " index points.");
  if (shortage > 0) {
    n.safety = clamp(n.safety - 10);
    n.lastReport.push("POWER SHORTAGE: oxygen/water recovery was reduced. Crew safety −10.");
  }
  if (n.oxygen <= 0 || n.water <= 0 || n.food <= 0) {
    n.safety = clamp(n.safety - 25);
    n.lastReport.push("CRITICAL: a life-support resource ran out.");
  }
  if (n.radiation >= 58) {
    n.safety = clamp(n.safety - 7);
    n.lastReport.push("WARNING: cumulative simulated radiation index is high.");
  }
  if (n.integrity < 30) {
    n.safety = clamp(n.safety - 6);
    n.lastReport.push("WARNING: degraded habitat hardware threatens safety.");
  }
  n.log.push("Sol " + s.sol + ": " + p.supply.title + ". " + n.lastReport.join(" "));
  n.log = n.log.slice(-35);
  n.sol = s.sol + 1;
  n.selected = null;
  if (n.safety < 35 || n.oxygen <= 0 || n.water <= 0 || n.food <= 0) {
    n.phase = "lost"; n.lastReport.push("MISSION ENDED: crew resources or safety fell below the safe game threshold.");
  } else if (s.sol >= MISSION_LENGTH) {
    const ready = missionCriteria(n);
    n.phase = ready.every(x => x.met) ? "won" : "lost";
    n.lastReport.push(n.phase === "won"
      ? "MISSION SUCCESS: the crew completed its ten-sol outpost demonstration."
      : "MISSION REVIEW: the full sustainability targets were not met.");
  }
  return n;
}
export function missionCriteria(s: Outpost): { title: string; met: boolean }[] {
  return [
    { title: "Complete ten outpost sols", met: s.sol > MISSION_LENGTH },
    { title: "Protect crew safety (60+)", met: s.safety >= 60 },
    { title: "Keep oxygen, water and food above zero", met: s.oxygen > 0 && s.water > 0 && s.food > 0 },
    { title: "Keep radiation index below 75", met: s.radiation < 75 },
    { title: "Install level 2 radiation shielding", met: s.shielding >= 2 },
    { title: "Produce at least 22 food units", met: s.foodProduced >= 22 },
  ];
}
export function missionScore(s: Outpost): number {
  const criteria = missionCriteria(s).filter(x => x.met).length;
  return Math.max(0, Math.min(100, Math.round(criteria * 10 + s.safety * .25 + (100 - Math.min(100, s.radiation)) * .15)));
}
/** Reject corrupted/legacy or improperly shaped browser saves instead of crashing. */
export function isValidOutpost(v: unknown): v is Outpost {
  if (!v || typeof v !== "object") return false;
  const s = v as Partial<Outpost>;
  if (s.version !== 1 || (s.destination !== "moon" && s.destination !== "mars") ||
      !["active", "won", "lost"].includes(s.phase ?? "") ||
      !["crew", "balanced", "crops"].includes(s.priority ?? "") ||
      !(s.selected === null || ACTIONS.some(a => a.id === s.selected))) return false;
  if (!Array.isArray(s.log) || !Array.isArray(s.lastReport) ||
      s.log.some(x => typeof x !== "string") || s.lastReport.some(x => typeof x !== "string")) return false;
  return (["sol","oxygen","water","food","battery","safety","radiation","crop","foodProduced",
    "credits","integrity","shielding","solar","recycling","greenhouses"] as const)
    .every(k => typeof s[k] === "number" && Number.isFinite(s[k]) && (s[k] as number) >= 0);
}

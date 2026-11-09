/**
 * Junior Astronaut Outpost — educational trade-off model.
 * Percentages, credits, "sols" and resource quantities are game units.
 * They are NOT certified lunar/Martian life-support engineering rates.
 * Pure immutable transitions make simulations reproducible and testable.
 */
export type Destination = "moon" | "mars";
export type Priority = "crew" | "balanced" | "crops";
export type Action = "monitor" | "shield" | "solar" | "recycler" | "greenhouse" | "harvest" | "repair" | "supplies" | "rest" | "plant" | "battery";
export type CropType = "lettuce" | "potato" | "algae";
export type IncidentChoice = "shelter" | "expedition" | "conserve" | "normal" | "sweep" | "seal" | "patch" | "isolate";
export type Phase = "active" | "won" | "lost";
export type ResourceKey = "oxygen" | "water" | "food" | "battery" | "safety" | "radiation" | "crop";
export type Outpost = {
  version: 2; destination: Destination; sol: number; phase: Phase;
  oxygen: number; water: number; food: number; battery: number;
  safety: number; radiation: number; crop: number; foodProduced: number;
  credits: number; integrity: number; shielding: number; solar: number;
  recycling: number; greenhouses: number; priority: Priority;
  selected: Action | null; log: string[]; lastReport: string[];
  cropType: CropType; plannedCrop: CropType; incidentSol: number; incidentChoice: IncidentChoice | null;
};
export const MISSION_LENGTH = 10;
export const GAME_KEY = "orbital-junior-outpost-v2";
export const LEGACY_GAME_KEY = "orbital-junior-outpost-v1";
export const CROPS: Record<CropType,{label:string;growth:number;water:number;power:number;harvest:number;description:string}> = {
  lettuce:{label:"Leafy greens",growth:3,water:1,power:0,harvest:22,description:"Steady, lower-energy crop suited for reliable harvests."},
  potato:{label:"Potatoes",growth:4,water:3,power:1,harvest:30,description:"High food yield but thirsty under artificial lighting."},
  algae:{label:"Edible algae",growth:5,water:1,power:4,harvest:18,description:"Fast growth and modest water use, but energy-intensive."},
};
const clamp = (x: number, max = 100) => Math.max(0, Math.min(max, Math.round(x * 10) / 10));
export const WORLD: Record<Destination, { label: string; subtitle: string; difficulty: string }> = {
  moon: { label: "Lunar Research Outpost", subtitle: "A research habitat on the Moon", difficulty: "Beginner" },
  mars: { label: "Martian Science Outpost", subtitle: "A research habitat on Mars", difficulty: "Advanced" },
};
export function initialOutpost(destination: Destination): Outpost {
  return { version: 2, destination, sol: 1, phase: "active",
    oxygen: 74, water: 78, food: 65, battery: destination === "moon" ? 76 : 85,
    safety: 94, radiation: 0, crop: 8, foodProduced: 0,
    credits: 105, integrity: 92, shielding: 1, solar: 2,
    recycling: 1, greenhouses: 1, priority: "balanced", selected: null,
    cropType: "lettuce", plannedCrop: "lettuce", incidentSol: 0, incidentChoice: null,
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
  { id: "battery", title: "Prepare backup battery cells", description: "Install stored energy modules to prepare for an eclipse or storm.", cost: 14, note: "Battery +24" },
  { id: "plant", title: "Change greenhouse crop", description: "Reseed the greenhouse with the selected crop variety, resetting current growth.", cost: 9, note: "Replace current plants · Growth resets to 3" },
];
export function availableAction(state: Outpost, action: Action): { ok: boolean; reason?: string } {
  if (state.phase !== "active") return { ok: false, reason: "This mission has ended." };
  if (state.selected) return { ok: false, reason: "Already performed one operation this sol." };
  const item = ACTIONS.find(a => a.id === action);
  if (!item) return { ok: false, reason: "Unknown operation." };
  const incidentReserved = state.incidentSol===state.sol ? (state.incidentChoice==="sweep"?8:state.incidentChoice==="patch"?12:0) : 0;
  if (state.credits - incidentReserved < item.cost) return { ok: false, reason: "Insufficient credits after reserving the emergency-response cost." };
  if (action === "plant" && state.cropType === state.plannedCrop) return {ok:false,reason:"Select a different crop in the greenhouse first."};
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
export function setCropPlan(state: Outpost, crop: CropType): Outpost {
  if(state.phase !== "active" || state.selected || !(crop in CROPS)) return state;
  return {...state, plannedCrop:crop};
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
    case "harvest": {
      const gain=CROPS[n.cropType].harvest;
      n.crop -= 10; n.food = clamp(n.food + gain); n.foodProduced += gain; break;
    }
    case "plant": n.cropType = n.plannedCrop; n.crop=3; break;
    case "battery": n.battery=clamp(n.battery+24); break;
    case "repair": n.integrity = clamp(n.integrity + 30); break;
    case "supplies": n.oxygen = clamp(n.oxygen + 18); n.water = clamp(n.water + 18); n.food = clamp(n.food + 12); break;
    case "rest": n.safety = clamp(n.safety + 8); break;
    case "monitor": break;
  }
  n.log.push("Sol " + n.sol + " decision: " + item.title + ".");
  return n;
}
export type Incident = { id:"radiation"|"blackout"|"dust"|"leak"; title:string; detail:string; options:{id:IncidentChoice;title:string;detail:string}[] };
export function currentIncident(s:Outpost):Incident|null {
  if(s.destination==="moon" && (s.sol===3 || s.sol===9) || s.destination==="mars" && (s.sol===3 || s.sol===9))
    return {id:"radiation",title:"Radiation alert: protect your crew",detail:"Solar particles are approaching. Both responses have real resource consequences.",options:[
      {id:"shelter",title:"Move crew to storm shelter",detail:"Reduce today's radiation exposure 65%, using 7 battery and 2 food units."},
      {id:"expedition",title:"Continue outside work",detail:"Earn 6 credits, but increase radiation exposure 45% and reduce crew safety 4."}]};
  if(s.destination==="moon" && (s.sol===5 || s.sol===6))
    return {id:"blackout",title:"Lunar night: choose a power strategy",detail:"Solar output is zero. Decide how much electricity to reserve for essential systems.",options:[
      {id:"conserve",title:"Turn off greenhouse lighting",detail:"Reduce today's electrical demand by 10, but crops will not grow."},
      {id:"normal",title:"Keep all facilities operating",detail:"Maintain possible crop growth; risk draining battery and losing life support."}]};
  if(s.destination==="mars" && (s.sol===4 || s.sol===5 || s.sol===8))
    return {id:"dust",title:"Dust storm: protect the solar field",detail:"Airborne dust obstructs solar panels. Select an active response.",options:[
      {id:"sweep",title:"Deploy cleaning robot",detail:"Spend 8 credits for additional solar generation; robot work strains hardware."},
      {id:"seal",title:"Seal exterior equipment",detail:"No credit cost and less equipment damage, but crop growth is reduced."}]};
  if(s.destination==="moon" && s.sol===7 || s.destination==="mars" && s.sol===6)
    return {id:"leak",title:"Water circuit leak detected",detail:"A connector has failed. Act now to limit oxygen and water losses.",options:[
      {id:"patch",title:"Use emergency patch kit",detail:"Spend 12 credits to protect water and restore 8 points of habitat integrity."},
      {id:"isolate",title:"Isolate damaged circuit",detail:"No credits needed, but lose 14 water and 4 oxygen units."}]};
  return null;
}
export function chooseIncident(s:Outpost,choice:IncidentChoice):Outpost {
  const incident=currentIncident(s);
  if(s.phase!=="active" || !incident || s.incidentSol===s.sol || !incident.options.some(o=>o.id===choice)) return s;
  if((choice==="sweep" && s.credits<8)||(choice==="patch" && s.credits<12)) return s;
  return {...s,incidentSol:s.sol,incidentChoice:choice,log:[...s.log, "Sol "+s.sol+" emergency: "+incident.title+" — "+incident.options.find(o=>o.id===choice)!.title]};
}
export type Projection = { generation: number; demand: number; projectedBattery: number; supply: Forecast; note: string };
export function projectPower(s: Outpost): Projection {
  const supply = forecast(s.destination, s.sol);
  const response=s.incidentSol===s.sol?s.incidentChoice:null;
  const generation = Math.round(s.solar * 15 * supply.sunlight) + (response==="sweep"?Math.round(s.solar*15*.25):0);
  const cropPower = s.priority === "crew" ? 0 : s.greenhouses * (s.priority === "crops" ? 7 : 5) + CROPS[s.cropType].power;
  const recyclePower = s.recycling * 4;
  const demand = Math.max(0,16 + supply.extraDemand + cropPower + recyclePower - (response==="conserve"?10:0));
  return { generation, demand, supply,
    projectedBattery: clamp(s.battery + generation - demand-(response==="shelter"?7:0)),
    note: generation >= demand ? "Solar generation meets today's demand." : "The outpost must draw energy from its battery." };
}
export function advanceSol(s: Outpost): Outpost {
  if (s.phase !== "active" || !s.selected) return s;
  const incident=currentIncident(s);
  if (incident && (s.incidentSol!==s.sol || !s.incidentChoice)) return s;
  const response=s.incidentSol===s.sol?s.incidentChoice:null;
  const n: Outpost = { ...s, log: [...s.log], lastReport: [] };
  const p = projectPower(s);
  const supplied = s.battery + p.generation - (response==="shelter"?7:0);
  const shortage = Math.max(0, p.demand - supplied);
  n.battery = clamp(supplied - p.demand);
  n.oxygen = clamp(s.oxygen - 6 + s.recycling * (shortage > 0 ? 1 : 3));
  n.water = clamp(s.water - 6 + s.recycling * (shortage > 0 ? 1 : 3) -
    (s.priority === "crops" ? 3 : s.priority === "balanced" ? 1 : 0) - (s.priority==="crew"?0:CROPS[s.cropType].water));
  n.food = clamp(s.food - (s.priority === "crew" ? 4 : 5));
  const growth = shortage > 0 || s.integrity < 30 || response==="conserve" ? 0 : s.priority === "crew" ? 0 : s.greenhouses * (s.priority === "crops" ? CROPS[s.cropType].growth+2 : CROPS[s.cropType].growth);
  const adjustedGrowth=response==="seal"?Math.floor(growth/2):growth;
  n.crop = clamp(s.crop + adjustedGrowth, 100);
  const dose = p.supply.radiation / (1 + s.shielding * 0.8) * (response==="shelter"?.35:response==="expedition"?1.45:1);
  n.radiation = clamp(s.radiation + dose, 200);
  n.integrity = clamp(s.integrity - (p.supply.dust ? response==="seal"?3:response==="sweep"?9:7 : p.supply.storm ? 5 : 2));
  if(response==="shelter")n.food=clamp(n.food-2);
  if(response==="expedition"){n.credits+=6;n.safety=clamp(n.safety-4);}
  if(response==="sweep")n.credits-=8;
  if(response==="patch"){n.credits-=12;n.integrity=clamp(n.integrity+8);}
  if(response==="isolate"){n.water=clamp(n.water-14);n.oxygen=clamp(n.oxygen-4);}
  n.lastReport.push("Power: solar +" + p.generation + ", systems −" + p.demand + " · battery " + n.battery + "%.");
  n.lastReport.push("Life support: O₂ " + n.oxygen + " · water " + n.water + " · food " + n.food + ".");
  n.lastReport.push(CROPS[s.cropType].label+" crop growth +"+adjustedGrowth+", radiation exposure +"+dose.toFixed(1)+" index points.");
  if(incident)n.lastReport.push("EMERGENCY RESPONSE: "+incident.options.find(o=>o.id===response)?.title+".");
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
  n.incidentChoice=null;
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
/**
 * A mission ending in failure must never look like an 80/100 success.
 * Failure scores are capped at 39; completed missions earn 70–100 according
 * to surviving resources, efficiency, meaningful food output, and crew safety.
 * Nothing is awarded for merely clicking random buttons or advancing a sol.
 */
export function missionScore(s: Outpost): number {
  if (s.phase === "active") return 0;
  const met=missionCriteria(s).filter(x => x.met).length;
  if (s.phase === "lost") {
    const progress=Math.min(1,(s.sol-1)/MISSION_LENGTH);
    return Math.max(0,Math.min(39,Math.round(
      met * 3 + progress * 10 + Math.min(s.safety,100) * .08
    )));
  }
  const reserves=(Math.min(100,s.oxygen)+Math.min(100,s.water)+
    Math.min(100,s.food)+Math.min(100,s.battery))/400;
  const crew=Math.min(1,s.safety/100);
  const food=Math.min(1,s.foodProduced/66);
  const radiation=Math.max(0,1-s.radiation/75);
  const efficiency=Math.min(1,s.credits/105);
  return Math.max(70,Math.min(100,Math.round(70+10*reserves+7*crew+5*food+5*radiation+3*efficiency)));
}
/** Reject corrupted/legacy or improperly shaped browser saves instead of crashing. */
export function isValidOutpost(v: unknown): v is Outpost {
  if (!v || typeof v !== "object") return false;
  const s = v as Partial<Outpost>;
  if (s.version !== 2 || (s.destination !== "moon" && s.destination !== "mars") ||
      !["active", "won", "lost"].includes(s.phase ?? "") ||
      !["crew", "balanced", "crops"].includes(s.priority ?? "") ||
      !(s.selected === null || ACTIONS.some(a => a.id === s.selected)) ||
      !(s.cropType && s.cropType in CROPS) || !(s.plannedCrop && s.plannedCrop in CROPS) ||
      !(s.incidentChoice===null || ["shelter","expedition","conserve","normal","sweep","seal","patch","isolate"].includes(s.incidentChoice??"")) ||
      !Number.isInteger(s.incidentSol) || (s.incidentSol??-1)<0) return false;
  if (!Array.isArray(s.log) || !Array.isArray(s.lastReport) ||
      s.log.some(x => typeof x !== "string") || s.lastReport.some(x => typeof x !== "string")) return false;
  return (["sol","oxygen","water","food","battery","safety","radiation","crop","foodProduced",
    "credits","integrity","shielding","solar","recycling","greenhouses"] as const)
    .every(k => typeof s[k] === "number" && Number.isFinite(s[k]) && (s[k] as number) >= 0);
}

/** Migrate pre-upgrade local saves without modifying other game modes' storage. */
export function migrateOutpost(value:unknown):Outpost|null {
  if(isValidOutpost(value))return value;
  if(!value || typeof value!=="object" || (value as {version?:unknown}).version!==1)return null;
  const old=value as Record<string,unknown>;
  const upgraded={...old,version:2,cropType:"lettuce",plannedCrop:"lettuce",incidentSol:0,incidentChoice:null};
  return isValidOutpost(upgraded)?upgraded:null;
}

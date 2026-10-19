import { components, resources, type Design } from "../game";
export type LifeSupport = {
  food: number;
  water: number;
  waterRecycler: number;
  oxygen: number;
  oxygenRecycler: number;
  environment: number;
  batteries: number;
};
export const defaultLife: LifeSupport = {
  food: 18,
  water: 18,
  waterRecycler: 1,
  oxygen: 4,
  oxygenRecycler: 1,
  environment: 1,
  batteries: 1,
};
export const defaultDesign: Design = {
  counts: {
    spectrometer: 1,
    camera: 1,
    solar: 1,
    battery: 1,
    tank: 1,
    antenna: 1,
  },
  rocket: 1,
  trajectory: 2,
};
export const lifeOptions: {
  key: keyof LifeSupport;
  name: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  note: string;
}[] = [
  {
    key: "food",
    name: "Food storage",
    unit: "meals",
    min: 3,
    max: 60,
    step: 3,
    note: "Each meal: 0.7 kg and $0.02M. Three meals per crew day.",
  },
  {
    key: "water",
    name: "Water tanks",
    unit: "litres",
    min: 3,
    max: 90,
    step: 3,
    note: "Each litre: 1.2 kg including tank allowance and $0.01M.",
  },
  {
    key: "waterRecycler",
    name: "Water recycler",
    unit: "level",
    min: 0,
    max: 2,
    step: 1,
    note: "Each level: 45 kg, $8M, 12 W; recovers 35% of consumed water.",
  },
  {
    key: "oxygen",
    name: "Oxygen tanks",
    unit: "kg O₂",
    min: 1,
    max: 12,
    step: 1,
    note: "Each kg oxygen: 4 kg with pressure vessel and $0.4M.",
  },
  {
    key: "oxygenRecycler",
    name: "Oxygen recycler",
    unit: "level",
    min: 0,
    max: 2,
    step: 1,
    note: "Each level: 55 kg, $10M, 15 W; recovers 40% of oxygen use.",
  },
  {
    key: "environment",
    name: "Environmental control",
    unit: "level",
    min: 1,
    max: 2,
    step: 1,
    note: "Each level: 45 kg, $6M, 15 W. Level 2 resists thermal and pressure drift.",
  },
  {
    key: "batteries",
    name: "Reserve battery modules",
    unit: "modules",
    min: 1,
    max: 4,
    step: 1,
    note: "Each module: 65 kg, $6M and 1 kWh reserve capacity.",
  },
];
export function engineering(d: Design, l: LifeSupport) {
  const base = resources(d);
  const cost =
    l.food * 0.02 +
    l.water * 0.01 +
    l.waterRecycler * 8 +
    l.oxygen * 0.4 +
    l.oxygenRecycler * 10 +
    l.environment * 6 +
    l.batteries * 6;
  const mass =
    l.food * 0.7 +
    l.water * 1.2 +
    l.waterRecycler * 45 +
    l.oxygen * 4 +
    l.oxygenRecycler * 55 +
    l.environment * 45 +
    l.batteries * 65;
  const draw =
    l.waterRecycler * 12 + l.oxygenRecycler * 15 + l.environment * 15;
  return {
    ...base,
    cost: base.cost + cost,
    mass: base.mass + mass,
    power: base.power - draw,
    capacity: l.batteries,
    waterDays: l.water / (3 * (1 - l.waterRecycler * 0.35)),
    oxygenDays: l.oxygen / (0.84 * (1 - l.oxygenRecycler * 0.4)),
    foodDays: l.food / 3,
  };
}
export type Area =
  | "cockpit"
  | "science"
  | "communications"
  | "power"
  | "galley"
  | "sleep"
  | "equipment";
export const areas: {
  id: Area;
  name: string;
  x: number;
  z: number;
  color: number;
  label: string;
}[] = [
  {
    id: "cockpit",
    name: "Cockpit",
    x: 0,
    z: -10,
    color: 0x76d9ed,
    label: "NAVIGATION",
  },
  {
    id: "science",
    name: "Science station",
    x: -3,
    z: -6,
    color: 0x99a2ff,
    label: "SCIENCE",
  },
  {
    id: "communications",
    name: "Communications",
    x: 3,
    z: -6,
    color: 0x69e4c9,
    label: "COMMS",
  },
  {
    id: "power",
    name: "Power station",
    x: -3,
    z: 0,
    color: 0xffcc80,
    label: "POWER",
  },
  {
    id: "galley",
    name: "Food & water storage",
    x: 3,
    z: 0,
    color: 0x83de91,
    label: "GALLEY",
  },
  {
    id: "sleep",
    name: "Sleeping area",
    x: -3,
    z: 6,
    color: 0xaeb1ff,
    label: "REST",
  },
  {
    id: "equipment",
    name: "Equipment & tools",
    x: 3,
    z: 6,
    color: 0xf1b8a1,
    label: "TOOLS",
  },
];
export type State = {
  minutes: number;
  food: number;
  water: number;
  oxygen: number;
  battery: number;
  energy: number;
  nutrition: number;
  hydration: number;
  sleepDebt: number;
  sleeping: boolean;
  pressure: number;
  temperature: number;
  radiation: number;
  communications: boolean;
  malfunction: boolean;
  science: number;
  fuel: number;
  meals: number;
  bottle: number;
  parts: number;
  tools: boolean;
  course: boolean;
  sent: boolean;
  rested: boolean;
  paused: boolean;
  ended: boolean;
  notice: string;
  log: string[];
};
export function newMission(d: Design, l: LifeSupport): State {
  return {
    minutes: 0,
    food: l.food,
    water: l.water,
    oxygen: l.oxygen,
    battery: l.batteries,
    energy: 90,
    nutrition: 90,
    hydration: 90,
    sleepDebt: 0,
    sleeping: false,
    pressure: 101.3,
    temperature: 22,
    radiation: 0,
    communications: !!d.counts.antenna,
    malfunction: false,
    science: 0,
    fuel: resources(d).fuel,
    meals: 0,
    bottle: 0,
    parts: 3,
    tools: false,
    course: false,
    sent: false,
    rested: false,
    paused: false,
    ended: false,
    notice:
      "Walk to a station and interact. Complete the six-hour readiness sortie.",
    log: ["Mission started. Life-support configuration loaded."],
  };
}
const limit = (n: number) => Math.max(0, Math.min(100, n));
export function tick(s: State, d: Design, l: LifeSupport, minutes = 1): State {
  if (s.paused || s.ended) return s;
  let n = { ...s, minutes: s.minutes + minutes };
  const e = engineering(d, l);
  const usable = s.battery > 0 || e.power >= 0;
  const recycler = usable && !s.malfunction;
  n.oxygen = Math.max(
    0,
    s.oxygen -
      (0.84 / 1440) * minutes * (1 - (recycler ? l.oxygenRecycler * 0.4 : 0)),
  );
  n.battery = Math.max(
    0,
    Math.min(
      l.batteries,
      s.battery + ((e.power - (s.malfunction ? 90 : 0)) * minutes) / 60000,
    ),
  );
  n.nutrition = limit(s.nutrition - minutes * 0.11);
  n.hydration = limit(s.hydration - minutes * 0.19);
  n.sleepDebt = Math.max(0, s.sleepDebt + minutes * (s.sleeping ? -2 : 1));
  n.energy = limit(
    s.energy +
      minutes * (s.sleeping ? 0.55 : -0.025) -
      (n.nutrition < 25 ? minutes * 0.13 : 0) -
      (n.hydration < 25 ? minutes * 0.2 : 0) -
      (n.sleepDebt > 480 ? minutes * 0.08 : 0),
  );
  n.pressure = Math.max(
    0,
    Math.min(
      101.3,
      s.pressure + (usable && !s.malfunction ? 0.03 : -0.07) * minutes,
    ),
  );
  n.temperature =
    s.temperature +
    (!usable || s.malfunction
      ? 0.018 / l.environment
      : (22 - s.temperature) * 0.02) *
      minutes;
  n.radiation =
    n.minutes >= 120 && n.minutes < 180
      ? Math.max(1, 8 - (d.counts.shield || 0) * 3)
      : 0;
  if (s.minutes < 90 && n.minutes >= 90) n.communications = false;
  if (s.minutes < 210 && n.minutes >= 210) n.malfunction = true;
  if (n.sleeping && n.energy >= 99) {
    n.sleeping = false;
    n.rested = true;
    n.notice = "Rest complete. Ready for duty.";
  }
  if (n.oxygen <= 0 || n.pressure < 70 || n.energy <= 0) {
    n.ended = true;
    n.notice =
      "Safety abort: mission readiness lost. Review supplies and crew care.";
  }
  return n;
}
export type Action =
  | "takeMeal"
  | "eat"
  | "fill"
  | "drink"
  | "dispenser"
  | "sleep"
  | "wake"
  | "tools"
  | "repair"
  | "comms"
  | "science"
  | "course"
  | "finish";
export const actionAreas: Partial<Record<Action, Area>> = {
  takeMeal: "galley",
  fill: "galley",
  dispenser: "galley",
  sleep: "sleep",
  tools: "equipment",
  repair: "power",
  comms: "communications",
  science: "science",
  course: "cockpit",
  finish: "cockpit",
};
export function act(
  s: State,
  action: Action,
  area: Area | undefined,
  d: Design,
  l: LifeSupport,
): State {
  if (s.ended || s.paused) return s;
  const required = actionAreas[action];
  if (required && required !== area)
    return { ...s, notice: "Move closer to the correct station." };
  let n = { ...s };
  const fail = (notice: string) => ({ ...s, notice });
  if (s.sleeping && action !== "wake")
    return fail("Wake up before interacting.");
  switch (action) {
    case "takeMeal":
      if (s.food < 1) return fail("Food storage is empty.");
      if (s.meals >= 3) return fail("Carry at most three meals.");
      n.food--;
      n.meals++;
      n.notice = "One meal added to inventory.";
      break;
    case "eat":
      if (s.meals < 1) return fail("Take a meal from storage first.");
      n.meals--;
      n.nutrition = limit(s.nutrition + 35);
      n.energy = limit(s.energy + 8);
      n.notice = "Meal eaten. Nutrition and readiness restored.";
      break;
    case "fill": {
      const amount = Math.min(1 - s.bottle, s.water);
      if (amount <= 0) return fail("Bottle full or water storage empty.");
      n.water -= amount;
      n.bottle += amount;
      n.notice = `Filled bottle with ${amount.toFixed(2)} L.`;
      break;
    }
    case "drink": {
      const amount = Math.min(0.25, s.bottle);
      if (amount <= 0) return fail("Fill your bottle at the galley first.");
      n.bottle -= amount;
      n.hydration = limit(s.hydration + amount * 60);
      n.energy = limit(s.energy + 2);
      if (!s.malfunction && s.battery > 0)
        n.water += amount * l.waterRecycler * 0.35;
      n.notice = "Drank from bottle; recycler recovered configured fraction.";
      break;
    }
    case "dispenser": {
      const amount = Math.min(0.25, s.water);
      if (amount <= 0) return fail("No water remains.");
      n.water -=
        amount *
        (1 - (!s.malfunction && s.battery > 0 ? l.waterRecycler * 0.35 : 0));
      n.hydration = limit(s.hydration + amount * 60);
      n.energy = limit(s.energy + 2);
      n.notice = "Drank at water dispenser.";
      break;
    }
    case "sleep":
      n.sleeping = true;
      n.notice = "Resting. Mission time and life support continue.";
      break;
    case "wake":
      n.sleeping = false;
      n.rested = true;
      n.notice = "Awake and back on duty.";
      break;
    case "tools":
      n.tools = true;
      n.notice = "Repair toolkit collected.";
      break;
    case "repair":
      if (!s.malfunction) return fail("Power equipment is operating normally.");
      if (!s.tools || s.parts < 1)
        return fail("Collect toolkit; one spare part required.");
      n.parts--;
      n.malfunction = false;
      n.notice = "Fault repaired. One spare part consumed.";
      break;
    case "comms":
      if (!d.counts.antenna)
        return fail("No antenna installed in this design.");
      if (s.battery <= 0) return fail("Restore power first.");
      n.communications = true;
      n.notice = "Downlink calibrated and communications restored.";
      if (s.science >= 30) {
        n.sent = true;
        n.notice = "Science data transmitted to Earth.";
      }
      break;
    case "science":
      if (s.energy < 25 || s.hydration < 20 || s.nutrition < 20)
        return fail("Restore food, hydration and energy before science duty.");
      if (s.battery <= 0 || s.malfunction)
        return fail("Restore power equipment first.");
      if (!d.counts.spectrometer)
        return fail("Install a spectrometer during design.");
      n.science = Math.min(100, s.science + 10 + (d.counts.camera || 0) * 2);
      n.energy = limit(s.energy - 5);
      n.battery = Math.max(0, s.battery - 0.025);
      n.notice =
        "Water-search observations collected. Energy −5; battery −0.025 kWh.";
      break;
    case "course":
      if (s.course) return fail("Course already verified.");
      if (s.fuel < 2) return fail("Need two fuel units.");
      n.fuel -= 2;
      n.course = true;
      n.notice = "Course verified. Two fuel units consumed.";
      break;
    case "finish":
      if (
        s.minutes < 360 ||
        !s.course ||
        !s.sent ||
        !s.rested ||
        s.malfunction ||
        !s.communications
      )
        return fail(
          "Complete all objectives and restore systems before ending the sortie.",
        );
      n.ended = true;
      n.notice =
        "Readiness sortie complete. Crew and spacecraft are ready for the next phase.";
      break;
  }
  n.log = [...s.log, `T+${s.minutes.toFixed(0)}m: ${n.notice}`].slice(-30);
  return n;
}
export function alerts(s: State) {
  return [
    s.food + s.meals < 3 ? "LOW FOOD: fewer than three meals remain." : "",
    s.water + s.bottle < 2 ? "LOW WATER: less than 2 L available." : "",
    s.oxygen < 0.3 ? "LOW OXYGEN: reserve below 0.3 kg." : "",
    s.battery < 0.2 ? "LOW POWER: reserve below 0.2 kWh." : "",
    !s.communications
      ? "COMMUNICATION FAILURE: calibrate the communications station."
      : "",
    s.malfunction
      ? "EQUIPMENT MALFUNCTION: take tools and repair the power station."
      : "",
    s.hydration < 30 ? "CREW HYDRATION LOW: drink water." : "",
    s.nutrition < 30 ? "CREW NUTRITION LOW: eat a meal." : "",
    s.energy < 30 ? "CREW ENERGY LOW: rest in the sleeping area." : "",
    s.pressure < 90 ? "CABIN PRESSURE LOW" : "",
    s.temperature > 27 ? "CABIN TEMPERATURE HIGH" : "",
    s.radiation > 0
      ? "SOLAR ACTIVITY: radiation elevated. Shielding reduces exposure."
      : "",
  ].filter(Boolean);
}
export function lifeSummary(d: Design, l: LifeSupport) {
  return (
    components
      .filter((c) => d.counts[c.id])
      .map((c) => `${c.name} ×${d.counts[c.id]}`)
      .join(", ") + `; ${l.batteries} reserve batteries`
  );
}

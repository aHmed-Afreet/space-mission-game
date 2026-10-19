import type { Destination } from "./environments";
import type { EquipmentId } from "./equipment";
import type { Area, Action } from "../simulation";
export type Site =
  | Area
  | "innerHatch"
  | "airlock"
  | "outerHatch"
  | "survey"
  | "crater"
  | "camp"
  | "relay";
export type ObjectiveType =
  | "GO_TO"
  | "INTERACT"
  | "COLLECT"
  | "USE_ITEM"
  | "EAT"
  | "DRINK"
  | "REPAIR"
  | "SCAN"
  | "SAMPLE"
  | "DEPLOY"
  | "TRANSMIT"
  | "WAIT"
  | "REST"
  | "EVA_CHECK"
  | "AIRLOCK"
  | "RETURN";
export type CampaignAction =
  | Action
  | "equipSuit"
  | "checkOxygen"
  | "checkPower"
  | "openInner"
  | "closeInner"
  | "vent"
  | "openOuter"
  | "closeOuter"
  | "pressurize"
  | "checkSystems"
  | "approach"
  | "land"
  | "diagnose"
  | "scan"
  | "sample"
  | "drill"
  | "photo"
  | "measureRadiation"
  | "measureTemperature"
  | "deployShelter"
  | "deploySolar"
  | "deployBattery"
  | "deployAntenna"
  | "deployStorage"
  | "deploySensor"
  | "experiment"
  | "storeSamples"
  | "repairCamp"
  | "campTransmit";
export type Objective = {
  id: string;
  type: ObjectiveType;
  title: string;
  instruction: string;
  site?: Site;
  action?: CampaignAction;
  count?: number;
  condition?: "vacuum" | "pressurized" | "minutes" | "science";
  value?: number;
  tutorial?: string;
};
export type MissionDefinition = {
  id: string;
  revision: number;
  outpost?: "existing";
  startsLanded: boolean;
  chapter: string;
  level: number;
  title: string;
  destination: Destination;
  description: string;
  majorObjective: string;
  implemented: boolean;
  phases: string[];
  requiredEquipment: EquipmentId[];
  allowedEquipment: EquipmentId[];
  objectives: Objective[];
  prerequisites: string[];
  eva: boolean;
  surface: boolean;
  duration: number;
  hazards: { type: "power" | "comms" | "campPower"; at: number }[];
  experiments: string[];
  rewards: string[];
  scoring: { science: number; resources: number; crew: number };
  configuration: { antenna: boolean; spectrometer: boolean };
  completion: "all-objectives";
};
export const chapters = [
  {
    id: "training",
    title: "Command Training",
    subtitle: "Learn to operate your explorer.",
  },
  {
    id: "lunar",
    title: "Lunar Expedition",
    subtitle: "Leave the spacecraft and work on the Moon.",
  },
  {
    id: "mars",
    title: "Mars Explorer",
    subtitle:
      "A future expedition to investigate water and build a field camp.",
  },
  {
    id: "deep",
    title: "Deep Space",
    subtitle: "Future independent operations beyond the inner planets.",
  },
];
let serial = 0;
const task = (
  type: ObjectiveType,
  title: string,
  site?: Site,
  action?: CampaignAction,
  extra: Partial<Objective> = {},
): Objective => ({
  id: `task-${++serial}`,
  type,
  title,
  instruction: title,
  site,
  action,
  ...extra,
});
const go = (site: Site, title: string) => task("GO_TO", title, site);
const use = (
  site: Site,
  title: string,
  action: CampaignAction,
  type: ObjectiveType = "INTERACT",
  extra: Partial<Objective> = {},
) => task(type, title, site, action, extra);
export function evaOut(): Objective[] {
  return [
    go("equipment", "Go to the equipment locker."),
    use("equipment", "Put on your EVA suit.", "equipSuit", "USE_ITEM", {
      tutorial: "eva",
    }),
    use("equipment", "Check your suit oxygen.", "checkOxygen", "EVA_CHECK"),
    use("equipment", "Check your suit battery.", "checkPower", "EVA_CHECK"),
    go("innerHatch", "Go to the airlock door."),
    use("innerHatch", "Open the inside hatch.", "openInner", "AIRLOCK"),
    go("airlock", "Walk into the airlock."),
    use("airlock", "Close the inside hatch.", "closeInner", "AIRLOCK"),
    use("airlock", "Release air from the sealed airlock.", "vent", "AIRLOCK"),
    task(
      "WAIT",
      "Wait for the airlock to reach vacuum.",
      "airlock",
      undefined,
      { condition: "vacuum", tutorial: "airlock" },
    ),
    use("airlock", "Open the outside hatch.", "openOuter", "AIRLOCK"),
    go("survey", "Walk out to the survey marker."),
  ];
}
export function evaReturn(): Objective[] {
  return [
    task("RETURN", "Return to the airlock.", "airlock"),
    use("airlock", "Close the outside hatch.", "closeOuter", "AIRLOCK"),
    use("airlock", "Refill the airlock with air.", "pressurize", "AIRLOCK"),
    task(
      "WAIT",
      "Wait until the airlock has breathable air.",
      "airlock",
      undefined,
      { condition: "pressurized" },
    ),
    use("airlock", "Open the inside hatch.", "openInner", "AIRLOCK"),
    task("RETURN", "Walk back to the flight deck.", "cockpit"),
  ];
}
const scienceGear: EquipmentId[] = [
  "suit",
  "scanner",
  "containers",
  "camera",
  "sensor",
  "radiation",
  "repair",
];
const allGear = Object.keys({
  suit: 1,
  scanner: 1,
  containers: 1,
  drill: 1,
  radiation: 1,
  sensor: 1,
  camera: 1,
  experiment: 1,
  repair: 1,
  antenna: 1,
  solar: 1,
  battery: 1,
  shelter: 1,
  storage: 1,
}) as EquipmentId[];
function def(
  level: number,
  chapter: string,
  title: string,
  destination: Destination,
  objectives: Objective[],
  extra: Partial<MissionDefinition> = {},
): MissionDefinition {
  return {
    id: `level-${level}`,
    revision: 1,
    startsLanded: destination === "moon" && !!extra.surface,
    chapter,
    level,
    title,
    destination,
    description: title,
    majorObjective: objectives[objectives.length - 1]?.title || title,
    implemented: level <= 12,
    phases: extra.eva
      ? [
          "EVA PREPARATION",
          "EVA",
          "FIELD EXPEDITION",
          "RETURN TO SPACECRAFT",
          "MISSION REPORT",
        ]
      : ["SPACECRAFT OPERATIONS", "MISSION REPORT"],
    requiredEquipment: [],
    allowedEquipment: extra.eva ? allGear : [],
    objectives,
    prerequisites: level === 1 ? [] : [`level-${level - 1}`],
    eva: false,
    surface: false,
    duration: 60,
    hazards: [],
    experiments: [],
    rewards: [`Level ${level + 1} access`],
    scoring: { science: 0.25, resources: 0.4, crew: 0.35 },
    configuration: { antenna: true, spectrometer: true },
    completion: "all-objectives",
    ...extra,
  };
}
export const missions: MissionDefinition[] = [
  def(
    1,
    "training",
    "Flight Check",
    "earth",
    [
      go("cockpit", "Go to the navigation console."),
      use("cockpit", "Check the flight trajectory.", "course", "INTERACT", {
        tutorial: "navigation",
      }),
    ],
    {
      description: "Learn where to go and how to use a console.",
      majorObjective: "Verify the flight trajectory.",
    },
  ),
  def(
    2,
    "training",
    "Crew Survival",
    "earth",
    [
      go("galley", "Go to food and water storage."),
      use("galley", "Take one meal pack.", "takeMeal", "COLLECT", {
        tutorial: "food",
      }),
      use("galley", "Fill your water bottle.", "fill", "COLLECT", {
        tutorial: "water",
      }),
      task("EAT", "Eat your carried meal.", undefined, "eat", {
        tutorial: "inventory",
      }),
      task("DRINK", "Drink from your water bottle.", undefined, "drink"),
    ],
    {
      description: "Collect real supplies and use them from your inventory.",
      majorObjective: "Eat a meal and drink water.",
    },
  ),
  def(
    3,
    "training",
    "Science Operations",
    "earth",
    [
      go("science", "Go to the science station."),
      use(
        "science",
        "Collect three sets of observations.",
        "science",
        "INTERACT",
        { count: 3, tutorial: "science" },
      ),
      go("sleep", "Go to the sleeping berth."),
      use("sleep", "Start a short rest.", "sleep", "REST", {
        tutorial: "rest",
      }),
      task("WAIT", "Rest for five mission minutes.", "sleep", undefined, {
        condition: "minutes",
        value: 5,
      }),
      task("REST", "Wake up and return to duty.", undefined, "wake"),
    ],
    {
      majorObjective: "Collect science data and practise resting.",
      experiments: ["Cabin water-search observations"],
    },
  ),
  def(
    4,
    "training",
    "Communications",
    "earth",
    [
      go("science", "Go to the science station."),
      use(
        "science",
        "Collect three sets of observations.",
        "science",
        "INTERACT",
        { count: 3 },
      ),
      go("communications", "Go to communications."),
      use(
        "communications",
        "Restore the radio link and send the data.",
        "comms",
        "TRANSMIT",
        { tutorial: "comms" },
      ),
    ],
    {
      hazards: [{ type: "comms", at: 0 }],
      majorObjective: "Transmit observations to Earth.",
    },
  ),
  def(
    5,
    "training",
    "Emergency Repair",
    "earth",
    [
      go("power", "Go to the power station."),
      use("power", "Read the power fault.", "diagnose", "INTERACT", {
        tutorial: "power",
      }),
      go("equipment", "Go to the equipment locker."),
      use("equipment", "Collect your repair toolkit.", "tools", "COLLECT"),
      go("power", "Return to the power station."),
      use(
        "power",
        "Repair the faulty unit. One spare part is used.",
        "repair",
        "REPAIR",
        { tutorial: "repair" },
      ),
    ],
    {
      hazards: [{ type: "power", at: 0 }],
      majorObjective: "Repair a spacecraft power failure.",
    },
  ),
  def(
    6,
    "training",
    "EVA Training",
    "earth",
    [
      ...evaOut(),
      use(
        "survey",
        "Photograph the external training target.",
        "photo",
        "USE_ITEM",
      ),
      ...evaReturn(),
    ],
    {
      eva: true,
      surface: true,
      requiredEquipment: ["suit", "camera"],
      phases: [
        "EVA PREPARATION",
        "EVA",
        "RETURN TO SPACECRAFT",
        "MISSION REPORT",
      ],
      majorObjective: "Complete an outside training walk and return safely.",
      experiments: ["Training target photograph"],
    },
  ),
  def(
    7,
    "lunar",
    "Lunar Approach",
    "moon",
    [
      go("power", "Go to the power station."),
      use(
        "power",
        "Check power and life support.",
        "checkSystems",
        "INTERACT",
        { tutorial: "environment" },
      ),
      go("cockpit", "Go to the navigation console."),
      use("cockpit", "Prepare the lunar approach.", "approach"),
      task("WAIT", "Follow the approach countdown.", "cockpit", undefined, {
        condition: "minutes",
        value: 5,
      }),
    ],
    {
      majorObjective: "Prepare the spacecraft for lunar operations.",
      phases: ["APPROACH", "MISSION REPORT"],
    },
  ),
  def(
    8,
    "lunar",
    "Lunar Landing",
    "moon",
    [
      go("cockpit", "Go to the flight deck."),
      use("cockpit", "Check the landing systems.", "checkSystems"),
      use("cockpit", "Begin the guided lunar landing.", "land"),
      task(
        "WAIT",
        "Wait for the landing sequence to finish.",
        "cockpit",
        undefined,
        { condition: "minutes", value: 6 },
      ),
      go("communications", "Go to the radio console."),
      use(
        "communications",
        "Confirm touchdown with Earth.",
        "comms",
        "TRANSMIT",
      ),
    ],
    {
      majorObjective: "Land safely and confirm touchdown.",
      phases: ["LANDING", "MISSION REPORT"],
    },
  ),
  def(
    9,
    "lunar",
    "First Lunar EVA",
    "moon",
    [
      ...evaOut(),
      use(
        "survey",
        "Measure the lunar environment.",
        "measureTemperature",
        "USE_ITEM",
        { tutorial: "field" },
      ),
      ...evaReturn(),
    ],
    {
      eva: true,
      surface: true,
      requiredEquipment: ["suit", "sensor"],
      majorObjective: "Walk on the Moon and return through the airlock.",
      experiments: ["Lunar surface temperature"],
    },
  ),
  def(
    10,
    "lunar",
    "Geological Survey",
    "moon",
    [
      ...evaOut(),
      use("survey", "Scan the marked rock.", "scan", "SCAN"),
      use("survey", "Collect a labelled rock sample.", "sample", "SAMPLE"),
      go("crater", "Walk to the shallow crater."),
      use("crater", "Drill a shallow sample.", "drill", "SAMPLE"),
      use("crater", "Photograph the survey site.", "photo", "USE_ITEM"),
      ...evaReturn(),
    ],
    {
      eva: true,
      surface: true,
      requiredEquipment: ["suit", "scanner", "containers", "drill", "camera"],
      majorObjective: "Collect two different lunar samples.",
      experiments: ["Rock survey", "Shallow sample"],
    },
  ),
  def(
    11,
    "lunar",
    "Deploy Research Station",
    "moon",
    [
      ...evaOut(),
      go("camp", "Go to the research camp marker."),
      use(
        "camp",
        "Deploy the research shelter and work table.",
        "deployShelter",
        "DEPLOY",
        { tutorial: "camp" },
      ),
      use("camp", "Deploy the solar array.", "deploySolar", "DEPLOY"),
      use("camp", "Connect the camp battery.", "deployBattery", "DEPLOY"),
      use("camp", "Set up the camp antenna.", "deployAntenna", "DEPLOY"),
      use("camp", "Place the environmental sensor.", "deploySensor", "DEPLOY"),
      use("camp", "Deploy sample storage.", "deployStorage", "DEPLOY"),
      use("camp", "Run a powered field experiment.", "experiment", "USE_ITEM"),
      use(
        "camp",
        "Send the experiment result to the spacecraft.",
        "campTransmit",
        "TRANSMIT",
      ),
      ...evaReturn(),
    ],
    {
      eva: true,
      surface: true,
      requiredEquipment: [
        "suit",
        "shelter",
        "solar",
        "battery",
        "antenna",
        "sensor",
        "storage",
        "experiment",
      ],
      majorObjective: "Build and operate a working field research camp.",
      phases: [
        "EVA PREPARATION",
        "FIELD EXPEDITION",
        "RESEARCH CAMP",
        "RETURN TO SPACECRAFT",
        "MISSION REPORT",
      ],
      experiments: ["Camp environment test"],
    },
  ),
  def(
    12,
    "lunar",
    "Lunar Emergency",
    "moon",
    [
      ...evaOut(),
      go("camp", "Go to the deployed research camp."),
      use(
        "camp",
        "Repair the failed field power connector.",
        "repairCamp",
        "REPAIR",
      ),
      use(
        "camp",
        "Measure radiation at the camp.",
        "measureRadiation",
        "USE_ITEM",
      ),
      use(
        "camp",
        "Confirm that field communications work.",
        "campTransmit",
        "TRANSMIT",
      ),
      ...evaReturn(),
    ],
    {
      eva: true,
      surface: true,
      requiredEquipment: ["suit", "repair", "radiation"],
      outpost: "existing",
      majorObjective: "Repair the field base and return safely.",
      hazards: [{ type: "campPower", at: 0 }],
      experiments: ["Field radiation survey"],
    },
  ),
  def(
    13,
    "mars",
    "Mars Transfer",
    "mars",
    [
      use("cockpit", "Plan the Mars transfer.", "course"),
      task("EAT", "Eat a meal.", undefined, "eat"),
      task("DRINK", "Drink water.", undefined, "drink"),
    ],
    {
      majorObjective: "Manage supplies and navigation on the journey.",
      duration: 240,
    },
  ),
  def(14, "mars", "Mars Arrival", "mars", [
    use("power", "Check arrival systems.", "checkSystems"),
    use("cockpit", "Prepare Mars approach.", "approach"),
  ]),
  def(15, "mars", "Mars Landing", "mars", [
    use("cockpit", "Begin Mars descent.", "land"),
    task("WAIT", "Complete descent.", "cockpit", undefined, {
      condition: "minutes",
      value: 10,
    }),
  ]),
  def(
    16,
    "mars",
    "Search for Water",
    "mars",
    [
      ...evaOut(),
      use("survey", "Scan for ice signatures.", "scan", "SCAN"),
      use("crater", "Drill a soil sample.", "drill", "SAMPLE"),
      ...evaReturn(),
    ],
    { eva: true, surface: true, requiredEquipment: scienceGear },
  ),
  def(
    17,
    "mars",
    "Establish Research Camp",
    "mars",
    [
      ...evaOut(),
      use("camp", "Deploy a Mars field base.", "deployShelter", "DEPLOY"),
      ...evaReturn(),
    ],
    {
      eva: true,
      surface: true,
      requiredEquipment: ["suit", "shelter", "solar", "battery", "antenna"],
    },
  ),
  def(
    18,
    "mars",
    "Mars Science Expedition",
    "mars",
    [
      ...evaOut(),
      use(
        "survey",
        "Measure the local environment.",
        "measureTemperature",
        "USE_ITEM",
      ),
      use("camp", "Run the field experiment.", "experiment", "USE_ITEM"),
      ...evaReturn(),
    ],
    {
      eva: true,
      surface: true,
      requiredEquipment: ["suit", "sensor", "experiment"],
    },
  ),
  def(
    19,
    "mars",
    "Equipment Failure",
    "mars",
    [
      ...evaOut(),
      use("camp", "Repair field equipment.", "repairCamp", "REPAIR"),
      ...evaReturn(),
    ],
    { eva: true, surface: true, requiredEquipment: ["suit", "repair"] },
  ),
  def(
    20,
    "mars",
    "Long-Range Exploration",
    "mars",
    [
      ...evaOut(),
      go("relay", "Reach the distant survey point."),
      use("relay", "Scan the distant outcrop.", "scan", "SCAN"),
      ...evaReturn(),
    ],
    {
      eva: true,
      surface: true,
      requiredEquipment: ["suit", "scanner", "antenna"],
    },
  ),
  def(
    21,
    "mars",
    "Return to Spacecraft",
    "mars",
    [task("RETURN", "Bring the expedition home.", "cockpit")],
    { eva: true, surface: true, requiredEquipment: ["suit"] },
  ),
  def(
    22,
    "deep",
    "Asteroid Rendezvous",
    "asteroid",
    [use("cockpit", "Match the asteroid approach.", "approach")],
    { majorObjective: "Navigate to a small body." },
  ),
  def(
    23,
    "deep",
    "Low-Gravity Sampling",
    "asteroid",
    [
      ...evaOut(),
      use("survey", "Collect a tethered sample.", "sample", "SAMPLE"),
      ...evaReturn(),
    ],
    { eva: true, surface: true, requiredEquipment: ["suit", "containers"] },
  ),
  def(
    24,
    "deep",
    "Deep-Space Systems Failure",
    "deep-space",
    [
      use("power", "Diagnose the emergency.", "diagnose"),
      use("power", "Restore essential power.", "repair", "REPAIR"),
      use("communications", "Contact Earth.", "comms", "TRANSMIT"),
    ],
    {
      majorObjective: "Handle a major emergency far from Earth.",
      duration: 360,
    },
  ),
];
export function missionById(id: string) {
  const m = missions.find((m) => m.id === id);
  if (!m) throw new Error("Unknown mission: " + id);
  return m;
}

import { missions as oldMissions } from "./legacyDefinitions";
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
  | "verifyPower"
  | "verifyLife"
  | "verifyRadio"
  | "verifyFuel"
  | "sealHatch"
  | "armLaunch"
  | "ignite"
  | "separate"
  | "insertOrbit"
  | "returnBurn"
  | "recoverVehicle"
  | "powerSafe"
  | "powerScience"
  | "diagnoseSatellite"
  | "repairSatellite"
  | "testSatellite"
  | "repairSecondary"
  | "recoverPackage"
  | "selectCamp"
  | "alignSolar"
  | "alignRelay"
  | "eventReset"
  | "eventReroute"
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
  condition?:
    | "vacuum"
    | "pressurized"
    | "minutes"
    | "science"
    | "countdown"
    | "staging"
    | "orbitHeight";
  value?: number;
  tutorial?: string;
  phase?: string;
  choices?: { action: CampaignAction; title: string; detail: string }[];
  event?: "power" | "comms" | "campPower";
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
  funding?: number;
  reward?: number;
  unlocks?: string[];
  optional?: OptionalChallenge[];
  expectedMinutes?: string;
};
export type OptionalChallenge = {
  id: string;
  title: string;
  description: string;
  reward: number;
  action?: CampaignAction;
  site?: Site;
  condition?: "battery" | "fuel" | "samples" | "suit";
  value?: number;
  gear?: EquipmentId;
};
export const chapters = [
  {
    id: "training",
    title: "Earth Orbit",
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
const phase = (name: string, tasks: Objective[]) =>
  tasks.map((t) => ({ ...t, phase: name }));
const wait = (title: string, minutes: number, site?: Site) =>
  task("WAIT", title, site, undefined, {
    condition: "minutes",
    value: minutes,
  });
const decision = (
  title: string,
  site: Site,
  event: Objective["event"],
  choices: NonNullable<Objective["choices"]>,
) =>
  task("INTERACT", title, site, choices[0].action, {
    event,
    choices,
    instruction:
      "Choose a response. Each option changes your mission resources.",
  });
const launch = () => [
  ...phase("PRE-LAUNCH", [
    use("power", "Verify electrical power.", "verifyPower"),
    use("galley", "Confirm life support and stored supplies.", "verifyLife"),
    use("communications", "Run the launch radio check.", "verifyRadio"),
    use("cockpit", "Verify the departure trajectory.", "course"),
    use("cockpit", "Confirm propellant reserve.", "verifyFuel"),
    use("cockpit", "Seal the vehicle and arm the countdown.", "sealHatch"),
  ]),
  ...phase("LAUNCH", [
    use("cockpit", "Start the launch countdown.", "armLaunch"),
    task("WAIT", "Monitor the six-second countdown.", "cockpit", undefined, {
      condition: "countdown",
    }),
    use("cockpit", "Ignite the launch vehicle.", "ignite"),
    task(
      "WAIT",
      "Fly the ascent to the staging window.",
      undefined,
      undefined,
      {
        condition: "staging",
        instruction:
          "Set thrust above 65%. Keep pitch near the blue guidance target. Separate when altitude reaches 12 km.",
      },
    ),
    task("INTERACT", "Separate the booster stage.", undefined, "separate"),
    task(
      "WAIT",
      "Guide the upper stage to orbital altitude.",
      undefined,
      undefined,
      {
        condition: "orbitHeight",
        instruction:
          "Keep thrust and pitch on guidance. Reach 180 km and 7.8 km/s, then confirm orbital insertion.",
      },
    ),
    task("INTERACT", "Complete orbital insertion.", undefined, "insertOrbit"),
  ]),
];
const meals = () => [
  use(
    "galley",
    "Collect a meal and prepare for the duty shift.",
    "takeMeal",
    "COLLECT",
  ),
  use("galley", "Fill the water bottle.", "fill", "COLLECT"),
  task("EAT", "Eat your carried meal.", undefined, "eat", {
    tutorial: "supplies",
  }),
  task("DRINK", "Drink from the water bottle.", undefined, "drink"),
];
const travel = () =>
  phase("TRANSFER OPERATIONS", [
    use("science", "Record a navigation-star observation.", "science"),
    use("cockpit", "Apply the transfer-course correction.", "course"),
    ...meals(),
    use("sleep", "Rest before the next operational shift.", "sleep", "REST", {
      tutorial: "rest",
    }),
    wait("Complete the rest interval.", 12, "sleep"),
    task("REST", "Wake and begin the next shift.", undefined, "wake"),
  ]);
const powerDecision = () =>
  decision("Resolve the power-bus warning.", "power", "power", [
    {
      action: "eventReset",
      title: "Isolate and repair the bus",
      detail: "Use 1 spare part. Recover full power and preserve science.",
    },
    {
      action: "eventReroute",
      title: "Bypass the failed branch",
      detail: "Keep the spare part; lose 0.12 kWh and 8 science points.",
    },
  ]);
const returnHome = () =>
  phase("RETURN & RECOVERY", [
    use(
      "communications",
      "Transmit the mission science and recovery plan.",
      "comms",
      "TRANSMIT",
    ),
    use("cockpit", "Start the controlled return burn.", "returnBurn"),
    wait("Monitor the return corridor.", 12, "cockpit"),
    use(
      "cockpit",
      "Confirm vehicle recovery and close the mission.",
      "recoverVehicle",
    ),
  ]);
function full(
  level: number,
  chapter: string,
  title: string,
  destination: Destination,
  tasks: Objective[],
  extra: Partial<MissionDefinition>,
): MissionDefinition {
  return {
    ...def(level, chapter, title, destination, tasks, extra),
    id: `mission-${level}`,
    revision: 3,
    startsLanded: false,
    implemented: level <= 4,
    phases: [...new Set(tasks.map((t) => t.phase || "OPERATIONS"))],
    prerequisites: level === 1 ? [] : [`mission-${level - 1}`],
    duration: 180,
    expectedMinutes: "15–30 min · first flight target",
    funding: 100,
    reward: 110,
    optional: [],
    unlocks: [],
    ...extra,
  };
}
export const missions: MissionDefinition[] = [
  full(
    1,
    "training",
    "Orbital Qualification",
    "earth",
    [
      ...launch(),
      ...phase("ORBITAL QUALIFICATION", [
        use("science", "Map the ocean calibration target.", "science"),
        decision("Choose the orbital power plan.", "power", undefined, [
          {
            action: "powerSafe",
            title: "Conserve power",
            detail: "Save 0.10 kWh; take a lower-yield observation.",
          },
          {
            action: "powerScience",
            title: "Run the high-resolution observation",
            detail: "Spend 0.16 kWh for 20 extra science.",
          },
        ]),
        ...meals(),
        use("sleep", "Begin a short recovery break.", "sleep", "REST"),
        wait("Finish the recovery break.", 10, "sleep"),
        task("REST", "Wake for the final systems check.", undefined, "wake"),
        powerDecision(),
        use("science", "Validate the recovered science channel.", "science"),
      ]),
      ...returnHome(),
    ],
    {
      description:
        "Qualify the explorer for independent operations. Fly an ascent, operate the cabin, resolve a power warning and bring the vehicle home.",
      majorObjective: "Launch, qualify the spacecraft and recover safely.",
      funding: 80,
      reward: 110,
      experiments: ["Orbital calibration"],
      unlocks: ["highGain"],
      optional: [
        {
          id: "reserve",
          title: "Power discipline",
          description: "Recover with at least 70% battery reserve.",
          condition: "battery",
          value: 0.7,
          reward: 2,
        },
        {
          id: "package",
          title: "Extra calibration package",
          description:
            "At the science console, spend 0.10 kWh and crew energy on a second spectral calibration before returning.",
          action: "recoverPackage",
          site: "science",
          reward: 3,
        },
      ],
    },
  ),
  full(
    2,
    "training",
    "Satellite Repair",
    "earth",
    [
      ...launch(),
      ...phase("RENDEZVOUS", [
        use("communications", "Locate the disabled relay satellite.", "comms"),
        use("cockpit", "Match the satellite approach corridor.", "approach"),
        wait("Coast to the tethered work platform.", 18, "cockpit"),
        use(
          "power",
          "Read the satellite fault telemetry.",
          "diagnoseSatellite",
        ),
      ]),
      ...phase("EVA PREPARATION", evaOut()),
      ...phase("SATELLITE SERVICE", [
        use(
          "survey",
          "Inspect the relay power connector.",
          "diagnoseSatellite",
        ),
        use(
          "survey",
          "Replace the damaged satellite connector.",
          "repairSatellite",
          "REPAIR",
        ),
        use("survey", "Align and test the satellite radio.", "testSatellite"),
      ]),
      ...phase("EVA RETURN", evaReturn()),
      ...phase("CABIN RECOVERY", [powerDecision(), ...meals()]),
      ...returnHome(),
    ],
    {
      description:
        "A relay satellite has lost power and its downlink. Match its orbit and service it from a tethered EVA platform before returning to Earth.",
      majorObjective:
        "Restore an independent satellite and recover the service crew.",
      eva: true,
      requiredEquipment: ["suit", "repair"],
      funding: 100,
      reward: 125,
      experiments: ["Relay diagnostics"],
      unlocks: ["reserveBattery", "improvedSuit"],
      optional: [
        {
          id: "secondary",
          title: "Repair the backup antenna",
          description:
            "Outside at the satellite: spend a second spare part and 0.06 suit power to restore redundancy.",
          action: "repairSecondary",
          site: "survey",
          gear: "repair",
          reward: 4,
        },
        {
          id: "cleanEva",
          title: "EVA reserve",
          description:
            "Recover with at least 75% suit oxygen and battery remaining.",
          condition: "suit",
          value: 0.75,
          reward: 3,
        },
      ],
    },
  ),
  full(
    3,
    "lunar",
    "Lunar Science Landing",
    "moon",
    [
      ...launch(),
      ...travel(),
      ...phase("LUNAR APPROACH", [
        use("communications", "Receive the lunar landing clearance.", "comms"),
        use("cockpit", "Brake into the lunar approach corridor.", "approach"),
        wait("Track the descent corridor.", 16, "cockpit"),
        use(
          "cockpit",
          "Commit the fuel reserve to a controlled lunar landing.",
          "land",
        ),
      ]),
      ...phase("EVA PREPARATION", evaOut()),
      ...phase("GEOLOGICAL EXPEDITION", [
        use("survey", "Scan the landing-site geology.", "scan", "SCAN"),
        use("survey", "Measure the surface temperature.", "measureTemperature"),
        use("crater", "Collect a crater-rim rock sample.", "sample", "SAMPLE"),
        use(
          "crater",
          "Drill a labelled shallow subsurface sample.",
          "drill",
          "SAMPLE",
        ),
        use("survey", "Photograph the sample context.", "photo"),
      ]),
      ...phase("EVA RETURN", evaReturn()),
      ...phase("ASCENT PREPARATION", [powerDecision()]),
      ...returnHome(),
    ],
    {
      description:
        "Investigate a crater rim with independent surface measurements. Plan your reserves, land, sample two layers and return the samples for analysis.",
      majorObjective:
        "Return lunar rock and subsurface samples with contextual measurements.",
      eva: true,
      surface: true,
      requiredEquipment: [
        "suit",
        "scanner",
        "containers",
        "drill",
        "sensor",
        "camera",
      ],
      funding: 130,
      reward: 145,
      experiments: ["Geology", "Temperature", "Sample context"],
      unlocks: ["advancedSolar"],
      optional: [
        {
          id: "rare",
          title: "Distant survey sample",
          description:
            "Travel to the relay survey marker and recover a rare sample using containers. Costs suit power and reserve time.",
          action: "recoverPackage",
          site: "relay",
          gear: "containers",
          reward: 5,
        },
        {
          id: "fuel",
          title: "Propellant discipline",
          description: "Recover with more than 20 fuel units.",
          condition: "fuel",
          value: 20,
          reward: 2,
        },
      ],
    },
  ),
  full(
    4,
    "lunar",
    "Lunar Research Camp",
    "moon",
    [
      ...launch(),
      ...travel(),
      ...phase("LUNAR LANDING", [
        use("cockpit", "Brake into the camp delivery corridor.", "approach"),
        use("cockpit", "Land the research-camp cargo.", "land"),
      ]),
      ...phase("EVA PREPARATION", evaOut()),
      ...phase("CAMP ESTABLISHMENT", [
        decision(
          "Select the camp site after a local survey.",
          "camp",
          undefined,
          [
            {
              action: "selectCamp",
              title: "Sheltered instrument site",
              detail:
                "Lower environmental wear; camp solar operates at 80% output.",
            },
            {
              action: "alignSolar",
              title: "Exposed sunlit site",
              detail:
                "Full solar output; suit condition loses 4 points during setup.",
            },
          ],
        ),
        use(
          "camp",
          "Deploy the instrument shelter and work table.",
          "deployShelter",
          "DEPLOY",
        ),
        use("camp", "Deploy the camp solar array.", "deploySolar", "DEPLOY"),
        use("camp", "Connect the camp battery.", "deployBattery", "DEPLOY"),
        use(
          "camp",
          "Raise the communications antenna.",
          "deployAntenna",
          "DEPLOY",
        ),
        use(
          "camp",
          "Install the environmental sensor.",
          "deploySensor",
          "DEPLOY",
        ),
        use(
          "camp",
          "Deploy the sample-storage case.",
          "deployStorage",
          "DEPLOY",
        ),
        use("camp", "Run the first powered field experiment.", "experiment"),
        decision(
          "Restore the camp after a connector trip.",
          "camp",
          "campPower",
          [
            {
              action: "eventReset",
              title: "Repair the camp connector",
              detail: "Use 1 spare part to restore the solar/battery bus.",
            },
            {
              action: "eventReroute",
              title: "Use the emergency battery bypass",
              detail:
                "Lose 0.16 kWh of camp energy and restore service without a spare.",
            },
          ],
        ),
        use(
          "camp",
          "Confirm the recovered environmental experiment.",
          "experiment",
        ),
        use(
          "camp",
          "Transmit the camp commissioning results.",
          "campTransmit",
          "TRANSMIT",
        ),
      ]),
      ...phase("EVA RETURN", evaReturn()),
      ...returnHome(),
    ],
    {
      description:
        "Deliver and commission a temporary lunar field base. Choose a site, deploy real equipment, solve a power interruption and return after the station reports its first results.",
      majorObjective:
        "Establish and certify a powered, communicating lunar research camp.",
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
        "repair",
      ],
      funding: 150,
      reward: 155,
      experiments: ["Camp environment", "Power recovery"],
      optional: [
        {
          id: "recover",
          title: "Recover an abandoned instrument",
          description:
            "At the crater rim, use the toolkit to recover a damaged science package. Uses suit power and one spare.",
          action: "recoverPackage",
          site: "crater",
          gear: "repair",
          reward: 5,
        },
        {
          id: "reserve",
          title: "Leave a resilient power system",
          description: "Finish with at least 60% spacecraft battery.",
          condition: "battery",
          value: 0.6,
          reward: 2,
        },
      ],
    },
  ),
];
const future: [string, string, Destination][] = [
  ["Lunar Reconnaissance", "lunar", "moon"],
  ["Lunar Emergency Rescue", "lunar", "moon"],
  ["Mars Cargo Preparation", "mars", "mars"],
  ["Mars Transfer Mission", "mars", "mars"],
  ["Mars Surface Expedition", "mars", "mars"],
  ["Search for Subsurface Water", "mars", "mars"],
  ["Mars Research Camp", "mars", "mars"],
  ["Mars Camp Emergency", "mars", "mars"],
  ["Asteroid Rendezvous", "deep", "asteroid"],
  ["Low-Gravity Sampling", "deep", "asteroid"],
  ["Deep-Space Rescue", "deep", "deep-space"],
  ["Outer-System Expedition", "deep", "europa"],
];
future.forEach(([title, chapter, destination], i) =>
  missions.push(
    full(
      i + 5,
      chapter,
      title,
      destination,
      [task("INTERACT", "Mission operations under development.")],
      {
        implemented: false,
        description:
          "Planned mission — gameplay and destination assets are not implemented.",
        majorObjective: title,
        phases: ["PLANNED"],
        expectedMinutes: "Not playable",
      },
    ),
  ),
);
export const missionById = (id: string): MissionDefinition => {
  const m =
    missions.find((m) => m.id === id) || oldMissions.find((m) => m.id === id);
  if (!m) throw Error("Unknown mission: " + id);
  return m;
};

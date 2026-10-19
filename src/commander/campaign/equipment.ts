export const equipment = {
  scanner: {
    name: "Geological scanner",
    mass: 3,
    cost: 1.5,
    power: 0.02,
    category: "SCIENCE EQUIPMENT",
    description: "Scan a survey site for mineral and ice clues.",
  },
  containers: {
    name: "Sample containers",
    mass: 1,
    cost: 0.2,
    power: 0,
    category: "SAMPLES",
    description: "Carry up to six labelled rock or soil samples.",
  },
  drill: {
    name: "Portable drill",
    mass: 4,
    cost: 1.8,
    power: 0.04,
    category: "SCIENCE EQUIPMENT",
    description: "Collect a shallow subsurface sample.",
  },
  radiation: {
    name: "Radiation meter",
    mass: 0.8,
    cost: 0.4,
    power: 0.005,
    category: "SCIENCE EQUIPMENT",
    description: "Measure radiation at a field site.",
  },
  sensor: {
    name: "Environment sensor",
    mass: 1,
    cost: 0.5,
    power: 0.005,
    category: "SCIENCE EQUIPMENT",
    description: "Measure temperature and the local environment.",
  },
  camera: {
    name: "Field camera",
    mass: 1,
    cost: 0.6,
    power: 0.01,
    category: "SCIENCE EQUIPMENT",
    description: "Photograph targets on the surface.",
  },
  experiment: {
    name: "Experiment kit",
    mass: 3,
    cost: 1.2,
    power: 0.03,
    category: "SCIENCE EQUIPMENT",
    description: "Run field tests at the research station.",
  },
  repair: {
    name: "Repair toolkit",
    mass: 2,
    cost: 0.5,
    power: 0.01,
    category: "TOOLS",
    description: "Repair spacecraft or deployed field hardware.",
  },
  antenna: {
    name: "Portable antenna",
    mass: 2.5,
    cost: 1,
    power: 0.01,
    category: "MISSION ITEMS",
    description: "Connect a research camp to the spacecraft.",
  },
  solar: {
    name: "Camp solar array",
    mass: 5,
    cost: 2,
    power: 0,
    category: "MISSION ITEMS",
    description: "Generate up to 80 W at the research camp.",
  },
  battery: {
    name: "Camp power unit",
    mass: 4,
    cost: 1.3,
    power: 0,
    category: "MISSION ITEMS",
    description: "Store 0.5 kWh of field power.",
  },
  shelter: {
    name: "Research shelter",
    mass: 7,
    cost: 2,
    power: 0,
    category: "MISSION ITEMS",
    description:
      "An unpressurized shelter and work table for instruments. Stay suited.",
  },
  storage: {
    name: "Sample store",
    mass: 2,
    cost: 0.7,
    power: 0,
    category: "MISSION ITEMS",
    description: "Keep samples at the field base.",
  },
  suit: {
    name: "EVA suit",
    mass: 14,
    cost: 7,
    power: 0,
    category: "EVA EQUIPMENT",
    description:
      "A dedicated suit with oxygen, battery and radio. Not part of backpack capacity.",
  },
} as const;
export type EquipmentId = keyof typeof equipment;
export const PACK_CAPACITY = 28;
export const packMass = (items: EquipmentId[]) =>
  items.reduce((n, id) => n + (id === "suit" ? 0 : equipment[id].mass), 0);
export const packCost = (items: EquipmentId[]) =>
  items.reduce((n, id) => n + equipment[id].cost, 0);

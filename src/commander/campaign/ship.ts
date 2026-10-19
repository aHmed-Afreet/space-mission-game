import { missionById } from "./definitions";
import { environments } from "./environments";
import type { Session, Progress } from "./engine";
import { deck } from "../layout";
import {
  equipment,
  type EquipmentId,
  packMass,
  PACK_CAPACITY,
} from "./equipment";
export const doors = {
  flight: { name: "Flight-deck hatch", z: -4.35 },
  service: { name: "Engineering section hatch", z: -1.35 },
  habitation: { name: "Habitation section hatch", z: 2.35 },
} as const;
export type DoorId = keyof typeof doors;
export const lockers = {
  food: { name: "Food locker", area: "galley" },
  water: { name: "Water service cabinet", area: "galley" },
  equipment: { name: "Equipment locker", area: "equipment" },
  eva: { name: "EVA suit locker", area: "equipment" },
  repair: { name: "Repair cabinet", area: "equipment" },
  science: { name: "Science instrument cabinet", area: "science" },
  samples: { name: "Sample archive", area: "science" },
  emergency: { name: "Emergency supply cabinet", area: "equipment" },
  maintenance: { name: "Power maintenance panel", area: "power" },
  campPanel: { name: "Camp connector cover", area: "camp" },
} as const;
export type LockerId = keyof typeof lockers;
export const categories = [
  "hull",
  "power",
  "lifeSupport",
  "communications",
  "navigation",
  "propulsion",
  "science",
] as const;
export type Subsystem = (typeof categories)[number];
export type Condition = Record<Subsystem, number>;
export const nominalCondition = (): Condition =>
  Object.fromEntries(categories.map((k) => [k, 100])) as Condition;
export type FaultKind =
  | "bus"
  | "solar"
  | "comms"
  | "cooling"
  | "oxygen"
  | "water"
  | "sensor"
  | "navigation";
export const faultCatalog: Record<
  FaultKind,
  {
    name: string;
    system: Subsystem;
    level: "CAUTION" | "WARNING" | "EMERGENCY";
    isolation: string;
  }
> = {
  bus: {
    name: "Battery Bus B voltage unstable",
    system: "power",
    level: "CAUTION",
    isolation: "busB",
  },
  solar: {
    name: "Solar input regulator fault",
    system: "power",
    level: "CAUTION",
    isolation: "solar",
  },
  comms: {
    name: "Antenna feed interruption",
    system: "communications",
    level: "CAUTION",
    isolation: "radio",
  },
  cooling: {
    name: "Cooling controller fault",
    system: "lifeSupport",
    level: "WARNING",
    isolation: "cooling",
  },
  oxygen: {
    name: "Oxygen recycler offline",
    system: "lifeSupport",
    level: "WARNING",
    isolation: "oxygen",
  },
  water: {
    name: "Water recycler offline",
    system: "lifeSupport",
    level: "CAUTION",
    isolation: "water",
  },
  sensor: {
    name: "Science sensor calibration fault",
    system: "science",
    level: "CAUTION",
    isolation: "science",
  },
  navigation: {
    name: "Navigation computer warning",
    system: "navigation",
    level: "CAUTION",
    isolation: "navigation",
  },
};
export type Fault = {
  id: string;
  kind: FaultKind;
  diagnosed: boolean;
  repaired: boolean;
  verified: boolean;
  at: number;
};
export type ShipState = {
  doors: Record<DoorId, { open: boolean; readyAt: number }>;
  lockers: Record<LockerId, boolean>;
  stored: EquipmentId[];
  partsStored: number;
  switches: Record<string, boolean>;
  antenna: number;
  target: "earth" | "moon";
  setpoint: number;
  faults: Fault[];
  rng: number;
  nextFault: number;
  condition: Condition;
  equipment: Partial<Record<EquipmentId, number>>;
  messages: {
    at: number;
    source:
      | "MISSION CONTROL"
      | "SPACECRAFT SYSTEM"
      | "CREW ACTION"
      | "SCIENCE"
      | "ALERTS";
    text: string;
  }[];
  radioQueue: { due: number; text: string }[];
  storedSamples: Session["samples"];
};
export function newShip(
  gear: EquipmentId[],
  condition = nominalCondition(),
): ShipState {
  return {
    doors: {
      flight: { open: false, readyAt: 0 },
      service: { open: true, readyAt: 0 },
      habitation: { open: true, readyAt: 0 },
    },
    lockers: Object.fromEntries(
      Object.keys(lockers).map((k) => [k, false]),
    ) as Record<LockerId, boolean>,
    stored: [
      ...gear.filter((g) => g !== "suit"),
      ...(!gear.includes("repair") ? ["repair" as EquipmentId] : []),
    ],
    partsStored: 0,
    switches: {
      busA: true,
      busB: true,
      solar: true,
      science: true,
      radio: true,
      cooling: true,
      oxygen: true,
      water: true,
      navigation: true,
      emergency: false,
      maneuver: false,
    },
    antenna: 1,
    target: "earth",
    setpoint: 22,
    faults: [],
    rng: 123456789,
    nextFault: 180,
    condition: { ...condition },
    equipment: Object.fromEntries(gear.map((g) => [g, 100])),
    messages: [],
    radioQueue: [],
    storedSamples: [],
  };
}
export function nearLocker(s: Session, id: LockerId) {
  const a = lockers[id].area;
  const p = a === "camp" ? { x: 6, z: 26 } : deck[a];
  return Math.hypot(s.position.x - p.x, s.position.z - p.z) < 2;
}
export const equipmentLocker = (id: EquipmentId): LockerId =>
  id === "repair"
    ? "repair"
    : id === "suit"
      ? "eva"
      : [
            "scanner",
            "drill",
            "camera",
            "containers",
            "radiation",
            "sensor",
            "experiment",
          ].includes(id)
        ? "science"
        : "equipment";
export type WorldAction =
  | { kind: "door"; id: DoorId }
  | { kind: "locker"; id: LockerId }
  | { kind: "take" | "store"; id: EquipmentId }
  | {
      kind:
        "returnMeal" | "takeParts" | "storeParts" | "storeSamples" | "stowSuit";
    }
  | { kind: "retrieveSample"; id: string }
  | { kind: "switch"; id: string }
  | { kind: "antenna"; value: number }
  | { kind: "target"; value: "earth" | "moon" }
  | { kind: "temperature"; value: number }
  | { kind: "diagnose" | "repairFault" | "verifyFault"; id: string };
export function shipLog(
  s: Session,
  source: ShipState["messages"][number]["source"],
  text: string,
): Session {
  return {
    ...s,
    notice: text,
    world: {
      ...s.world,
      messages: [
        ...s.world.messages,
        { at: s.state.minutes, source, text },
      ].slice(-120),
    },
  };
}
export function worldAction(
  s: Session,
  a: WorldAction,
  now = Date.now(),
): Session {
  if (
    s.state.paused ||
    s.state.ended ||
    s.state.sleeping ||
    s.flight.status === "ascent"
  )
    return shipLog(
      s,
      "SPACECRAFT SYSTEM",
      "Controls secured while paused, sleeping or accelerating.",
    );
  let n: Session = {
    ...s,
    state: { ...s.state },
    pack: [...s.pack],
    world: structuredClone(s.world),
  };
  const fail = (msg: string) => shipLog(s, "SPACECRAFT SYSTEM", msg);
  if (a.kind === "door") {
    const d = doors[a.id];
    if (Math.abs(s.position.z - d.z) > 1.6 || Math.abs(s.position.x) > 1.5)
      return fail("Stand beside the section hatch.");
    if (s.world.doors[a.id].open && Math.abs(s.position.z - d.z) < 0.45)
      return fail("Clear the hatch opening before closing it.");
    n.world.doors[a.id] = {
      open: !s.world.doors[a.id].open,
      readyAt: now + 650,
    };
    return shipLog(
      n,
      "CREW ACTION",
      `${d.name} ${n.world.doors[a.id].open ? "opening" : "closing"}.`,
    );
  }
  if (a.kind === "locker") {
    if (!nearLocker(s, a.id))
      return fail("Access " + lockers[a.id].name + " locally.");
    n.world.lockers[a.id] = !s.world.lockers[a.id];
    return shipLog(
      n,
      "CREW ACTION",
      `${lockers[a.id].name} ${n.world.lockers[a.id] ? "opened" : "closed"}.`,
    );
  }
  if (a.kind === "take" || a.kind === "store") {
    const id = a.id,
      locker = equipmentLocker(id);
    if (!nearLocker(s, locker) || !s.world.lockers[locker])
      return fail("Open " + lockers[locker].name + " first.");
    if (a.kind === "take") {
      if (!s.world.stored.includes(id))
        return fail("That item is not in storage.");
      if (packMass([...s.pack, id]) > PACK_CAPACITY)
        return fail("The field pack is full.");
      n.world.stored = n.world.stored.filter((g) => g !== id);
      n.pack.push(id);
    } else {
      if (!s.pack.includes(id)) return fail("That item is not being carried.");
      n.pack = n.pack.filter((g) => g !== id);
      n.world.stored.push(id);
    }
    if (id === "repair") n.state.tools = a.kind === "take";
    return shipLog(
      n,
      "CREW ACTION",
      `${equipment[id].name} ${a.kind === "take" ? "taken" : "returned to storage"}.`,
    );
  }
  if (
    [
      "returnMeal",
      "takeParts",
      "storeParts",
      "storeSamples",
      "stowSuit",
    ].includes(a.kind)
  ) {
    const locker: LockerId =
      a.kind === "returnMeal"
        ? "food"
        : a.kind === "storeSamples"
          ? "samples"
          : a.kind === "stowSuit"
            ? "eva"
            : "repair";
    if (!nearLocker(s, locker) || !s.world.lockers[locker])
      return fail("Open " + lockers[locker].name + " first.");
    if (a.kind === "returnMeal") {
      if (s.state.meals < 1) return fail("No carried meal pack.");
      n.state.meals--;
      n.state.food++;
    }
    if (a.kind === "takeParts") {
      if (s.world.partsStored < 1) return fail("No stored spare parts.");
      n.world.partsStored--;
      n.state.parts++;
    }
    if (a.kind === "storeParts") {
      if (s.state.parts < 1) return fail("No carried spare parts.");
      n.world.partsStored++;
      n.state.parts--;
    }
    if (a.kind === "storeSamples") {
      if (!s.samples.length) return fail("No carried samples to archive.");
      n.world.storedSamples.push(...s.samples);
      n.samples = [];
    }
    if (a.kind === "stowSuit") {
      if (s.position.z > 7.7 || s.state.pressure < 90)
        return fail("The suit can only be removed in the pressurized cabin.");
      n.state.oxygen = Math.min(s.life.oxygen, s.state.oxygen + s.suit.oxygen);
      n.world.equipment.suit = s.suit.condition;
      n.suit = {
        ...s.suit,
        equipped: false,
        oxygen: 0,
        power: 0,
        oxygenChecked: false,
        powerChecked: false,
      };
    }
    return shipLog(n, "CREW ACTION", "Storage manifest updated.");
  }
  if (a.kind === "retrieveSample") {
    const sample = s.world.storedSamples.find((v) => v.id === a.id);
    if (!sample) return fail("That sample is no longer in storage.");
    const camp = sample.status === "Stored at camp";
    if (
      !nearLocker(s, camp ? "campPanel" : "samples") ||
      !s.world.lockers[camp ? "campPanel" : "samples"]
    )
      return fail("Open the local sample storage first.");
    if (
      !s.pack.includes("containers") ||
      s.samples.length >= 6 ||
      packMass(s.pack) +
        s.samples.reduce((sum, v) => sum + (v.mass || 0.42), 0) +
        (sample.mass || 0.42) >
        PACK_CAPACITY
    )
      return fail("Carry sample containers with sufficient free capacity.");
    n.world.storedSamples = n.world.storedSamples.filter((v) => v.id !== a.id);
    n.samples = [...s.samples, { ...sample, status: "Carried · labelled" }];
    if (camp) n.camp = { ...s.camp, samples: Math.max(0, s.camp.samples - 1) };
    return shipLog(
      n,
      "SCIENCE",
      "Sample retrieved without changing its collection record.",
    );
  }
  if (a.kind === "switch") {
    const id = a.id,
      area = ["radio"].includes(id)
        ? "communications"
        : ["navigation", "maneuver"].includes(id)
          ? "cockpit"
          : "power";
    if (
      Math.hypot(s.position.x - deck[area].x, s.position.z - deck[area].z) >
      1.85
    )
      return fail("Access the corresponding console.");
    if (!(id in n.world.switches)) return fail("Unknown circuit.");
    if (
      (id === "busA" || id === "busB") &&
      s.world.switches[id] &&
      !s.world.switches[id === "busA" ? "busB" : "busA"]
    )
      return fail("Keep one distribution bus connected.");
    n.world.switches[id] = !s.world.switches[id];
    return shipLog(
      n,
      "CREW ACTION",
      `${id.toUpperCase()} circuit ${n.world.switches[id] ? "ON" : "ISOLATED"}.`,
    );
  }
  if (a.kind === "antenna") {
    if (
      Math.hypot(
        s.position.x - deck.communications.x,
        s.position.z - deck.communications.z,
      ) > 1.85 ||
      a.value < 1 ||
      a.value > (s.design.counts.antenna || 0)
    )
      return fail("Select an installed antenna at Communications.");
    n.world.antenna = a.value;
    return shipLog(n, "CREW ACTION", "Antenna " + a.value + " selected.");
  }
  if (a.kind === "target") {
    if (
      Math.hypot(s.position.x - deck.cockpit.x, s.position.z - deck.cockpit.z) >
      1.85
    )
      return fail("Access Navigation.");
    n.world.target = a.value;
    return shipLog(n, "CREW ACTION", "Navigation target set: " + a.value);
  }
  if (a.kind === "temperature") {
    if (!nearLocker(s, "maintenance") || a.value < 18 || a.value > 26)
      return fail("Set 18–26 C at Life Support.");
    n.world.setpoint = a.value;
    return shipLog(
      n,
      "CREW ACTION",
      "Cabin temperature set to " + a.value + " C.",
    );
  }
  if (
    a.kind === "diagnose" ||
    a.kind === "repairFault" ||
    a.kind === "verifyFault"
  ) {
    const fault = n.world.faults.find((f) => f.id === a.id);
    if (!fault || fault.verified) return fail("No active fault selected.");
    const cat = faultCatalog[fault.kind];
    const area =
      cat.system === "communications"
        ? "communications"
        : cat.system === "navigation"
          ? "cockpit"
          : cat.system === "science"
            ? "science"
            : "power";
    if (
      Math.hypot(s.position.x - deck[area].x, s.position.z - deck[area].z) >
      1.85
    )
      return fail("Access the affected subsystem console.");
    if (a.kind === "diagnose") fault.diagnosed = true;
    if (a.kind === "repairFault") {
      if (
        !fault.diagnosed ||
        !s.world.lockers.maintenance ||
        s.world.switches[cat.isolation] ||
        (!s.state.tools && !s.pack.includes("repair")) ||
        s.state.parts < 1
      )
        return fail(
          "Diagnose the fault; open maintenance access, isolate its circuit and bring a toolkit plus spare part.",
        );
      if (fault.repaired)
        return fail(
          "Hardware replaced. Restore the circuit and verify operation.",
        );
      n.state.parts--;
      fault.repaired = true;
    }
    if (a.kind === "verifyFault") {
      if (!fault.repaired || !s.world.switches[cat.isolation])
        return fail(
          "Repair the hardware and restore its circuit before testing.",
        );
      fault.verified = true;
      if (fault.kind === "bus") n.state.malfunction = false;
      n.world.condition[cat.system] = Math.min(
        100,
        n.world.condition[cat.system] + 10,
      );
    }
    return shipLog(
      n,
      "SPACECRAFT SYSTEM",
      `${cat.name}: ${a.kind === "diagnose" ? "diagnosed" : a.kind === "repairFault" ? "hardware replaced; verification required" : "verified operational"}.`,
    );
  }
  return n;
}
export function tickShip(s: Session, minutes: number): Session {
  let n = { ...s, world: structuredClone(s.world) };
  const w = n.world;
  if (
    s.flight.status === "orbit" &&
    s.state.minutes >= w.nextFault &&
    !w.faults.some((f) => !f.verified)
  ) {
    w.rng = (Math.imul(w.rng, 1664525) + 1013904223) >>> 0;
    w.nextFault = s.state.minutes + 180;
    const quality = Object.values(w.condition).reduce((a, b) => a + b, 0) / 7;
    if (
      w.rng / 4294967296 <
      0.1 +
        missionById(s.missionId).level * 0.015 +
        environments[missionById(s.missionId).destination].radiation * 0.002 +
        (100 - quality) / 160
    ) {
      const kinds = Object.keys(faultCatalog) as FaultKind[];
      const kind = kinds[(w.rng >>> 8) % kinds.length],
        id = "fault-" + s.state.minutes;
      w.faults.push({
        id,
        kind,
        diagnosed: false,
        repaired: false,
        verified: false,
        at: s.state.minutes,
      });
      w.condition[faultCatalog[kind].system] = Math.max(
        10,
        w.condition[faultCatalog[kind].system] - 12,
      );
      n = shipLog(
        n,
        "ALERTS",
        faultCatalog[kind].level + ": " + faultCatalog[kind].name,
      );
    }
  }
  for (const message of w.radioQueue.filter((m) => m.due <= s.state.minutes))
    n = shipLog(n, "MISSION CONTROL", message.text);
  n.world.radioQueue = w.radioQueue.filter((m) => m.due > s.state.minutes);
  return n;
}
export function service(p: Progress, system: Subsystem) {
  const condition = p.condition || nominalCondition(),
    cost = Math.round((100 - condition[system]) * 0.04 * 100) / 100;
  if (cost <= 0 || p.economy.balance < cost) return p;
  const balance = Math.round((p.economy.balance - cost) * 100) / 100;
  return {
    ...p,
    condition: { ...condition, [system]: 100 },
    economy: {
      ...p.economy,
      balance,
      ledger: [
        ...p.economy.ledger,
        {
          id: crypto.randomUUID(),
          label: "Service " + system,
          amount: -cost,
          balance,
        },
      ],
    },
  };
}
export function shipAlerts(s: Session) {
  const result: {
    level: "ADVISORY" | "CAUTION" | "WARNING" | "EMERGENCY";
    text: string;
  }[] = [];
  if (s.state.oxygen < 0.1 || s.state.pressure < 65)
    result.push({ level: "EMERGENCY", text: "Critical cabin life support" });
  else if (s.state.oxygen < 0.5 || s.state.temperature > 30)
    result.push({
      level: "WARNING",
      text: "Cabin reserves or temperature outside normal limits",
    });
  if (s.state.malfunction)
    result.push({ level: "CAUTION", text: "Power Bus B output unstable" });
  if (s.camp.broken)
    result.push({ level: "CAUTION", text: "Camp power connector fault" });
  for (const f of s.world.faults.filter((f) => !f.verified))
    result.push({
      level: faultCatalog[f.kind].level,
      text:
        faultCatalog[f.kind].name +
        (f.repaired ? " · verification required" : ""),
    });
  if (!s.world.switches.busB)
    result.push({
      level: "ADVISORY",
      text: "Bus B isolated; backup distribution in use",
    });
  return result;
}
export const equipmentServiceCost = (value: number) =>
  value >= 100 ? 0 : Math.max(0.02, Math.round((100 - value) * 2) / 100);
export function serviceEquipment(p: Progress, id: EquipmentId) {
  const values = p.equipmentCondition || {},
    value = values[id] ?? 100,
    cost = equipmentServiceCost(value);
  if (cost <= 0 || p.economy.balance < cost) return p;
  const balance = Math.round((p.economy.balance - cost) * 100) / 100;
  return {
    ...p,
    equipmentCondition: { ...values, [id]: 100 },
    economy: {
      ...p.economy,
      balance,
      ledger: [
        ...p.economy.ledger,
        {
          id: crypto.randomUUID(),
          label: "Service " + equipment[id].name,
          amount: -cost,
          balance,
        },
      ],
    },
  };
}

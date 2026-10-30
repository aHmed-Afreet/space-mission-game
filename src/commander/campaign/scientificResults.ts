import { missionForSession, type CampaignAction, type Site } from "./definitions";
import { atSite, outside, sitePosition, type Session } from "./engine";
import { equipment } from "./equipment";
import { environments } from "./environments";
import { fieldGear } from "./fieldTools";

const measurementActions: CampaignAction[] = ["measureTemperature", "measureRadiation", "scan", "science", "powerScience", "photo", "sample", "drill", "experiment", "inspectCamp", "selectCamp", "alignSolar", "repairCamp", "diagnoseSatellite", "repairSatellite", "testSatellite", "inspectPower", "inspectLife", "inspectScience", "inspectComms", "course"];
export type ScientificMeasurement = {
  id: string;
  modelVersion: 1;
  action: CampaignAction;
  instrument: string;
  quantity: string;
  target: string;
  site: string;
  minute: number;
  value: number;
  unit: string;
  uncertainty: number;
  quality: "nominal" | "degraded";
  calibration: { condition: number; control: string };
  assumptions: string[];
  sources: { title: string; url: string; role: "background-reference" }[];
  transmission: "onboard" | "queued" | "acknowledged";
  queuedAt?: number;
  acknowledgedAt?: number;
};
// This local hash never reads or advances the ship fault/event RNG or Math.random.
function instrumentNoise(key: string): number {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  return ((hash >>> 0) / 4294967295) * 2 - 1;
}
const round = (n: number) => Math.round(n * 1000) / 1000;
/** Capture only a newly successful operation. Loading an old flight never calls
 * this function, and legacy experiment names are never turned into readings. */
export function captureScientificResult(s: Session, action: CampaignAction): Session {
  const mission = missionForSession(s);
  const fieldSite = (["camp", "crater", "relay", "survey"] as Site[]).find(site => atSite(s, site));
  const site = outside(s)
    ? fieldSite ? sitePosition(fieldSite, mission.destination).name : "Field traverse"
    : action === "inspectPower" || action === "inspectLife" ? "Power & life support"
      : action === "course" ? "Flight deck" : action === "inspectComms" ? "Communications" : "Science laboratory";
  const item = fieldGear[action];
  const condition = item ? s.world.equipment[item] ?? 100 : s.world.condition.science;
  const noise = instrumentNoise(`${s.id}|${action}|${site}|${s.measurements?.length ?? 0}`);
  let instrument = item ? equipment[item].name : "Spacecraft payload instrument";
  let quantity = "", value = 0, unit = "", uncertainty = 0;
  let target = mission.surface ? "Lunar field target" : `${mission.destination} remote target`;
  let control = "Instrument self-check; no independent external calibration standard is modelled.";
  const assumptions = ["Synthetic training result, not a NASA observation or a flight prediction.", "Instrument noise uses an independent deterministic model; fault/event randomness is unchanged."];
  const source = mission.destination === "moon" ? "https://science.nasa.gov/moon/"
    : mission.destination === "mars" ? "https://science.nasa.gov/mars/"
      : mission.destination === "asteroid" ? "https://science.nasa.gov/solar-system/asteroids/"
        : "https://www.nasa.gov/international-space-station/";
  switch (action) {
    case "measureTemperature":
      quantity = "Surface contact temperature"; unit = "°C";
      value = environments[mission.destination].temperature + noise * (1 + (100 - condition) / 20);
      uncertainty = 1 + (100 - condition) / 20;
      assumptions.push(`Local target uses the fixed ${environments[mission.destination].temperature} °C scenario preset. Illumination is held constant; this is not a universal space or lunar temperature.`);
      control = "Contact sensor self-check; assumed fixed reference target. Surface, shadow and exposure variations are simplified.";
      break;
    case "measureRadiation":
      quantity = "Integrated radiation dose-rate proxy"; unit = "µSv/h";
      value = environments[mission.destination].radiation * 10 + noise * 2;
      uncertainty = 2 + (100 - condition) / 10;
      assumptions.push("60-second integration; assumed 0.3 µSv/h instrument background removed. Scenario index × 10 sets the synthetic dose-rate scale; no particle transport or actual dosimetry is modelled.");
      control = "Background subtraction and meter self-check; no external dosimeter calibration is modelled.";
      break;
    case "scan":
    case "science":
    case "powerScience":
      quantity = "Optical band ratio (850 / 550 nm)"; unit = "ratio";
      value = 0.65 + noise * 0.12 + (action === "powerScience" ? 0.02 : 0);
      uncertainty = (action === "powerScience" ? 0.02 : 0.05) + (100 - condition) / 1000;
      assumptions.push("Assumed normalized reflectance channels and fixed pointing; synthetic contrast cannot establish mineral identity or the presence of water.");
      control = "Assumed dark-frame subtraction and unity reference panel; no measured NASA spectrum is used.";
      break;
    case "photo":
      quantity = "Context exposure registered"; value = 1; unit = "frame";
      assumptions.push("Records a contextual field photograph event and location; no downloadable image or calibrated radiometry is produced.");
      break;
    case "sample":
    case "drill": {
      const sample = s.samples.at(-1);
      if (!sample) return s;
      quantity = "Labelled sample mass"; value = sample.mass ?? 0; unit = "kg";
      target = `${sample.kind} · ${sample.location ?? site}`;
      uncertainty = 0.01;
      instrument = action === "drill" ? "Portable drill / labelled container" : "Labelled sample container";
      assumptions.push(`Container ${sample.id}; mass follows the existing inventory model. ${action === "drill" ? "Assumed 10 cm shallow core; no geological depth profile is inferred." : "Surface grab sample; no unmeasured composition is inferred."}`);
      control = "Assumed container tare removed; mass is the tracked game inventory mass.";
      break;
    }
    case "experiment":
      quantity = "Camp experiment signal relative to control"; value = 1 + noise * 0.15; unit = "ratio"; uncertainty = 0.05 + (100 - condition) / 1000;
      assumptions.push("Unity synthetic control; fixed exposure; not a claim of a specific biological or geological detection.", `Camp battery remaining after the test: ${s.camp.power.toFixed(3)} kWh.`);
      break;
    case "inspectCamp":
    case "selectCamp":
    case "alignSolar":
    case "repairCamp":
      instrument = "Camp power telemetry"; quantity = "Stored camp energy"; value = s.camp.power; unit = "kWh"; target = "Research camp";
      assumptions.push(`Existing camp energy state; solar exposure factor ${s.systems.campExposure.toFixed(2)}; connector ${s.camp.broken ? "faulted" : "working"}. Watts are power, kWh is stored energy.`);
      break;
    case "diagnoseSatellite":
    case "repairSatellite":
    case "testSatellite":
      instrument = "Satellite connector / radio telemetry";
      quantity = action === "testSatellite" ? "Functional radio link" : "Connector continuity";
      value = action === "testSatellite" ? Number(s.systems.satelliteOnline) : Number(s.systems.satelliteRepaired);
      unit = "pass (1) / fail (0)"; target = "Orbital service target";
      assumptions.push("Derived from actual diagnostic, replacement and functional-test state. Electrical continuity and radio verification do not certify optical alignment.");
      break;
    case "inspectPower":
      instrument = "Power bus telemetry"; quantity = "Stored spacecraft energy"; value = s.state.battery; unit = "kWh"; target = "Spacecraft battery";
      assumptions.push(`Existing electrical state; power component condition ${s.world.condition.power.toFixed(1)}%; bus warning ${s.state.malfunction ? "active" : "clear"}.`);
      break;
    case "inspectLife":
      instrument = "Cabin thermal telemetry"; quantity = "Cabin temperature"; value = s.state.temperature; unit = "°C"; target = "Pressurized cabin";
      assumptions.push("Existing cabin thermal state; not exterior surface or empty-space temperature.");
      break;
    case "inspectScience":
      instrument = "Payload self-check"; quantity = "Science hardware condition"; value = s.world.condition.science; unit = "%"; target = "Payload electronics";
      assumptions.push("Condition index follows the existing maintenance model; percentage is not a calibrated probability of success.");
      break;
    case "inspectComms":
      instrument = "Radio telemetry"; quantity = "Earth link available"; value = Number(s.state.communications && s.world.switches.radio); unit = "available (1) / unavailable (0)"; target = "Earth link";
      assumptions.push("Availability is a simulation state, not received signal strength or a new range/delay estimate.");
      break;
    case "course":
      instrument = "Navigation telemetry"; quantity = "Vehicle altitude"; value = s.flight.altitude; unit = "km"; target = "Spacecraft trajectory";
      assumptions.push("Existing navigation altitude state; course correction consumes abstract game fuel, not a physical delta-v model.");
      break;
    default: return s;
  }
  const result: ScientificMeasurement = {
    id: `${s.id}-reading-${s.measurements?.length ?? 0}`, modelVersion: 1, action,
    instrument, quantity, target, site, minute: s.state.minutes, value: round(value), unit,
    uncertainty: round(uncertainty), quality: condition < 75 ? "degraded" : "nominal",
    calibration: { condition, control }, assumptions,
    sources: [{ title: "NASA mission/environment background (not the synthetic numeric data)", url: source, role: "background-reference" }],
    transmission: "onboard",
  };
  return { ...s, measurements: [...(s.measurements ?? []), result] };
}
export function queueScientificResults(s: Session): Session {
  if (!s.measurements?.length) return s;
  return { ...s, measurements: s.measurements.map(r => r.transmission === "onboard"
    ? { ...r, transmission: "queued", queuedAt: s.state.minutes } : r) };
}
export function acknowledgeScientificResults(s: Session): Session {
  if (!s.measurements?.some(r => r.transmission === "queued")) return s;
  return { ...s, measurements: s.measurements.map(r => r.transmission === "queued"
    ? { ...r, transmission: "acknowledged", acknowledgedAt: s.state.minutes } : r) };
}
export function validScientificMeasurement(value: unknown): value is ScientificMeasurement {
  if (!value || typeof value !== "object") return false;
  const v = value as ScientificMeasurement;
  const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
  const text = (s: unknown) => typeof s === "string" && s.length > 0;
  return v.modelVersion === 1 && measurementActions.includes(v.action) && [v.id, v.action, v.instrument, v.quantity, v.target, v.site, v.unit].every(text) &&
    finite(v.minute) && v.minute >= 0 && finite(v.value) && finite(v.uncertainty) && v.uncertainty >= 0 &&
    ["nominal", "degraded"].includes(v.quality) && !!v.calibration && finite(v.calibration.condition) &&
    v.calibration.condition >= 0 && v.calibration.condition <= 100 && text(v.calibration.control) &&
    Array.isArray(v.assumptions) && v.assumptions.length > 0 && v.assumptions.every(text) && Array.isArray(v.sources) && v.sources.length > 0 &&
    v.sources.every(s => !!s && text(s.title) && typeof s.url === "string" && /^https:\/\//.test(s.url) && s.role === "background-reference") &&
    ["onboard", "queued", "acknowledged"].includes(v.transmission) &&
    (v.queuedAt === undefined || finite(v.queuedAt) && v.queuedAt >= v.minute) &&
    (v.acknowledgedAt === undefined || finite(v.acknowledgedAt) && v.acknowledgedAt >= (v.queuedAt ?? v.minute)) &&
    (v.transmission === "onboard" || finite(v.queuedAt)) &&
    (v.transmission !== "acknowledged" || finite(v.acknowledgedAt));
}

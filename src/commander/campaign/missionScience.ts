import { BUDGET, components, rockets, type Design } from "../../game";
import type { Destination } from "./environments";

/**
 * Read-only teaching overlay. NASA references are observations/background;
 * the engine's mass/cost/fuel/power rules remain clearly labeled game models.
 * NEVER describe these estimates as real flight certification or predictions.
 */
export const scienceSources = {
  irradiance: "https://earth.gsfc.nasa.gov/climate/projects/solar-irradiance/science",
  moon: "https://science.nasa.gov/moon/by-the-numbers/",
  mars: "https://science.nasa.gov/mars/facts/",
  lightTime: "https://science.nasa.gov/mission/voyager/voyager-1/voyager-1-what-is-a-light-day/",
} as const;

export const EARTH_IRRADIANCE_W_M2 = 1361;
export const LIGHT_SPEED_KM_S = 299792.458;
export const MEAN_EARTH_MOON_DISTANCE_KM = 384400;
export const MARS_MEAN_SOLAR_DISTANCE_AU = 1.52;

export function relativeSolarFlux(distanceAu: number): number {
  if (!Number.isFinite(distanceAu) || distanceAu <= 0) throw Error("Heliocentric distance must be positive.");
  return 1 / (distanceAu * distanceAu);
}
export function oneWayLightTimeSeconds(distanceKm: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) throw Error("Distance cannot be negative.");
  return distanceKm / LIGHT_SPEED_KM_S;
}
export type ScienceReference = {
  name: string;
  solarDistanceAu: number | null;
  sunlightFraction: number | null;
  irradianceWm2: number | null;
  communication: string;
  gravity: string;
  sources: readonly string[];
  caveat: string;
};

export function scienceReference(destination: Destination): ScienceReference {
  if (destination === "mars") return {
    name:"Mars cruise / orbit", solarDistanceAu:MARS_MEAN_SOLAR_DISTANCE_AU,
    sunlightFraction:relativeSolarFlux(MARS_MEAN_SOLAR_DISTANCE_AU),
    irradianceWm2:EARTH_IRRADIANCE_W_M2*relativeSolarFlux(MARS_MEAN_SOLAR_DISTANCE_AU),
    communication:"Earth–Mars signal: approximately 3–22 minutes ONE WAY; varies with orbital position.",
    gravity:"Mars surface: about 3.71 m/s²; not spacecraft orbital acceleration.",
    sources:[scienceSources.irradiance,scienceSources.mars,scienceSources.lightTime],
    caveat:"Average Sun–Mars distance only; actual irradiance and radio delay vary with geometry.",
  };
  if (destination === "moon") return {
    name:"Moon",solarDistanceAu:1,sunlightFraction:1,
    irradianceWm2:EARTH_IRRADIANCE_W_M2,
    communication:`Earth–Moon radio: about ${oneWayLightTimeSeconds(MEAN_EARTH_MOON_DISTANCE_KM).toFixed(2)} seconds ONE WAY at mean distance.`,
    gravity:"Moon surface: 1.624 m/s² (NASA/JPL reference).",
    sources:[scienceSources.irradiance,scienceSources.moon,scienceSources.lightTime],
    caveat:"1 AU approximates the Earth–Moon system's distance from the Sun; local shadow and panel orientation matter.",
  };
  if (destination === "earth") return {
    name:"Earth orbit",solarDistanceAu:1,sunlightFraction:1,
    irradianceWm2:EARTH_IRRADIANCE_W_M2,
    communication:"Earth-orbit signal delay depends on orbit and ground-station geometry; no fixed value.",
    gravity:"Astronaut weightlessness is free fall, not the absence of Earth's gravity.",
    sources:[scienceSources.irradiance],
    caveat:"Orbital eclipses, sunlight angle, and solar-panel efficiency are not included.",
  };
  return {
    name:destination === "asteroid" ? "Asteroid survey" : destination === "europa" ? "Europa" : "Deep space",
    solarDistanceAu:null,sunlightFraction:null,irradianceWm2:null,
    communication:"No single signal delay: spacecraft distance and orbital geometry must be specified.",
    gravity:"Local acceleration depends on the specific body and trajectory; no universal value.",
    sources:[scienceSources.irradiance,scienceSources.lightTime],
    caveat:"An asteroid or a deep-space destination cannot be assigned one scientifically valid distance, gravity or sunlight level.",
  };
}

export type GameMetrics = { mass:number; cost:number; power:number; fuel:number };
export function designTradeoffs(destination: Destination, design: Design, metrics: GameMetrics) {
  const facts=scienceReference(destination);
  const selected=rockets[design.rocket];
  if (!selected) throw Error("Unknown rocket");
  const solar=components.find(c=>c.id==="solar")!;
  const count=Number(design.counts.solar||0);
  const arrayAtEarth=Math.max(0,count)*solar.power;
  const atDestination=facts.sunlightFraction===null ? null : arrayAtEarth*facts.sunlightFraction;
  const capacityMargin=selected.payload-metrics.mass;
  const budgetMargin=BUDGET-metrics.cost;
  const risks=[
    ...(capacityMargin<0?[`Reduce payload by at least ${Math.ceil(-capacityMargin)} kg or choose a larger launcher.`]:[]),
    ...(budgetMargin<0?[`Reduce estimated game spending by ${Math.ceil(-budgetMargin)} million credits.`]:[]),
    ...(metrics.power<10?["The game's power-margin check is below its 10 W minimum."]:[]),
    ...(metrics.fuel<10?["The game's fuel-reserve check is below its 10-unit minimum."]:[]),
  ];
  return {facts,capacityMargin,budgetMargin,arrayAtEarth,atDestination,risks,
    note: atDestination===null
      ? "Solar-array output cannot be extrapolated without specifying the target object's distance from the Sun."
      : `The same idealized array receives ~${(100*facts.sunlightFraction!).toFixed(0)}% of Earth-orbit sunlight at this destination. This is a teaching comparison, NOT the flight engine's electrical generation forecast.`};
}

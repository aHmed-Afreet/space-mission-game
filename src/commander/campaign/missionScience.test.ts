import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { designTradeoffs, relativeSolarFlux, oneWayLightTimeSeconds,
  scienceReference, scienceSources, EARTH_IRRADIANCE_W_M2,
  MEAN_EARTH_MOON_DISTANCE_KM, MARS_MEAN_SOLAR_DISTANCE_AU } from "./missionScience";
import type { Design } from "../../game";

const smallCraft: Design = {
  counts:{solar:1,spectrometer:1,battery:1,antenna:1,tank:1},
  rocket:0,trajectory:1,
};
const metrics={mass:740,cost:175,power:20,fuel:23};

test("Solar inverse-square comparison matches NASA reference assumptions",()=>{
  assert.equal(relativeSolarFlux(1),1);
  assert.ok(Math.abs(relativeSolarFlux(MARS_MEAN_SOLAR_DISTANCE_AU)-0.433)<0.001);
  assert.ok(Math.abs(scienceReference("mars").irradianceWm2! - 589.1)<1);
  assert.equal(scienceReference("moon").irradianceWm2,EARTH_IRRADIANCE_W_M2);
  assert.throws(()=>relativeSolarFlux(0));
  assert.throws(()=>relativeSolarFlux(-1));
  assert.throws(()=>relativeSolarFlux(Number.POSITIVE_INFINITY));
});

test("Moon signal delay is calculated using speed of light; Mars delays are a NASA range",()=>{
  assert.ok(Math.abs(oneWayLightTimeSeconds(MEAN_EARTH_MOON_DISTANCE_KM)-1.2822)<0.01);
  assert.match(scienceReference("moon").communication,/1\.28 seconds ONE WAY/);
  assert.match(scienceReference("mars").communication,/3–22 minutes ONE WAY/);
  assert.throws(()=>oneWayLightTimeSeconds(-4));
});

test("Unknown asteroid geometry never fabricates an exact sunlight or gravity measurement",()=>{
  for (const place of ["asteroid","deep-space","europa"] as const) {
    const science=scienceReference(place);
    assert.equal(science.irradianceWm2,null);
    assert.equal(science.sunlightFraction,null);
    assert.match(science.communication,/no single|No single/i);
  }
});

test("Live resource tradeoffs respond to mass, rocket, budget and panel choice without changing the flight engine",()=>{
  const mars=designTradeoffs("mars",smallCraft,metrics);
  assert.equal(mars.arrayAtEarth,85);
  assert.ok(mars.atDestination!>36 && mars.atDestination!<37);
  assert.equal(mars.capacityMargin,110);
  assert.equal(mars.budgetMargin,45);
  assert.equal(mars.risks.length,0);
  const extraMass=designTradeoffs("mars",smallCraft,{...metrics,mass:1000,cost:255,power:0,fuel:2});
  assert.equal(extraMass.capacityMargin,-150);
  assert.equal(extraMass.risks.length,4);
  const heavierLauncher=designTradeoffs("mars",{...smallCraft,rocket:2},{...metrics,mass:1000,cost:211});
  assert.ok(heavierLauncher.capacityMargin>0);
  assert.equal(heavierLauncher.risks.length,0);
  const asteroid=designTradeoffs("asteroid",smallCraft,metrics);
  assert.equal(asteroid.atDestination,null);
  assert.match(asteroid.note,/cannot be extrapolated/);
});

test("Evidence citations point to NASA and gameplay mounts the lab in BOTH interactive builders",()=>{
  for(const link of Object.values(scienceSources)) assert.match(link,/^https:\/\/(science\.nasa\.gov|earth\.gsfc\.nasa\.gov)\//);
  const component=readFileSync("src/commander/campaign/MissionEvidence.tsx","utf8");
  const strategy=readFileSync("src/App.tsx","utf8");
  const commander=readFileSync("src/commander/campaign/Preparation.tsx","utf8");
  assert.match(component,/facts\.sources\.map/);
  assert.match(component,/gameplay/);
  assert.match(strategy,/<MissionEvidence destination="mars"/);
  assert.match(commander,/<MissionEvidence destination=\{mission\.destination\}/);
});

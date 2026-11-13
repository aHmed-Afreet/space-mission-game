import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {greenhouseClimate} from "./outpost/greenhouseClimate";
import {initialOutpost,projectPower,forecast} from "./outpost/engine";

const source=readFileSync("src/outpost/Junior3D.tsx","utf8");
const css=readFileSync("src/outpost/world3d.css","utf8");

test("greenhouse displays a transparent read-only temperature tied to power and forecast",()=>{
  const moon=initialOutpost("moon");
  const original=structuredClone(moon);
  const normal=greenhouseClimate(moon);
  assert.equal(normal.temperatureC,22);
  assert.equal(normal.status,"NOMINAL");
  assert.match(normal.note,/Simulation only; not a live thermometer/);
  const night=greenhouseClimate({...moon,sol:5});
  assert.equal(forecast("moon",5).sunlight,0);
  assert.equal(night.temperatureC,21);
  const mars=initialOutpost("mars");
  assert.equal(greenhouseClimate({...mars,sol:4}).temperatureC,21);
  assert.ok(greenhouseClimate({...moon,battery:0}).temperatureC<normal.temperatureC);
  assert.ok(projectPower({...moon,battery:0}).projectedBattery<25);
  assert.equal(greenhouseClimate({...moon,priority:"crops"}).temperatureC,23);
  assert.deepEqual(moon,original,"temperature readout must not change mission resources or save data");
  assert.deepEqual(Object.keys(moon),Object.keys(original));
});

test("temperature is clearly labeled simulated, only in Greenhouse, and uses Celsius",()=>{
 assert.match(source,/room==="greenhouse"\?greenhouseClimate\(session\):null/);
 assert.match(source,/aria-label="Simulated greenhouse air temperature"/);
 assert.match(source,/GREENHOUSE CLIMATE · SIMULATED/);
 assert.match(source,/greenhouseTemperature\?\.temperatureC}°C/);
 assert.match(source,/HYDROPONICS · CURRENT CROP/);
});

test("iPad console uses a top-aligned 68svh safe-height with independently scrollable options",()=>{
 assert.match(source,/\(panel==="console"\|\|panel==="board"\|\|panel==="nasa"\|\|panel==="minigame"\|\|panel==="rover"\)\?" j3-overlay-console":""/);
 assert.match(css,/\.j3-overlay-console\{[\s\S]*?align-items:flex-start/);
 assert.match(css,/height:min\(620px,68svh,calc\(var\(--outpost-visible-height,100dvh\) - 136px\)\)/);
 assert.match(css,/\.j3-overlay-console \.j3-panel-console\{/);
 assert.match(css,/\.j3-panel-console \.j3-panel-content\{[\s\S]*?overflow-y:auto/);
 assert.match(css,/\.j3-panel-console \.j3-panel-footer\{[\s\S]*?flex:0 0 auto/);
 assert.match(css,/\.j3-panel-console \.j3-panel-footer button\{[\s\S]*?min-height:54px/);
 assert.match(css,/touch-action:manipulation/);
 assert.match(source,/RETURN TO 3D ROOM/);
 assert.match(source,/consoleOpenedAt\.current<450/);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resources, zero, events, type Design} from './game';
import {strategyStarter} from './strategyChallenges';
import {advanceStrategyEnergy, initialStrategyEnergy, launchStrategyEnergy, strategyPower, strategyResources,
  strategyEnergyIssues, strategyOutcome, strategyEnergyAssumptions, strategyReport} from './strategyEnergy';

test('planning batteries store finite Wh and leave the Commander legacy resources unchanged', () => {
  const batteryOnly: Design = {counts: {battery: 1, spectrometer: 1, antenna: 1}, rocket: 0, trajectory: 2};
  const without = {...batteryOnly, counts: {...batteryOnly.counts, battery: 0}};
  assert.equal(resources(batteryOnly).power - resources(without).power, 35, 'legacy Commander rating is unchanged');
  assert.equal(strategyPower(batteryOnly).generationW, strategyPower(without).generationW);
  assert.equal(strategyPower(batteryOnly).loadW, 60);
  const initial = initialStrategyEnergy(batteryOnly);
  assert.equal(initial.chargeWh, 140);
  const after2h = advanceStrategyEnergy(batteryOnly, zero, initial, 2);
  assert.equal(after2h.chargeWh, 100);
  assert.equal(after2h.unservedWh, 0);
  const after8h = advanceStrategyEnergy(batteryOnly, zero, after2h, 6);
  assert.equal(after8h.chargeWh, 0);
  assert.equal(after8h.unservedWh, 20);
  assert.equal(strategyResources(batteryOnly, zero, after8h).power, -20);
  assert.ok(strategyEnergyIssues(batteryOnly, zero, after8h).length);
});

test('battery discharge rating and surplus storage limits apply independently of energy capacity', () => {
  const heavy: Design = {counts: {battery: 1, spectrometer: 2, radar: 2, antenna: 2}, rocket: 2, trajectory: 2};
  const initial = initialStrategyEnergy(heavy);
  const after = advanceStrategyEnergy(heavy, zero, initial, 1);
  assert.equal(strategyPower(heavy).netW, -120);
  assert.equal(after.chargeWh, 105);
  assert.equal(after.unservedWh, 85, '140 Wh cannot bypass a 35 W output rating');
  const sunny = {...strategyStarter, counts: {...strategyStarter.counts, battery: 0}};
  const sun = advanceStrategyEnergy(sunny, zero, initialStrategyEnergy(sunny), 2);
  assert.equal(sun.chargeWh, 0);
  assert.ok(sun.spilledWh > 0);
  const full = advanceStrategyEnergy(strategyStarter, zero, initialStrategyEnergy(strategyStarter), 2);
  assert.equal(full.chargeWh, 140);
  assert.ok(full.spilledWh > 0);
  const depleted={...initialStrategyEnergy(strategyStarter),chargeWh:0};
  const charged=advanceStrategyEnergy(strategyStarter,zero,depleted,1);
  assert.equal(charged.chargeWh,35,'charging also has a finite power rating');
  assert.equal(charged.spilledWh,18);
});

test('generation plus initial battery energy equals loads plus final storage, spill and unmet demand', () => {
  for (const counts of [{solar: 1, battery: 1}, {solar: 0, battery: 1}, {solar: 2, battery: 0}]) {
    const design = {...strategyStarter, counts: {...strategyStarter.counts, ...counts}};
    const initial = initialStrategyEnergy(design);
    let state = launchStrategyEnergy(design);
    const delta = {...zero, power: -23};
    for (let i = 0; i < 3; i++) state = advanceStrategyEnergy(design, delta, state, strategyEnergyAssumptions.eventHours);
    assert.ok(Math.abs(state.elapsedHours - 2) < 1e-8);
    assert.ok(Math.abs(initial.chargeWh + state.generatedWh + state.unservedWh - state.consumedWh - state.chargeWh - state.spilledWh) < 1e-8);
  }
});

test('power events retain real load consequences with or without a battery and affect scoring when energy fails', () => {
  const event = events.find(event => event.id === 'power')!;
  const battery = strategyOutcome(event.choices[1], event, strategyStarter);
  const noBattery = strategyOutcome(event.choices[1], event, {...strategyStarter, counts: {...strategyStarter.counts, battery: 0}});
  assert.equal(battery.power, -15);
  assert.equal(noBattery.power, -15);
  assert.equal(strategyPower(strategyStarter, battery).loadW - strategyPower(strategyStarter).loadW, 15);
  const solar=events.find(event=>event.id==='solar')!;
  assert.equal(strategyOutcome(solar.choices[0],solar,strategyStarter,{...initialStrategyEnergy(strategyStarter),chargeWh:0}).science,-8,'an empty battery cannot preserve the safe-mode buffer');
  const state = {...launchStrategyEnergy(strategyStarter), unservedWh: 10};
  assert.equal(strategyReport(strategyStarter, zero, state).reliability, strategyReport(strategyStarter, zero, {...state, unservedWh: 0}).reliability - 25);
});

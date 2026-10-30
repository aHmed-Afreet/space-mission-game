import {test} from 'node:test';
import assert from 'node:assert/strict';
import {events, zero, addDelta} from './game';
import {strategyStarter, STRATEGY_SAVE_KEY, STRATEGY_RECEIPT_PREFIX, saveStrategyProgress, readStrategyProgressStrict} from './strategyChallenges';
import {initialStrategyEnergy, launchStrategyEnergy, strategyOutcome, strategyDecisionLog, advanceStrategyEnergy, strategyEnergyAssumptions} from './strategyEnergy';
import {STRATEGY_ATTEMPT_KEY, makeStrategyAttempt, parseStrategyAttempt, readStrategyAttempt, saveStrategyAttempt, type StrategyAttemptState} from './strategyAttempt';

const planning = (): StrategyAttemptState => ({stage: 2, challengeIndex: 0, design: structuredClone(strategyStarter), delta: {...zero}, deckIds: [],
  eventIndex: 0, progress: 0, log: [], briefAccepted: true, choices: [], energy: initialStrategyEnergy(strategyStarter)});
function memory(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {values, get length() {return values.size;}, key(index: number) {return [...values.keys()][index] ?? null;},
    getItem(key: string) {return values.get(key) ?? null;}, setItem(key: string, value: string) {values.set(key, value);}};
}
function decision(state: StrategyAttemptState, index: number) {
  const event = events.find(event => event.id === state.deckIds[state.choices.length])!, choice = event.choices[index];
  const impact = strategyOutcome(choice, event, state.design, state.energy), delta = addDelta(state.delta, impact);
  const choices = [...state.choices, index];
  return {...state, stage: choices.length === 3 ? 6 : 5, eventIndex: Math.min(choices.length, 2), choices, delta,
    log: [...state.log, strategyDecisionLog(event, choice, impact)],
    energy: advanceStrategyEnergy(state.design, delta, state.energy, strategyEnergyAssumptions.eventHours)};
}

test('Strategy attempts restore the actual design, drawn deck, chosen decisions, resource ledger and procedure stage', () => {
  const state = planning(), storage = memory();
  let bytes: string | null = null;
  const states = [state];
  states.push({...state, stage: 4, progress: 42, deckIds: ['power', 'solar', 'comms'], energy: launchStrategyEnergy(state.design)});
  states.push({...states[1], stage: 5, progress: 100});
  states.push(decision(states[2], 1));
  states.push(decision(states[3], 0));
  states.push(decision(states[4], 0));
  for (const current of states) {
    const attempt = makeStrategyAttempt('actual-flight', current);
    const saved = saveStrategyAttempt(storage, attempt, bytes);
    assert.equal(saved.saved, true);
    if (!saved.saved) throw Error('Expected the attempt to save');
    bytes = saved.bytes;
    assert.deepEqual(readStrategyAttempt(storage), {kind: 'ready', bytes, attempt});
    assert.deepEqual(parseStrategyAttempt(bytes), attempt);
    assert.equal(storage.getItem(STRATEGY_SAVE_KEY), null, 'an attempt never earns a completion');
  }
});

test('damaged resources, changed choices and unknown rule versions cannot overwrite recoverable attempts', () => {
  const attempt = makeStrategyAttempt('protected', planning());
  const corruptions = ['{', 'null', JSON.stringify({...attempt, version: 99}), JSON.stringify({...attempt, modelVersion: 99}),
    JSON.stringify({...attempt, energy: {...attempt.energy, chargeWh: 999}}),
    JSON.stringify({...attempt, resources: {...attempt.resources, cost: 0}}),
    JSON.stringify({...attempt, stage: 6, choices: [0, 0, 0]}),
    JSON.stringify({...attempt, design: {...attempt.design, counts: {...attempt.design.counts, battery: 99}}})];
  for (const bytes of corruptions) {
    const storage = memory({[STRATEGY_ATTEMPT_KEY]: bytes});
    assert.equal(readStrategyAttempt(storage).kind, 'error');
    assert.equal(saveStrategyAttempt(storage, attempt, bytes).saved, false);
    assert.equal(storage.getItem(STRATEGY_ATTEMPT_KEY), bytes);
  }
});

test('attempt read/write failures retain the old bytes, allow retry, and detect another tab', () => {
  const attempt = makeStrategyAttempt('retry', planning()), storage = memory();
  assert.equal(saveStrategyAttempt({...storage, getItem() {throw Error('Denied');}}, attempt, null).saved, false);
  assert.equal(storage.values.size, 0);
  assert.equal(saveStrategyAttempt({...storage, setItem() {throw Error('Full');}}, attempt, null).saved, false);
  assert.equal(storage.values.size, 0);
  const saved = saveStrategyAttempt(storage, attempt, null);
  assert.equal(saved.saved, true);
  if (!saved.saved) throw Error('Expected the attempt to save');
  storage.setItem(STRATEGY_ATTEMPT_KEY, JSON.stringify({...attempt, id: 'other-tab'}));
  const before = storage.getItem(STRATEGY_ATTEMPT_KEY);
  assert.equal(saveStrategyAttempt(storage, attempt, saved.bytes).saved, false);
  assert.equal(storage.getItem(STRATEGY_ATTEMPT_KEY), before);
});

test('authoritative best-score reads reject corrupt or future-format saves before any write', () => {
  for (const bytes of ['', '{', 'null', '[]', '{"version":99,"records":{}}', '{"strategy-1":101}', '{"strategy-1":"90"}']) {
    const storage = memory({[STRATEGY_SAVE_KEY]: bytes});
    assert.throws(() => readStrategyProgressStrict(storage));
    assert.equal(saveStrategyProgress({'strategy-1': 70}, storage).saved, false);
    assert.deepEqual([...storage.values], [[STRATEGY_SAVE_KEY, bytes]]);
  }
});

test('immutable Strategy best receipts recover higher and unrelated scores from interleaved tab summary writes', () => {
  const storage = memory({[STRATEGY_SAVE_KEY]: '{"strategy-1":40,"strategy-30":88.5}'});
  let interleaved = false;
  const tabA = {...storage, get length() {return storage.length;}, setItem(key: string, value: string) {
    if (!interleaved && key === STRATEGY_SAVE_KEY) {
      interleaved = true;
      assert.equal(saveStrategyProgress({'strategy-1': 95, 'strategy-2': 84}, storage).saved, true);
    }
    storage.setItem(key, value);
  }};
  assert.equal(saveStrategyProgress({'strategy-1': 60, 'strategy-3': 72}, tabA).saved, true);
  assert.equal(JSON.parse(storage.getItem(STRATEGY_SAVE_KEY)!)['strategy-1'], 60, 'summary race is reproduced');
  assert.deepEqual(readStrategyProgressStrict(storage), {'strategy-1': 95, 'strategy-2': 84, 'strategy-3': 72, 'strategy-30': 88.5});
  storage.setItem(`${STRATEGY_RECEIPT_PREFIX}strategy-4:77`, 'damaged');
  const bytes = storage.getItem(STRATEGY_SAVE_KEY);
  assert.equal(saveStrategyProgress({'strategy-4': 80}, storage).saved, false);
  assert.equal(storage.getItem(STRATEGY_SAVE_KEY), bytes);
});

test('all supported legacy Strategy record IDs and finite fractional scores survive the receipt upgrade',()=>{
  const legacy={'strategy-1':70,'strategy-0':1e-7,'strategy-001':88.5,'strategy-99':0};
  const storage=memory({[STRATEGY_SAVE_KEY]:JSON.stringify(legacy)});
  assert.equal(saveStrategyProgress({'strategy-2':65},storage).saved,true);
  assert.deepEqual(readStrategyProgressStrict(storage),{...legacy,'strategy-2':65});
});

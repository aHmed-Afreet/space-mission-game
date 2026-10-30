import {addDelta, events, zero, components, rockets, trajectories, type Design, type Delta} from './game';
import {strategyChallenges, strategyIssues, type StrategyStorage} from './strategyChallenges';
import {STRATEGY_MODEL_VERSION, strategyErrors, strategyResources, strategyOutcome, strategyChoiceEnabled, strategyDecisionLog,
  initialStrategyEnergy, launchStrategyEnergy, advanceStrategyEnergy, strategyEnergyAssumptions, type StrategyEnergy} from './strategyEnergy';

export const STRATEGY_ATTEMPT_KEY = 'orbital-strategy-attempt-v1';
export type StrategyAttemptState = {
  stage: number; challengeIndex: number; design: Design; delta: Delta;
  deckIds: string[]; eventIndex: number; progress: number; log: string[];
  briefAccepted: boolean; choices: number[]; energy: StrategyEnergy;
};
export type StrategyAttempt = StrategyAttemptState & {
  version: 1; modelVersion: typeof STRATEGY_MODEL_VERSION; id: string;
  resources: ReturnType<typeof strategyResources>;
};
export type StrategyAttemptRead = {kind: 'missing'; bytes: null} |
  {kind: 'ready'; bytes: string; attempt: StrategyAttempt} |
  {kind: 'error'; message: string};
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown, low: number, high: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= low && value <= high;
const same = (actual: unknown, expected: unknown): boolean => {
  if (typeof expected === 'number') return typeof actual === 'number' && Number.isFinite(actual) && Math.abs(actual - expected) < 1e-8;
  if (Array.isArray(expected)) return Array.isArray(actual) && actual.length === expected.length && expected.every((item, i) => same(actual[i], item));
  if (record(expected)) return record(actual) && Object.keys(actual).length === Object.keys(expected).length && Object.entries(expected).every(([key, value]) => same(actual[key], value));
  return actual === expected;
};

/** Replay validates stored outcomes; it never draws another event or manufactures
 * progress. Unknown rules/bytes are left intact until explicitly recovered. */
export function parseStrategyAttempt(bytes: string): StrategyAttempt {
  const x: unknown = JSON.parse(bytes);
  if (!record(x) || x.version !== 1 || x.modelVersion !== STRATEGY_MODEL_VERSION) throw Error('This saved attempt has an unsupported format or rule version. Its bytes were preserved.');
  if (typeof x.id !== 'string' || x.id.length < 1 || x.id.length > 160 || !integer(x.stage, 0, 6) ||
      !integer(x.challengeIndex, 0, strategyChallenges.length - 1) || !record(x.design) || !record(x.design.counts) ||
      !integer(x.design.rocket, 0, rockets.length - 1) || !integer(x.design.trajectory, 0, trajectories.length - 1) ||
      Object.entries(x.design.counts).some(([id, count]) => !components.some(c => c.id === id) || !integer(count, 0, 2)) ||
      !Array.isArray(x.deckIds) || !Array.isArray(x.choices) || x.choices.some(choice => !integer(choice, 0, 1)) ||
      typeof x.briefAccepted !== 'boolean' || !integer(x.progress, 0, 100) || !integer(x.eventIndex, 0, 2)) {
    throw Error('This saved attempt is incomplete or damaged. Its bytes were preserved.');
  }
  const design = x.design as Design, challenge = strategyChallenges[x.challengeIndex], deckIds = x.deckIds;
  let delta = {...zero}, energy = initialStrategyEnergy(design);
  const log: string[] = [];
  if (x.stage < 4) {
    if (x.deckIds.length || x.choices.length || x.eventIndex !== 0 || x.progress !== 0) throw Error('The saved planning stage contains inconsistent flight progress.');
  } else {
    if (x.deckIds.length !== 3 || new Set(x.deckIds).size !== 3 || x.deckIds.some(id => !events.some(event => event.id === id)) ||
        strategyErrors(design, challenge.budgetCap).length || strategyIssues(design, challenge).length ||
        (x.stage === 4 && (x.choices.length !== 0 || x.eventIndex !== 0)) ||
        (x.stage === 5 && (x.choices.length > 2 || x.eventIndex !== x.choices.length || x.progress !== 100)) ||
        (x.stage === 6 && (x.choices.length !== 3 || x.eventIndex !== 2 || x.progress !== 100))) throw Error('The saved flight procedure is inconsistent.');
    energy = launchStrategyEnergy(design);
    for (const [index, choiceIndex] of x.choices.entries()) {
      const event = events.find(event => event.id === deckIds[index])!, choice = event.choices[choiceIndex as number];
      if (!strategyChoiceEnabled(choice, design, delta, energy)) throw Error('A stored decision did not have the required resources.');
      const impact = strategyOutcome(choice, event, design, energy);
      delta = addDelta(delta, impact);
      energy = advanceStrategyEnergy(design, delta, energy, strategyEnergyAssumptions.eventHours);
      log.push(strategyDecisionLog(event, choice, impact));
    }
  }
  if (!same(x.delta, delta) || !same(x.energy, energy) || !same(x.log, log) || !same(x.resources, strategyResources(design, delta, energy))) {
    throw Error('Saved resources or decision records do not match this attempt. Its bytes were preserved.');
  }
  return x as StrategyAttempt;
}
export function makeStrategyAttempt(id: string, state: StrategyAttemptState): StrategyAttempt {
  return {...state, version: 1, modelVersion: STRATEGY_MODEL_VERSION, id,
    resources: strategyResources(state.design, state.delta, state.energy)};
}
export function readStrategyAttempt(storage: Pick<StrategyStorage, 'getItem'> | undefined): StrategyAttemptRead {
  try {
    if (!storage) throw Error('Browser storage is unavailable.');
    const bytes = storage.getItem(STRATEGY_ATTEMPT_KEY);
    return bytes === null ? {kind: 'missing', bytes: null} : {kind: 'ready', bytes, attempt: parseStrategyAttempt(bytes)};
  } catch (error) {return {kind: 'error', message: error instanceof Error ? error.message : 'The saved attempt could not be read.'};}
}
/** A compare-before-write guard detects another tab's attempt. localStorage is
 * not transactional; this guard is conservative and makes no atomicity claim. */
export function saveStrategyAttempt(storage: StrategyStorage | undefined, attempt: StrategyAttempt, expectedBytes: string | null) {
  try {
    const bytes = JSON.stringify(attempt);
    parseStrategyAttempt(bytes);
    const previous = readStrategyAttempt(storage);
    if (previous.kind === 'error') return {saved: false as const, message: previous.message};
    if (previous.bytes !== expectedBytes) return {saved: false as const, message: 'Another tab changed the saved attempt. Return to the level board to load it; your current session remains available.'};
    storage!.setItem(STRATEGY_ATTEMPT_KEY, bytes);
    return {saved: true as const, bytes};
  } catch (error) {return {saved: false as const, message: error instanceof Error ? error.message : 'This attempt could not be saved.'};}
}

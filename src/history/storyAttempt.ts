import { validStoryWorldSnapshot, type StoryWorldSnapshot } from "./storyWorld";
import type { StoryScenario } from "./storyScenarios";
import type { HistoryStorage } from "./historyProgress";
import { historyMissions } from "./missionHistory";
import { validateStoryScienceRecord, type StoryScienceRecord } from "./storyScience";
export const STORY_ATTEMPT_PREFIX = "orbital-story-attempt-v1:";
export type StoryProcedureSnapshot = {
 taskId: string; confirmed: boolean; powerVerified: boolean; telemetryVerified: boolean;
 operationArmed: boolean; measurement: boolean; interpretation: number | null;
};
export type StoryAttempt = {
 version: 1; missionId: string; runId: string; updatedAt: number; taskIds: string[];
 stage: number; completedTaskIds: string[]; logged: string[]; procedure: StoryProcedureSnapshot | null;
 suitEquipped: boolean; oxygen: number; hatchPrepared: boolean; world: StoryWorldSnapshot; scienceRecords: StoryScienceRecord[];
};
export type StoryAttemptRead = { kind: "missing" } | { kind: "valid"; attempt: StoryAttempt } | { kind: "invalid"; message: string } | { kind: "unavailable"; message: string };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const finite = (v: unknown, low: number, high: number) => typeof v === "number" && Number.isFinite(v) && v >= low && v <= high;
export function validateStoryAttempt(value: unknown, scenario: StoryScenario): value is StoryAttempt {
 if (!object(value) || value.version !== 1 || value.missionId !== scenario.missionId ||
  typeof value.runId !== "string" || !/^[a-zA-Z0-9-]{8,100}$/.test(value.runId) || !finite(value.updatedAt, 0, Number.MAX_SAFE_INTEGER) ||
  !Number.isInteger(value.stage) || !finite(value.stage, 0, scenario.tasks.length) ||
  !Array.isArray(value.taskIds) || JSON.stringify(value.taskIds) !== JSON.stringify(scenario.tasks.map(t => t.id)) ||
  !Array.isArray(value.completedTaskIds) || JSON.stringify(value.completedTaskIds) !== JSON.stringify(scenario.tasks.slice(0, value.stage as number).map(t => t.id)) ||
  !Array.isArray(value.logged) || JSON.stringify(value.logged) !== JSON.stringify(scenario.tasks.slice(0, value.stage as number).map(t => t.complete)) ||
  ![value.suitEquipped, value.hatchPrepared].every(x => typeof x === "boolean") || !finite(value.oxygen, 0, 100)) return false;
 const mission=historyMissions.find(m=>m.id===scenario.missionId);
 const scienceIds=scenario.tasks.filter(t=>t.station==="science").map(t=>t.id);
 if(!mission||!Array.isArray(value.scienceRecords)||value.scienceRecords.length>scienceIds.length||
  !value.scienceRecords.every(r=>validateStoryScienceRecord(r,mission,scienceIds))||
  new Set(value.scienceRecords.map(r=>(r as StoryScienceRecord).taskId)).size!==value.scienceRecords.length)return false;
 const w = value.world;
 if (!validStoryWorldSnapshot(w,scenario))return false;
 if (w.outside && (scenario.role !== "astronaut" || value.suitEquipped !== true)) return false;
 if (value.procedure !== null) {
  const p = value.procedure, task = scenario.tasks[value.stage as number];
  if (!object(p) || !task || task.fieldAction || p.taskId !== task.id ||
   ![p.confirmed, p.powerVerified, p.telemetryVerified, p.operationArmed, p.measurement].every(x => typeof x === "boolean") ||
   !(p.interpretation === null || p.interpretation === 0 || p.interpretation === 1)) return false;
 }
 return true;
}
export function readStoryAttempt(storage: HistoryStorage | undefined, scenario: StoryScenario): StoryAttemptRead {
 try {
  if (!storage) throw new Error("Browser storage is unavailable");
  const bytes = storage.getItem(STORY_ATTEMPT_PREFIX + scenario.missionId);
  if (bytes === null) return { kind: "missing" };
  const value: unknown = JSON.parse(bytes);
  return validateStoryAttempt(value, scenario) ? { kind: "valid", attempt: value } :
   { kind: "invalid", message: "The saved exercise uses an unsupported or damaged checkpoint. Its original bytes are retained; this session cannot replace it." };
 } catch {
  return { kind: "unavailable", message: "The saved exercise could not be read. Its original bytes are retained. Restore browser storage before saving this exercise." };
 }
}
export function saveStoryAttempt(storage: HistoryStorage | undefined, scenario: StoryScenario, attempt: StoryAttempt) {
 if (!validateStoryAttempt(attempt, scenario)) throw new Error("Exercise checkpoint is invalid");
 const previous = readStoryAttempt(storage, scenario);
 if (previous.kind === "invalid" || previous.kind === "unavailable") throw new Error(previous.message);
 if (previous.kind === "valid" && previous.attempt.runId !== attempt.runId && previous.attempt.stage < scenario.tasks.length) throw new Error("Another tab has a saved exercise for this mission. Its checkpoint was retained; continue in that tab.");
 if(previous.kind==="valid"&&previous.attempt.runId===attempt.runId&&previous.attempt.stage>attempt.stage)
  throw new Error("A newer checkpoint has already advanced this exercise. Its earned tasks were retained; resume the newer checkpoint.");
 storage!.setItem(STORY_ATTEMPT_PREFIX + scenario.missionId, JSON.stringify(attempt));
}

/** Remove an attempt only after its independent earned completion commit succeeds.
 * A different tab's replacement attempt is never deleted. Read errors preserve bytes.
 */
export function clearCompletedStoryAttempt(storage: (HistoryStorage & Partial<Pick<Storage,"removeItem">>) | undefined, scenario: StoryScenario, runId: string) {
 const saved=readStoryAttempt(storage,scenario);
 if(saved.kind==="invalid"||saved.kind==="unavailable")throw new Error(saved.message);
 if(saved.kind==="missing"||saved.attempt.runId!==runId)return;
 if(saved.attempt.stage!==scenario.tasks.length)throw new Error("The last exercise checkpoint is incomplete; its bytes were retained.");
 if(!storage?.removeItem)throw new Error("Browser storage cannot clear the completed exercise checkpoint");
 storage.removeItem(STORY_ATTEMPT_PREFIX+scenario.missionId);
}

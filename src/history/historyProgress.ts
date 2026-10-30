export const HISTORY_PROGRESS_KEY = "orbital-history-progress-v1";
export const HISTORY_RECEIPT_PREFIX = "orbital-history-best-v1:";
export type HistoryProgress = Record<string, number>;
export type HistoryStorage = Pick<Storage, "getItem" | "setItem"> & Partial<Pick<Storage, "key" | "length">>;
const validId = (id: string) => /^history-\d+$/.test(id);
const validScore = (value: unknown): value is 1 | 2 => value === 1 || value === 2;

export function mergeHistoryProgress(...records: HistoryProgress[]): HistoryProgress {
  const merged: HistoryProgress = {};
  for (const record of records) for (const [id, value] of Object.entries(record)) {
    if (validId(id) && validScore(value)) merged[id] = Math.max(merged[id] ?? 0, value);
  }
  return merged;
}

/** Authoritative reads fail closed. Display fallback must never authorize a write. */
export function readHistoryProgressStrict(storage: HistoryStorage | undefined): HistoryProgress {
  if (!storage) throw new Error("Browser storage is unavailable");
  const bytes = storage.getItem(HISTORY_PROGRESS_KEY);
  const value: unknown = bytes === null ? {} : JSON.parse(bytes);
  if (!value || Array.isArray(value) || typeof value !== "object" ||
      Object.entries(value).some(([id, score]) => !validId(id) || !validScore(score))) {
    throw new Error("Saved story progress has an unsupported format; its bytes were preserved");
  }
  const result = mergeHistoryProgress(value as HistoryProgress);
  // Immutable score receipts make concurrent tabs safe even without Web Locks.
  // The v1 object remains a compatible summary, not an atomic transaction.
  const ids = new Set([...Array.from({ length: 55 }, (_, i) => `history-${i + 1}`), ...Object.keys(result)]);
  if (storage.key && typeof storage.length === "number") for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(HISTORY_RECEIPT_PREFIX)) continue;
    const suffix = key.slice(HISTORY_RECEIPT_PREFIX.length);
    const match = /^(history-\d+):[12]$/.exec(suffix);
    if (!match) throw new Error("Saved story receipt has an unsupported format");
    ids.add(match[1]);
  }
  for (const id of ids) for (const score of [1, 2] as const) {
    const receipt = storage.getItem(`${HISTORY_RECEIPT_PREFIX}${id}:${score}`);
    if (receipt === null) continue;
    if (receipt !== "earned") throw new Error("Saved story receipt is unreadable; its bytes were preserved");
    result[id] = Math.max(result[id] ?? 0, score);
  }
  return result;
}

export function readHistoryProgress(storage?: HistoryStorage): HistoryProgress {
  try { return readHistoryProgressStrict(storage); } catch { return {}; }
}

/** Persist immutable earned receipts before updating the legacy summary.
 * Concurrent writers can overwrite the summary, but cannot erase another score.
 * All authoritative reads finish before the first mutation. Failed reads never write.
 */
export function saveHistoryProgress(storage: HistoryStorage | undefined, current: HistoryProgress, id: string, value: 1 | 2) {
  if (!validId(id) || !validScore(value)) throw new Error("Invalid story completion");
  const stored = readHistoryProgressStrict(storage);
  const next = mergeHistoryProgress(stored, current, { [id]: value });
  for (const [earnedId, score] of Object.entries(next)) {
    storage!.setItem(`${HISTORY_RECEIPT_PREFIX}${earnedId}:${score}`, "earned");
  }
  storage!.setItem(HISTORY_PROGRESS_KEY, JSON.stringify(next));
  return next;
}

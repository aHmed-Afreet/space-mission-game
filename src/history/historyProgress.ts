export const HISTORY_PROGRESS_KEY = "orbital-history-progress-v1";
export type HistoryProgress = Record<string, number>;
export type HistoryStorage = Pick<Storage, "getItem" | "setItem">;

export function readHistoryProgress(storage?: HistoryStorage): HistoryProgress {
  try {
    const value: unknown = JSON.parse(storage?.getItem(HISTORY_PROGRESS_KEY) || "{}");
    if (!value || Array.isArray(value) || typeof value !== "object") return {};
    return Object.fromEntries(Object.entries(value).filter(([id, v]) => /^history-\d+$/.test(id) && (v === 1 || v === 2)));
  } catch { return {}; }
}

/** Commit before acknowledging completion; a failed write never erases old records. */
export function saveHistoryProgress(storage: HistoryStorage | undefined, current: HistoryProgress, id: string, value: 1 | 2) {
  if (!storage) throw new Error("Browser storage is unavailable");
  const next = { ...readHistoryProgress(storage), ...current };
  next[id] = Math.max(next[id] || 0, value);
  storage.setItem(HISTORY_PROGRESS_KEY, JSON.stringify(next));
  return next;
}

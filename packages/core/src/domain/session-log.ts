import type { StoredRecord } from './profile.ts';

/** One profile's played minutes for one local calendar day (domain-model.md §2 `SessionLog`). */
export interface SessionLog extends StoredRecord {
  readonly profileId: string;
  /** Local calendar day (`YYYY-MM-DD`, device time zone — same format as `Streak.lastDay`). */
  readonly date: string;
  readonly minutes: number;
}

/** Fresh, unsaved log row for a profile's first recorded minutes on `date`. */
export function newSessionLog(
  id: string,
  profileId: string,
  date: string,
  minutes: number,
  now: Date,
): SessionLog {
  const nowIso = now.toISOString();
  return { id, profileId, date, minutes, createdAt: nowIso, updatedAt: nowIso };
}

/** Adds `minutes` to `existing` (same day), or starts a fresh row (`id` only used then). */
export function addMinutes(
  existing: SessionLog | undefined,
  id: string,
  profileId: string,
  date: string,
  minutes: number,
  now: Date,
): SessionLog {
  if (existing === undefined) {
    return newSessionLog(id, profileId, date, minutes, now);
  }
  return { ...existing, minutes: existing.minutes + minutes, updatedAt: now.toISOString() };
}

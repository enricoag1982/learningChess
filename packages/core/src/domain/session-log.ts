import type { StoredRecord } from './profile.ts';
import { localDayString } from './streak.ts';

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

/**
 * The last `days` local calendar days (`YYYY-MM-DD`, device time zone), oldest first, ending at
 * `now`'s own day (M5.1 parent report "minutes per day", M5.2's `minutesByDay` query). `days <= 0`
 * returns `[]`.
 */
export function lastNDays(now: Date, days: number): readonly string[] {
  const result: string[] = [];
  // Local calendar-field subtraction (not millisecond math): a day can be 23 or 25 hours across a
  // DST transition, same reasoning `domain/streak.ts`'s `daysBetween` documents for its own noon-UTC
  // approach; `Date`'s day-of-month rollover normalizes a negative day into the right earlier date.
  for (let i = days - 1; i >= 0; i -= 1) {
    result.push(localDayString(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)));
  }
  return result;
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

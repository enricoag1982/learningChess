import type { ProfileSettings } from './profile-settings.ts';
import type { StoredRecord } from './profile.ts';
import { localDayString } from './streak.ts';

/** Parent "more time" grant (M5.2, app-structure.md's time controls table): minutes added to the
 * daily limit each tap of "Parent: more time", once or repeatedly. */
export const EXTRA_TIME_GRANT_MINUTES = 15;

/** One profile's played minutes for one local calendar day (domain-model.md §2 `SessionLog`). */
export interface SessionLog extends StoredRecord {
  readonly profileId: string;
  /** Local calendar day (`YYYY-MM-DD`, device time zone — same format as `Streak.lastDay`). */
  readonly date: string;
  readonly minutes: number;
  /** Parent "more time" grants for this day (M5.2), on top of `ProfileSettings.dailyLimitMinutes`.
   * Absent = 0 — a pre-M5.2 row simply has none yet (same optional-field, no-migration pattern
   * `AppSettings.storagePersisted` uses, M5.4). */
  readonly extraMinutes?: number;
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

/**
 * Minutes played on `now`'s own local day (domain-model.md §3.3 daily limit). `0` without a row,
 * or when `log` is some other day's — a stale log (passed in by mistake, or simply never refreshed
 * since midnight) always reads back as "nothing today yet", so callers never need their own
 * explicit midnight-reset check.
 */
export function timeUsedToday(log: SessionLog | undefined, now: Date): number {
  if (log === undefined || log.date !== localDayString(now)) return 0;
  return log.minutes;
}

/** Extra minutes granted for `now`'s own local day (parent "more time", M5.2). `0` without a row,
 * or a stale one — same reasoning as {@link timeUsedToday}. */
export function extraMinutesToday(log: SessionLog | undefined, now: Date): number {
  if (log === undefined || log.date !== localDayString(now)) return 0;
  return log.extraMinutes ?? 0;
}

/**
 * `true` once today's played minutes reach the profile's daily limit plus any extra granted today
 * (app-structure.md's time controls table); always `false` with the limit off (`null`).
 */
export function isOverLimit(
  settings: Pick<ProfileSettings, 'dailyLimitMinutes'>,
  log: SessionLog | undefined,
  now: Date,
): boolean {
  if (settings.dailyLimitMinutes === null) return false;
  return timeUsedToday(log, now) >= settings.dailyLimitMinutes + extraMinutesToday(log, now);
}

/**
 * Parent "more time" (M5.2): adds `minutes` (the app layer always passes
 * {@link EXTRA_TIME_GRANT_MINUTES}) to today's grant, stored on the same `SessionLog` row as
 * played minutes — one row per profile + date, reusing M4.4's own record, no new port needed.
 */
export function grantExtraMinutes(
  existing: SessionLog | undefined,
  id: string,
  profileId: string,
  date: string,
  minutes: number,
  now: Date,
): SessionLog {
  if (existing === undefined) {
    return { ...newSessionLog(id, profileId, date, 0, now), extraMinutes: minutes };
  }
  return {
    ...existing,
    extraMinutes: (existing.extraMinutes ?? 0) + minutes,
    updatedAt: now.toISOString(),
  };
}

import type { ProfileSettings } from './profile-settings.ts';
import type { StoredRecord } from './profile.ts';
import { localDayString } from './streak.ts';

/** Parent "more time" grant (M5.2, app-structure.md's time controls table): minutes added to the
 * daily limit each tap of "Parent: more time", once or repeatedly. */
export const EXTRA_TIME_GRANT_MINUTES = 15;

/** Parent "more time" grant for the allowed-hours edge (M7.1, app-structure.md §13): a rolling
 * window from the moment of the grant, not additive like {@link EXTRA_TIME_GRANT_MINUTES} — each
 * tap resets `SessionLog.hoursOverrideUntil` to now plus this many minutes. */
export const HOURS_OVERRIDE_MINUTES = 15;

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
  /**
   * Parent "more time" for the allowed-hours edge (M7.1, app-structure.md §13 "Allowed hours"):
   * an ISO instant, set by "Parent: more time" from the late/early "See you tomorrow" screen —
   * allowed regardless of `playUntil`/`playFrom` until this instant. Absent = no override granted
   * today (every pre-M7.1 row).
   */
  readonly hoursOverrideUntil?: string;
  /** ISO instant the 5-minute warning (M7.1) was last spoken/shown for this day. Absent = not
   * warned yet today (every pre-M7.1 row) — `shouldWarn` shows it once per child per day. */
  readonly warnedAt?: string;
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
 * `now`'s own effective daily limit (M7.1, app-structure.md §13 "School days vs weekend limit"):
 * `weekendLimitMinutes` on a device-local Saturday/Sunday when set, else `dailyLimitMinutes` every
 * day — so a pre-M7.1 profile (`weekendLimitMinutes` absent) behaves exactly as before on every
 * day of the week.
 */
export function limitForDay(
  settings: Pick<ProfileSettings, 'dailyLimitMinutes' | 'weekendLimitMinutes'>,
  now: Date,
): number | null {
  const day = now.getDay(); // 0 = Sunday .. 6 = Saturday, device-local
  const isWeekend = day === 0 || day === 6;
  if (isWeekend && settings.weekendLimitMinutes !== undefined) {
    return settings.weekendLimitMinutes;
  }
  return settings.dailyLimitMinutes;
}

/**
 * `true` once today's played minutes reach {@link limitForDay}'s limit plus any extra granted
 * today (app-structure.md's time controls table); always `false` with that day's limit off (`null`).
 */
export function isOverLimit(
  settings: Pick<ProfileSettings, 'dailyLimitMinutes' | 'weekendLimitMinutes'>,
  log: SessionLog | undefined,
  now: Date,
): boolean {
  const limit = limitForDay(settings, now);
  if (limit === null) return false;
  return timeUsedToday(log, now) >= limit + extraMinutesToday(log, now);
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

/**
 * Parent "more time" for the allowed-hours edge (M7.1): sets `hoursOverrideUntil` to `now` plus
 * `minutes` (the app layer always passes {@link HOURS_OVERRIDE_MINUTES}) — a rolling window, so
 * repeated taps each reset it forward rather than stacking like {@link grantExtraMinutes}'s
 * additive daily-limit grant.
 */
export function setHoursOverride(
  existing: SessionLog | undefined,
  id: string,
  profileId: string,
  date: string,
  minutes: number,
  now: Date,
): SessionLog {
  const hoursOverrideUntil = new Date(now.getTime() + minutes * 60_000).toISOString();
  if (existing === undefined) {
    return { ...newSessionLog(id, profileId, date, 0, now), hoursOverrideUntil };
  }
  return { ...existing, hoursOverrideUntil, updatedAt: now.toISOString() };
}

/**
 * Marks the 5-minute warning (M7.1) shown for today, so {@link shouldWarn}
 * (`domain/time-policy.ts`) never shows it again the same day.
 */
export function markWarned(
  existing: SessionLog | undefined,
  id: string,
  profileId: string,
  date: string,
  now: Date,
): SessionLog {
  const warnedAt = now.toISOString();
  if (existing === undefined) {
    return { ...newSessionLog(id, profileId, date, 0, now), warnedAt };
  }
  return { ...existing, warnedAt, updatedAt: now.toISOString() };
}

import type { ProfileSettings } from './profile-settings.ts';
import type { StoredRecord } from './profile.ts';
import { localDayString } from './streak.ts';

/** Parent "more time" grant: minutes added to the daily limit each tap, once or repeatedly. */
export const EXTRA_TIME_GRANT_MINUTES = 15;

/** Parent "more time" grant for the allowed-hours edge: a rolling window from the moment of the
 * grant, not additive like {@link EXTRA_TIME_GRANT_MINUTES} — each tap resets
 * `SessionLog.hoursOverrideUntil` to now plus this many minutes. */
export const HOURS_OVERRIDE_MINUTES = 15;

/** One profile's played minutes for one local calendar day. */
export interface SessionLog extends StoredRecord {
  readonly profileId: string;
  /** Local calendar day (`YYYY-MM-DD`, device time zone — same format as `Streak.lastDay`). */
  readonly date: string;
  readonly minutes: number;
  /** Parent "more time" grants for this day, on top of `ProfileSettings.dailyLimitMinutes`.
   * Absent = 0 — an older row simply has none yet. */
  readonly extraMinutes?: number;
  /** Parent "more time" for the allowed-hours edge: an ISO instant, set from the late/early "See
   * you tomorrow" screen — allowed regardless of `playUntil`/`playFrom` until this instant. */
  readonly hoursOverrideUntil?: string;
  /** ISO instant the 5-minute warning was last spoken/shown for this day. Absent = not warned yet
   * today — `shouldWarn` shows it once per child per day. */
  readonly warnedAt?: string;
  /** Which device wrote this row (`AppSettings.deviceId`). Absent = this device's own legacy row.
   * An imported foreign device's row is a separate physical row, kept side by side so the two can
   * be summed (`totalMinutesForDate`) without either overwriting the other. */
  readonly deviceId?: string;
}

/** Fresh, unsaved log row for a profile's first recorded minutes on `date`. `deviceId` stamps this
 * device's own id onto a brand-new local row so a later export identifies it; omitted for an
 * imported foreign row or before this device has one yet. */
export function newSessionLog(
  id: string,
  profileId: string,
  date: string,
  minutes: number,
  now: Date,
  deviceId?: string,
): SessionLog {
  const nowIso = now.toISOString();
  return {
    id,
    profileId,
    date,
    minutes,
    createdAt: nowIso,
    updatedAt: nowIso,
    ...(deviceId === undefined ? {} : { deviceId }),
  };
}

/** The last `days` local calendar days (`YYYY-MM-DD`, device time zone), oldest first, ending at
 * `now`'s own day. `days <= 0` returns `[]`. */
export function lastNDays(now: Date, days: number): readonly string[] {
  const result: string[] = [];
  // Local calendar-field subtraction, not millisecond math: a day can be 23 or 25 hours across a
  // DST transition; `Date`'s day-of-month rollover normalizes a negative day to the right date.
  for (let i = days - 1; i >= 0; i -= 1) {
    result.push(localDayString(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)));
  }
  return result;
}

/** Adds `minutes` to `existing` (same day), or starts a fresh row (`id`/`deviceId` only used then —
 * `existing`, once created, keeps whichever `deviceId` it already has). */
export function addMinutes(
  existing: SessionLog | undefined,
  id: string,
  profileId: string,
  date: string,
  minutes: number,
  now: Date,
  deviceId?: string,
): SessionLog {
  if (existing === undefined) {
    return newSessionLog(id, profileId, date, minutes, now, deviceId);
  }
  return { ...existing, minutes: existing.minutes + minutes, updatedAt: now.toISOString() };
}

/** Sum of `minutes` across every row in `logs` for `date`: the daily limit, the parent report and
 * the 5-minute warning all read combined play across every device shared into this one. `0` with
 * no matching row. */
export function totalMinutesForDate(logs: readonly SessionLog[], date: string): number {
  return logs.filter((log) => log.date === date).reduce((sum, log) => sum + log.minutes, 0);
}

/** Minutes played on `now`'s own local day. `0` without a row, or a stale (other-day) one — so
 * callers never need their own explicit midnight-reset check. */
export function timeUsedToday(log: SessionLog | undefined, now: Date): number {
  if (log === undefined || log.date !== localDayString(now)) return 0;
  return log.minutes;
}

/** Extra minutes granted for `now`'s own local day. `0` without a row, or a stale one — same
 * reasoning as {@link timeUsedToday}. */
export function extraMinutesToday(log: SessionLog | undefined, now: Date): number {
  if (log === undefined || log.date !== localDayString(now)) return 0;
  return log.extraMinutes ?? 0;
}

/** `now`'s own effective daily limit: `weekendLimitMinutes` on a device-local Saturday/Sunday when
 * set, else `dailyLimitMinutes` every day. */
export function limitForDay(
  settings: Pick<ProfileSettings, 'dailyLimitMinutes' | 'weekendLimitMinutes'>,
  now: Date,
): number | null {
  const day = now.getDay(); // 0 = Sunday .. 6 = Saturday
  const isWeekend = day === 0 || day === 6;
  if (isWeekend && settings.weekendLimitMinutes !== undefined) {
    return settings.weekendLimitMinutes;
  }
  return settings.dailyLimitMinutes;
}

/** `true` once today's played minutes reach {@link limitForDay}'s limit plus any extra granted
 * today; always `false` with that day's limit off (`null`). */
export function isOverLimit(
  settings: Pick<ProfileSettings, 'dailyLimitMinutes' | 'weekendLimitMinutes'>,
  log: SessionLog | undefined,
  now: Date,
): boolean {
  const limit = limitForDay(settings, now);
  if (limit === null) return false;
  return timeUsedToday(log, now) >= limit + extraMinutesToday(log, now);
}

/** Parent "more time": adds `minutes` (the app layer always passes {@link EXTRA_TIME_GRANT_MINUTES})
 * to today's grant, stored on the same `SessionLog` row as played minutes. */
export function grantExtraMinutes(
  existing: SessionLog | undefined,
  id: string,
  profileId: string,
  date: string,
  minutes: number,
  now: Date,
  deviceId?: string,
): SessionLog {
  if (existing === undefined) {
    return { ...newSessionLog(id, profileId, date, 0, now, deviceId), extraMinutes: minutes };
  }
  return {
    ...existing,
    extraMinutes: (existing.extraMinutes ?? 0) + minutes,
    updatedAt: now.toISOString(),
  };
}

/** Parent "more time" for the allowed-hours edge: sets `hoursOverrideUntil` to `now` plus `minutes`
 * — a rolling window, so repeated taps reset it forward rather than stacking like
 * {@link grantExtraMinutes}. */
export function setHoursOverride(
  existing: SessionLog | undefined,
  id: string,
  profileId: string,
  date: string,
  minutes: number,
  now: Date,
  deviceId?: string,
): SessionLog {
  const hoursOverrideUntil = new Date(now.getTime() + minutes * 60_000).toISOString();
  if (existing === undefined) {
    return { ...newSessionLog(id, profileId, date, 0, now, deviceId), hoursOverrideUntil };
  }
  return { ...existing, hoursOverrideUntil, updatedAt: now.toISOString() };
}

/** Marks the 5-minute warning shown for today, so {@link shouldWarn} never shows it again the same day. */
export function markWarned(
  existing: SessionLog | undefined,
  id: string,
  profileId: string,
  date: string,
  now: Date,
  deviceId?: string,
): SessionLog {
  const warnedAt = now.toISOString();
  if (existing === undefined) {
    return { ...newSessionLog(id, profileId, date, 0, now, deviceId), warnedAt };
  }
  return { ...existing, warnedAt, updatedAt: now.toISOString() };
}

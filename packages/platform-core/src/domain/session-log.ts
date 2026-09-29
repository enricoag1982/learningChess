import type { ProfileSettings } from './profile-settings.ts';
import type { StoredRecord } from './profile.ts';
import { localDayString } from './streak.ts';

/** Parent "more time" grant: minutes added to the daily limit each tap, once or repeatedly. */
export const EXTRA_TIME_GRANT_MINUTES = 15;

/** Rolling window from the grant: each tap resets `SessionLog.hoursOverrideUntil` to now + this, unlike the
 * additive {@link EXTRA_TIME_GRANT_MINUTES}. */
export const HOURS_OVERRIDE_MINUTES = 15;

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
  /** Writing device (`AppSettings.deviceId`); absent = this device's legacy row. Imported foreign rows stay separate
   * so `totalMinutesForDate` can sum them. */
  readonly deviceId?: string;
}

/** Fresh row for a profile's first minutes on `date`; `deviceId` stamps this device's id (omitted for imported
 * foreign rows or before the device has one). */
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

/** The last `days` local days (`YYYY-MM-DD`), oldest first, ending today; `[]` for `days <= 0`. */
export function lastNDays(now: Date, days: number): readonly string[] {
  const result: string[] = [];
  // Local calendar-field subtraction, not millisecond math: a day can be 23 or 25 hours across a
  // DST transition; `Date`'s day-of-month rollover normalizes a negative day to the right date.
  for (let i = days - 1; i >= 0; i -= 1) {
    result.push(localDayString(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)));
  }
  return result;
}

/** Adds `minutes` to `existing` (same day) or starts a row (`id` / `deviceId` used only then). */
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

/** Combined minutes of every row for `date` (all devices), what the limit, report and warning read; `0` when none. */
export function totalMinutesForDate(logs: readonly SessionLog[], date: string): number {
  return logs.filter((log) => log.date === date).reduce((sum, log) => sum + log.minutes, 0);
}

/** Minutes played on `now`'s local day; `0` without a row or with a stale one, so callers need no midnight reset. */
export function timeUsedToday(log: SessionLog | undefined, now: Date): number {
  if (log === undefined || log.date !== localDayString(now)) return 0;
  return log.minutes;
}

/** Extra minutes granted on `now`'s local day; `0` without a row or with a stale one. */
export function extraMinutesToday(log: SessionLog | undefined, now: Date): number {
  if (log === undefined || log.date !== localDayString(now)) return 0;
  return log.extraMinutes ?? 0;
}

/** `weekendLimitMinutes` on a device-local Saturday/Sunday when set, else `dailyLimitMinutes`. */
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

/** True once today's minutes reach {@link limitForDay} plus extra granted; always false with the limit off (`null`). */
export function isOverLimit(
  settings: Pick<ProfileSettings, 'dailyLimitMinutes' | 'weekendLimitMinutes'>,
  log: SessionLog | undefined,
  now: Date,
): boolean {
  const limit = limitForDay(settings, now);
  if (limit === null) return false;
  return timeUsedToday(log, now) >= limit + extraMinutesToday(log, now);
}

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

/** Sets `hoursOverrideUntil` to `now` + `minutes`: a rolling window, repeated taps reset it rather than stack. */
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

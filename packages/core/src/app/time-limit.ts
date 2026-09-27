import {
  EXTRA_TIME_GRANT_MINUTES,
  extraMinutesToday,
  grantExtraMinutes,
  HOURS_OVERRIDE_MINUTES,
  isOverLimit,
  limitForDay,
  markWarned as markWarnedLog,
  newSessionLog,
  setHoursOverride,
  timeUsedToday,
  totalMinutesForDate,
} from '../domain/session-log.ts';
import type { SessionLog } from '../domain/session-log.ts';
import { localDayString } from '../domain/streak.ts';
import { allowedHoursReason, minutesUntilEnd } from '../domain/time-policy.ts';
import { getOrCreateDeviceId } from './device.ts';
import { getProfileSettings } from './settings.ts';
import type { AppDeps } from './use-cases.ts';

/** This device's own session-log row for `now`'s local day, with `minutes` replaced by the sum of
 * every device's row for that same profile + date: the daily limit, remaining-minutes count and
 * 5-minute warning read combined play, while `extraMinutes`/`hoursOverrideUntil`/`warnedAt` stay
 * this device's own (a parent's grant or warning is per device, never shared). */
export async function combinedSessionLog(
  deps: AppDeps,
  profileId: string,
  now: Date,
): Promise<SessionLog | undefined> {
  if (deps.rewards === undefined) return undefined;
  const date = localDayString(now);
  const [local, all] = await Promise.all([
    deps.rewards.getSessionLog(profileId, date),
    deps.rewards.listSessionLogs(profileId),
  ]);
  const minutes = totalMinutesForDate(all, date);
  if (local === undefined) {
    return minutes === 0 ? undefined : newSessionLog('', profileId, date, minutes, now);
  }
  return minutes === local.minutes ? local : { ...local, minutes };
}

/** Why the activity gate is blocking right now: over the daily limit, or outside the allowed-hours
 * window (too late / too early); `null` while none apply. */
export type TimeLimitReason = 'limit' | 'late' | 'early';

/** What the activity gate found: whether `profileId` is blocked right now, why, plus the numbers
 * the "See you tomorrow" screen and the parent area show. */
export interface TimeLimitStatus {
  /** `true` whenever `reason` is not `null`. */
  readonly overLimit: boolean;
  /** `null` = limit off, this device-local day (weekday vs weekend, `limitForDay`). */
  readonly limitMinutes: number | null;
  readonly usedMinutes: number;
  /** Parent "more time" already granted today, on top of `limitMinutes`. */
  readonly extraMinutes: number;
  /** Which boundary is blocking right now, or `null` while under every one of them. */
  readonly reason: TimeLimitReason | null;
  /** Minutes left before the nearest boundary (daily limit or `playUntil`), `null` when neither is
   * set — the 5-minute warning's own number, carried here so both read the same value. */
  readonly remainingMinutes: number | null;
  /** `ProfileSettings.playFrom` as read for this check, `null` if off/absent — the "Too early!"
   * screen's `{{time}}`. Carried here since the store's own copy only refreshes on profile select. */
  readonly playFrom: string | null;
}

/** Activity gate: reads the profile's settings and today's session log, and reports whether it is
 * blocked right now — over the daily limit, or outside allowed hours (hours checked first). A pure
 * read; permissive without `deps.rewards` wired up (reads as under limit, `usedMinutes: 0`). */
export async function checkActivityGate(
  deps: AppDeps,
  profileId: string,
): Promise<TimeLimitStatus> {
  const now = deps.clock.now();
  const settings = await getProfileSettings(deps, profileId);
  const log = await combinedSessionLog(deps, profileId, now);
  const hoursReason = allowedHoursReason(settings, now, log?.hoursOverrideUntil);
  const reason: TimeLimitReason | null =
    hoursReason ?? (isOverLimit(settings, log, now) ? 'limit' : null);
  return {
    overLimit: reason !== null,
    limitMinutes: limitForDay(settings, now),
    usedMinutes: timeUsedToday(log, now),
    extraMinutes: extraMinutesToday(log, now),
    reason,
    remainingMinutes: minutesUntilEnd(settings, log, now),
    playFrom: settings.playFrom ?? null,
  };
}

/** Parent "more time": grants {@link EXTRA_TIME_GRANT_MINUTES} more for today, on top of the daily
 * limit. Repeatable (each tap adds another); throws without `deps.rewards` wired up. */
export async function grantExtraTime(deps: AppDeps, profileId: string): Promise<SessionLog> {
  if (deps.rewards === undefined) {
    throw new Error('AppDeps.rewards is not wired up');
  }
  const now = deps.clock.now();
  const date = localDayString(now);
  const [existing, deviceId] = await Promise.all([
    deps.rewards.getSessionLog(profileId, date),
    getOrCreateDeviceId(deps),
  ]);
  const log = grantExtraMinutes(
    existing,
    deps.ids.next(),
    profileId,
    date,
    EXTRA_TIME_GRANT_MINUTES,
    now,
    deviceId,
  );
  await deps.rewards.saveSessionLog(log);
  return log;
}

/** Parent "more time" for a late/early gate: grants {@link HOURS_OVERRIDE_MINUTES} from now,
 * regardless of `playUntil`/`playFrom`. Repeatable (resets the window, does not stack); throws
 * without `deps.rewards` wired up. */
export async function grantHoursOverride(deps: AppDeps, profileId: string): Promise<SessionLog> {
  if (deps.rewards === undefined) {
    throw new Error('AppDeps.rewards is not wired up');
  }
  const now = deps.clock.now();
  const date = localDayString(now);
  const [existing, deviceId] = await Promise.all([
    deps.rewards.getSessionLog(profileId, date),
    getOrCreateDeviceId(deps),
  ]);
  const log = setHoursOverride(
    existing,
    deps.ids.next(),
    profileId,
    date,
    HOURS_OVERRIDE_MINUTES,
    now,
    deviceId,
  );
  await deps.rewards.saveSessionLog(log);
  return log;
}

/** Marks the 5-minute warning shown for today, so `shouldWarn` never shows it twice the same day.
 * Throws without `deps.rewards` wired up. */
export async function markTimeWarning(deps: AppDeps, profileId: string): Promise<SessionLog> {
  if (deps.rewards === undefined) {
    throw new Error('AppDeps.rewards is not wired up');
  }
  const now = deps.clock.now();
  const date = localDayString(now);
  const [existing, deviceId] = await Promise.all([
    deps.rewards.getSessionLog(profileId, date),
    getOrCreateDeviceId(deps),
  ]);
  const log = markWarnedLog(existing, deps.ids.next(), profileId, date, now, deviceId);
  await deps.rewards.saveSessionLog(log);
  return log;
}

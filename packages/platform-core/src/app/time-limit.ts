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

/** This device's row for `now`'s day with `minutes` replaced by the sum over all devices (limit, remaining count, warning
 * read combined play); `extraMinutes`/`hoursOverrideUntil`/`warnedAt` stay per device. */
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

/** Why the gate blocks: over the daily limit, or outside the allowed hours (too late / too early). */
export type TimeLimitReason = 'limit' | 'late' | 'early';

/** What the activity gate found: blocked or not, why, plus the numbers "See you tomorrow" and the parent area show. */
export interface TimeLimitStatus {
  readonly overLimit: boolean;
  /** `null` = limit off, this device-local day (weekday vs weekend, `limitForDay`). */
  readonly limitMinutes: number | null;
  readonly usedMinutes: number;
  readonly extraMinutes: number;
  readonly reason: TimeLimitReason | null;
  /** Minutes to the nearest boundary (daily limit or `playUntil`); `null` when neither is set; also the warning's number. */
  readonly remainingMinutes: number | null;
  /** `ProfileSettings.playFrom` as read for this check (the "Too early!" `{{time}}`); the store's copy only refreshes on profile select. */
  readonly playFrom: string | null;
}

/** Pure read: is the profile blocked now (hours are checked before the daily limit)? Permissive without `deps.rewards`
 * (under limit, `usedMinutes: 0`). */
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

async function updateTodaysLog(
  deps: AppDeps,
  profileId: string,
  update: (
    existing: SessionLog | undefined,
    date: string,
    now: Date,
    deviceId: string,
  ) => SessionLog,
): Promise<SessionLog> {
  if (deps.rewards === undefined) {
    throw new Error('AppDeps.rewards is not wired up');
  }
  const now = deps.clock.now();
  const date = localDayString(now);
  const [existing, deviceId] = await Promise.all([
    deps.rewards.getSessionLog(profileId, date),
    getOrCreateDeviceId(deps),
  ]);
  const log = update(existing, date, now, deviceId);
  await deps.rewards.saveSessionLog(log);
  return log;
}

/** Parent "more time": {@link EXTRA_TIME_GRANT_MINUTES} more today, repeatable; throws without `deps.rewards`. */
export function grantExtraTime(deps: AppDeps, profileId: string): Promise<SessionLog> {
  return updateTodaysLog(deps, profileId, (existing, date, now, deviceId) =>
    grantExtraMinutes(
      existing,
      deps.ids.next(),
      profileId,
      date,
      EXTRA_TIME_GRANT_MINUTES,
      now,
      deviceId,
    ),
  );
}

/** Parent "more time" at a late/early gate: {@link HOURS_OVERRIDE_MINUTES} from now, the window resets rather than stacks;
 * throws without `deps.rewards`. */
export function grantHoursOverride(deps: AppDeps, profileId: string): Promise<SessionLog> {
  return updateTodaysLog(deps, profileId, (existing, date, now, deviceId) =>
    setHoursOverride(
      existing,
      deps.ids.next(),
      profileId,
      date,
      HOURS_OVERRIDE_MINUTES,
      now,
      deviceId,
    ),
  );
}

/** Marks the 5-minute warning shown today; throws without `deps.rewards`. */
export function markTimeWarning(deps: AppDeps, profileId: string): Promise<SessionLog> {
  return updateTodaysLog(deps, profileId, (existing, date, now, deviceId) =>
    markWarnedLog(existing, deps.ids.next(), profileId, date, now, deviceId),
  );
}

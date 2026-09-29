import type { ProfileSettings } from './profile-settings.ts';
import type { SessionLog } from './session-log.ts';
import { extraMinutesToday, limitForDay, timeUsedToday } from './session-log.ts';
import { localDayString } from './streak.ts';

/** `'HH:MM'` -> minutes since local midnight. */
function hhmmToMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/** `now`'s own local time of day, in minutes since midnight. */
function nowMinutesOfDay(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

/** `true` while `overrideUntil` (an ISO instant) is set and still in the future. */
function overrideActive(overrideUntil: string | undefined, now: Date): boolean {
  return overrideUntil !== undefined && now.getTime() < Date.parse(overrideUntil);
}

/** Why `now` falls outside the allowed-hours window, or `null` while within it. A parent's hours
 * override lifts either edge until it expires. `playFrom` is inclusive, `playUntil` exclusive. */
export function allowedHoursReason(
  settings: Pick<ProfileSettings, 'playFrom' | 'playUntil'>,
  now: Date,
  overrideUntil?: string,
): 'late' | 'early' | null {
  if (overrideActive(overrideUntil, now)) return null;
  const nowMinutes = nowMinutesOfDay(now);
  if (settings.playFrom != null && nowMinutes < hhmmToMinutes(settings.playFrom)) return 'early';
  if (settings.playUntil != null && nowMinutes >= hhmmToMinutes(settings.playUntil)) return 'late';
  return null;
}

/** Minutes from `now` to today's `playUntil` edge (or to `overrideUntil` while it is active, since
 * that is the boundary actually in effect then); `null` while `playUntil` is off and no override
 * is active. Can be negative once the edge has already passed (the gate itself, not this helper,
 * decides what to do about that). */
function minutesUntilHoursEdge(
  playUntil: string | null | undefined,
  now: Date,
  overrideUntil?: string,
): number | null {
  if (overrideActive(overrideUntil, now)) {
    return Math.ceil((Date.parse(overrideUntil as string) - now.getTime()) / 60_000);
  }
  if (playUntil == null) return null;
  return hhmmToMinutes(playUntil) - nowMinutesOfDay(now);
}

/** Minutes left before either boundary ends today's play: the daily limit (incl. extra granted
 * today) and the allowed-hours `playUntil` edge, whichever comes first. `null` when both are off. */
export function minutesUntilEnd(
  settings: Pick<ProfileSettings, 'dailyLimitMinutes' | 'weekendLimitMinutes' | 'playUntil'>,
  log: SessionLog | undefined,
  now: Date,
): number | null {
  const limit = limitForDay(settings, now);
  const limitRemaining =
    limit === null ? null : limit + extraMinutesToday(log, now) - timeUsedToday(log, now);
  const hoursRemaining = minutesUntilHoursEdge(settings.playUntil, now, log?.hoursOverrideUntil);
  if (limitRemaining === null) return hoursRemaining;
  if (hoursRemaining === null) return limitRemaining;
  return Math.min(limitRemaining, hoursRemaining);
}

/** `true` once the 5-minute warning should show: `remainingMinutes` at or under 5 and still
 * positive, and not already shown today (a stale, not-today log's `warnedAt` never counts). */
export function shouldWarn(
  remainingMinutes: number | null,
  log: SessionLog | undefined,
  now: Date,
): boolean {
  if (remainingMinutes === null || remainingMinutes <= 0 || remainingMinutes > 5) return false;
  if (log !== undefined && log.date === localDayString(now) && log.warnedAt !== undefined) {
    return false;
  }
  return true;
}

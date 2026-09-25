import {
  EXTRA_TIME_GRANT_MINUTES,
  extraMinutesToday,
  grantExtraMinutes,
  isOverLimit,
  timeUsedToday,
} from '../domain/session-log.ts';
import type { SessionLog } from '../domain/session-log.ts';
import { localDayString } from '../domain/streak.ts';
import { getProfileSettings } from './settings.ts';
import type { AppDeps } from './use-cases.ts';

/** What the activity gate found (M5.2, domain-model.md §3.3): whether `profileId` is over its
 * daily limit right now, plus the numbers the "See you tomorrow" screen and the parent area show. */
export interface TimeLimitStatus {
  readonly overLimit: boolean;
  /** `null` = limit off (`ProfileSettings.dailyLimitMinutes`). */
  readonly limitMinutes: number | null;
  readonly usedMinutes: number;
  /** Parent "more time" already granted today, on top of `limitMinutes`. */
  readonly extraMinutes: number;
}

/**
 * Activity gate (domain-model.md §3.3 "checked between activities only"): reads the profile's
 * daily-limit setting and today's session log, and reports whether it is over the limit right now.
 * A pure read — callers decide what to do with `overLimit` (`apps/web`'s `store.ts` shows the
 * "See you tomorrow" screen instead of the activity/Home the kid was headed to). Permissive without
 * `deps.rewards` wired up (no session log to read — reads as under limit, `usedMinutes: 0`), same
 * reasoning `checkRewards`/`minutesByDay` already use.
 */
export async function checkActivityGate(
  deps: AppDeps,
  profileId: string,
): Promise<TimeLimitStatus> {
  const now = deps.clock.now();
  const settings = await getProfileSettings(deps, profileId);
  const log = await deps.rewards?.getSessionLog(profileId, localDayString(now));
  return {
    overLimit: isOverLimit(settings, log, now),
    limitMinutes: settings.dailyLimitMinutes,
    usedMinutes: timeUsedToday(log, now),
    extraMinutes: extraMinutesToday(log, now),
  };
}

/**
 * Parent "more time" (M5.2, app-structure.md's time controls table): grants
 * {@link EXTRA_TIME_GRANT_MINUTES} more for today, on top of the daily limit — the "See you
 * tomorrow" screen's parent-password flow calls this, then resumes the activity the kid was headed
 * to. Repeatable (each tap adds another {@link EXTRA_TIME_GRANT_MINUTES}); throws without
 * `deps.rewards` wired up (same pattern `recordSessionMinutes`/`requireRewards` use).
 */
export async function grantExtraTime(deps: AppDeps, profileId: string): Promise<SessionLog> {
  if (deps.rewards === undefined) {
    throw new Error('AppDeps.rewards is not wired up');
  }
  const now = deps.clock.now();
  const date = localDayString(now);
  const existing = await deps.rewards.getSessionLog(profileId, date);
  const log = grantExtraMinutes(
    existing,
    deps.ids.next(),
    profileId,
    date,
    EXTRA_TIME_GRANT_MINUTES,
    now,
  );
  await deps.rewards.saveSessionLog(log);
  return log;
}

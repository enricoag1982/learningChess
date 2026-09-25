import {
  EXTRA_TIME_GRANT_MINUTES,
  extraMinutesToday,
  grantExtraMinutes,
  HOURS_OVERRIDE_MINUTES,
  isOverLimit,
  limitForDay,
  markWarned as markWarnedLog,
  setHoursOverride,
  timeUsedToday,
} from '../domain/session-log.ts';
import type { SessionLog } from '../domain/session-log.ts';
import { localDayString } from '../domain/streak.ts';
import { allowedHoursReason, minutesUntilEnd } from '../domain/time-policy.ts';
import { getProfileSettings } from './settings.ts';
import type { AppDeps } from './use-cases.ts';

/** Why the activity gate is blocking right now (M7.1, app-structure.md §13): over the daily limit,
 * or outside the allowed-hours window (too late / too early); `null` while none apply. */
export type TimeLimitReason = 'limit' | 'late' | 'early';

/** What the activity gate found (M5.2/M7.1, domain-model.md §3.3): whether `profileId` is blocked
 * right now, why, plus the numbers the "See you tomorrow" screen and the parent area show. */
export interface TimeLimitStatus {
  /** `true` whenever `reason` is not `null` — kept for M5.2 callers that only ever cared about the
   * daily limit; `store.ts`'s `gated` still just reads this one field. */
  readonly overLimit: boolean;
  /** `null` = limit off, this device-local day (`domain/session-log.ts`'s `limitForDay` — weekday
   * vs weekend, M7.1). */
  readonly limitMinutes: number | null;
  readonly usedMinutes: number;
  /** Parent "more time" already granted today, on top of `limitMinutes`. */
  readonly extraMinutes: number;
  /** M7.1: which boundary is blocking right now, or `null` while under every one of them. */
  readonly reason: TimeLimitReason | null;
  /** M7.1: minutes left before the nearest boundary (daily limit or `playUntil`), `null` when
   * neither is set — the 5-minute warning's own number, also carried here so the gate and the
   * warning read the exact same value. */
  readonly remainingMinutes: number | null;
  /** M7.1: `ProfileSettings.playFrom` as read for this check, `null` if off/absent — the "Too
   * early!" screen's own `{{time}}`. Carried here (not read by the UI straight off
   * `activeProfileSettings`) because that store field only refreshes the next time the profile is
   * *selected* (`docs/app-structure.md` §11 "Settings effect now"), so it can be stale/default
   * while a parent's just-changed `playFrom` is exactly what blocked this very check. */
  readonly playFrom: string | null;
}

/**
 * Activity gate (domain-model.md §3.3 "checked between activities only"; M7.1 widens it to the
 * allowed-hours window, app-structure.md §13): reads the profile's settings and today's session
 * log, and reports whether it is blocked right now — over the daily limit, or outside allowed
 * hours (hours checked first: a kid outside the window is sent to bed even if a few minutes of
 * daily limit remain). A pure read — callers decide what to do with `overLimit`/`reason`
 * (`apps/web`'s `store.ts` shows the "See you tomorrow" screen instead of the activity/Home the
 * kid was headed to). Permissive without `deps.rewards` wired up (no session log to read — reads
 * as under limit, `usedMinutes: 0`), same reasoning `checkRewards`/`minutesByDay` already use.
 */
export async function checkActivityGate(
  deps: AppDeps,
  profileId: string,
): Promise<TimeLimitStatus> {
  const now = deps.clock.now();
  const settings = await getProfileSettings(deps, profileId);
  const log = await deps.rewards?.getSessionLog(profileId, localDayString(now));
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

/**
 * Parent "more time" for a late/early gate (M7.1, app-structure.md §13 "Allowed hours"): grants
 * {@link HOURS_OVERRIDE_MINUTES} from now, regardless of `playUntil`/`playFrom` — the "See you
 * tomorrow" screen's parent-password flow calls this instead of {@link grantExtraTime} when
 * `TimeLimitStatus.reason` is `'late'`/`'early'`, then resumes the activity the kid was headed to.
 * Repeatable (each tap resets the window another {@link HOURS_OVERRIDE_MINUTES} from now, it does
 * not stack); throws without `deps.rewards` wired up (same pattern `grantExtraTime` uses).
 */
export async function grantHoursOverride(deps: AppDeps, profileId: string): Promise<SessionLog> {
  if (deps.rewards === undefined) {
    throw new Error('AppDeps.rewards is not wired up');
  }
  const now = deps.clock.now();
  const date = localDayString(now);
  const existing = await deps.rewards.getSessionLog(profileId, date);
  const log = setHoursOverride(
    existing,
    deps.ids.next(),
    profileId,
    date,
    HOURS_OVERRIDE_MINUTES,
    now,
  );
  await deps.rewards.saveSessionLog(log);
  return log;
}

/**
 * Marks the 5-minute warning (M7.1, app-structure.md §13 "5-min warning") shown for today, so it
 * never shows twice the same day (`domain/time-policy.ts`'s `shouldWarn`). Throws without
 * `deps.rewards` wired up (same pattern `grantExtraTime` uses) — the notice layer only ever calls
 * this once `checkActivityGate`/`deps.rewards` have already confirmed a profile is playing.
 */
export async function markTimeWarning(deps: AppDeps, profileId: string): Promise<SessionLog> {
  if (deps.rewards === undefined) {
    throw new Error('AppDeps.rewards is not wired up');
  }
  const now = deps.clock.now();
  const date = localDayString(now);
  const existing = await deps.rewards.getSessionLog(profileId, date);
  const log = markWarnedLog(existing, deps.ids.next(), profileId, date, now);
  await deps.rewards.saveSessionLog(log);
  return log;
}

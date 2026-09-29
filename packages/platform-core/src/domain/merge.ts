import type { AssessmentResult, Unlock } from './assessment.ts';
import type { EarnedBadge } from './badges.ts';
import type { ProfileSettings } from './profile-settings.ts';
import type { Attempt, GameRecord, LessonProgress, MiniGameProgress, Stars } from './progress.ts';
import type { ConceptStats } from './review.ts';
import type { SessionLog } from './session-log.ts';
import { lastNDays, totalMinutesForDate } from './session-log.ts';
import type { Streak } from './streak.ts';

/** One profile's full backed-up data, merge-ready (`app/backup.ts`'s `ProfileBackupData`). */
export interface MergeableProfileData {
  readonly settings: ProfileSettings;
  readonly lessonProgress: readonly LessonProgress[];
  readonly attempts: readonly Attempt[];
  readonly miniGameProgress: readonly MiniGameProgress[];
  readonly conceptStats: readonly ConceptStats[];
  readonly gameRecords: readonly GameRecord[];
  readonly earnedBadges: readonly EarnedBadge[];
  readonly streak?: Streak;
  readonly sessionLogs: readonly SessionLog[];
  readonly assessmentResults: readonly AssessmentResult[];
  readonly unlocks: readonly Unlock[];
}

// Mirrors the web storage layer's own caps; duplicated here so `packages/core` never imports a web
// adapter constant.
const MAX_ATTEMPTS = 2000;
const MAX_GAME_RECORDS = 500;
const MAX_ASSESSMENT_RESULTS = 500;

function byCreatedAtAsc(
  a: { readonly createdAt: string },
  b: { readonly createdAt: string },
): number {
  return a.createdAt.localeCompare(b.createdAt);
}

// Union by `id`, later `updatedAt` wins a collision, then capped to `max` (oldest dropped first).
// Idempotent: re-union of the same `incoming` changes nothing.
function unionById<
  T extends { readonly id: string; readonly createdAt: string; readonly updatedAt: string },
>(local: readonly T[], incoming: readonly T[], max: number): T[] {
  const byId = new Map<string, T>();
  for (const item of local) byId.set(item.id, item);
  for (const item of incoming) {
    const existing = byId.get(item.id);
    if (existing === undefined || item.updatedAt > existing.updatedAt) {
      byId.set(item.id, item);
    }
  }
  const all = [...byId.values()].sort(byCreatedAtAsc);
  return all.length > max ? all.slice(all.length - max) : all;
}

/** Earliest of two optional ISO timestamps; the defined one if only one is set; `undefined` if neither is. */
function earliestDefined(a: string | undefined, b: string | undefined): string | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return a < b ? a : b;
}

function sameStringArray(
  a: readonly string[] | undefined,
  b: readonly string[] | undefined,
): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function mergeBestStars(
  a: Readonly<Record<string, 1 | 2 | 3>>,
  b: Readonly<Record<string, 1 | 2 | 3>>,
): Record<string, 1 | 2 | 3> {
  const result: Record<string, 1 | 2 | 3> = { ...a };
  for (const [exerciseId, stars] of Object.entries(b)) {
    if ((result[exerciseId] ?? 0) < stars) {
      result[exerciseId] = stars;
    }
  }
  return result;
}

function sameBestStars(
  a: Readonly<Record<string, 1 | 2 | 3>>,
  b: Readonly<Record<string, 1 | 2 | 3>>,
): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  return keysA.length === keysB.length && keysA.every((key) => a[key] === b[key]);
}

// bestStars/bossStars max, completedAt earliest, masteredVia kept if either has it,
// resumeStep/skippedPhases from whichever side has the newer updatedAt. Returns `local` unchanged
// when nothing differs, keeping repeated merges of the same `incoming` idempotent.
function mergeOneLessonProgress(
  local: LessonProgress,
  incoming: LessonProgress,
  now: Date,
): LessonProgress {
  const bestStars = mergeBestStars(local.bestStars, incoming.bestStars);
  const bossStars = Math.max(local.bossStars, incoming.bossStars) as Stars;
  const completedAt = earliestDefined(local.completedAt, incoming.completedAt);
  const masteredVia = local.masteredVia ?? incoming.masteredVia;
  const newer = local.updatedAt >= incoming.updatedAt ? local : incoming;
  const resumeStep = newer.resumeStep;
  const skippedPhases = newer.skippedPhases;

  const unchanged =
    sameBestStars(bestStars, local.bestStars) &&
    bossStars === local.bossStars &&
    completedAt === local.completedAt &&
    masteredVia === local.masteredVia &&
    resumeStep === local.resumeStep &&
    sameStringArray(skippedPhases, local.skippedPhases);
  if (unchanged) return local;

  return {
    ...local,
    bestStars,
    bossStars,
    completedAt,
    masteredVia,
    resumeStep,
    skippedPhases,
    updatedAt: now.toISOString(),
  };
}

/** A lesson id on only one side is kept as-is; one on both is combined ({@link mergeOneLessonProgress}). */
export function mergeLessonProgress(
  local: readonly LessonProgress[],
  incoming: readonly LessonProgress[],
  now: Date,
): LessonProgress[] {
  const localById = new Map(local.map((row) => [row.lessonId, row]));
  const incomingById = new Map(incoming.map((row) => [row.lessonId, row]));
  const result: LessonProgress[] = [];
  for (const [lessonId, localRow] of localById) {
    const incomingRow = incomingById.get(lessonId);
    result.push(
      incomingRow === undefined ? localRow : mergeOneLessonProgress(localRow, incomingRow, now),
    );
  }
  for (const [lessonId, incomingRow] of incomingById) {
    if (!localById.has(lessonId)) result.push(incomingRow);
  }
  return result;
}

// Best-of every field: bestStars/plays/wins max. Not additive — both sides may already include
// overlapping plays, so "best of both" avoids double-counting.
function mergeOneMiniGameProgress(
  local: MiniGameProgress,
  incoming: MiniGameProgress,
  now: Date,
): MiniGameProgress {
  const bestStars = Math.max(local.bestStars, incoming.bestStars) as Stars;
  const plays = Math.max(local.plays, incoming.plays);
  const wins = Math.max(local.wins, incoming.wins);
  if (bestStars === local.bestStars && plays === local.plays && wins === local.wins) return local;
  return { ...local, bestStars, plays, wins, updatedAt: now.toISOString() };
}

export function mergeMiniGameProgress(
  local: readonly MiniGameProgress[],
  incoming: readonly MiniGameProgress[],
  now: Date,
): MiniGameProgress[] {
  const localById = new Map(local.map((row) => [row.miniGameId, row]));
  const incomingById = new Map(incoming.map((row) => [row.miniGameId, row]));
  const result: MiniGameProgress[] = [];
  for (const [miniGameId, localRow] of localById) {
    const incomingRow = incomingById.get(miniGameId);
    result.push(
      incomingRow === undefined ? localRow : mergeOneMiniGameProgress(localRow, incomingRow, now),
    );
  }
  for (const [miniGameId, incomingRow] of incomingById) {
    if (!localById.has(miniGameId)) result.push(incomingRow);
  }
  return result;
}

// Whole-record pick (newer updatedAt wins): recent/box/dueAt/lastExerciseId describe one device's
// own review history, so mixing fields would not be a real history either device had.
function mergeOneConceptStats(local: ConceptStats, incoming: ConceptStats): ConceptStats {
  return incoming.updatedAt > local.updatedAt ? { ...incoming, id: local.id } : local;
}

export function mergeConceptStats(
  local: readonly ConceptStats[],
  incoming: readonly ConceptStats[],
): ConceptStats[] {
  const localById = new Map(local.map((row) => [row.conceptId, row]));
  const incomingById = new Map(incoming.map((row) => [row.conceptId, row]));
  const result: ConceptStats[] = [];
  for (const [conceptId, localRow] of localById) {
    const incomingRow = incomingById.get(conceptId);
    result.push(incomingRow === undefined ? localRow : mergeOneConceptStats(localRow, incomingRow));
  }
  for (const [conceptId, incomingRow] of incomingById) {
    if (!localById.has(conceptId)) result.push(incomingRow);
  }
  return result;
}

/** `"<badgeId>:<tier>"` — mirrors `domain/badges.ts`'s own private `earnedKey`. */
function earnedBadgeKey(badge: EarnedBadge): string {
  return `${badge.badgeId}:${badge.tier ?? ''}`;
}

/** Union by badge id: earliest `at`, `seen` true if either is (no second celebration for a badge
 * already seen on the other device). */
function mergeOneEarnedBadge(local: EarnedBadge, incoming: EarnedBadge): EarnedBadge {
  const at = local.at < incoming.at ? local.at : incoming.at;
  const seen = local.seen || incoming.seen;
  if (at === local.at && seen === local.seen) return local;
  return { ...local, at, seen };
}

export function mergeEarnedBadges(
  local: readonly EarnedBadge[],
  incoming: readonly EarnedBadge[],
): EarnedBadge[] {
  const localByKey = new Map(local.map((badge) => [earnedBadgeKey(badge), badge]));
  const incomingByKey = new Map(incoming.map((badge) => [earnedBadgeKey(badge), badge]));
  const result: EarnedBadge[] = [];
  for (const [key, localBadge] of localByKey) {
    const incomingBadge = incomingByKey.get(key);
    result.push(
      incomingBadge === undefined ? localBadge : mergeOneEarnedBadge(localBadge, incomingBadge),
    );
  }
  for (const [key, incomingBadge] of incomingByKey) {
    if (!localByKey.has(key)) result.push(incomingBadge);
  }
  return result;
}

/** `best` = max of both; `current`/`lastDay`/`skipsUsedThisWeek` taken together from whichever side
 * has the later `lastDay` (tie: higher `current`) since they describe one continuous run. */
export function mergeStreak(
  local: Streak | undefined,
  incoming: Streak | undefined,
): Streak | undefined {
  if (local === undefined) return incoming;
  if (incoming === undefined) return local;

  const localDay = local.lastDay ?? '';
  const incomingDay = incoming.lastDay ?? '';
  const newer =
    localDay !== incomingDay
      ? localDay > incomingDay
        ? local
        : incoming
      : local.current >= incoming.current
        ? local
        : incoming;

  const best = Math.max(local.best, incoming.best);
  if (newer === local && best === local.best) return local;
  return {
    ...local,
    current: newer.current,
    lastDay: newer.lastDay,
    skipsUsedThisWeek: newer.skipsUsedThisWeek,
    best,
  };
}

/** `undefined` sorts as "oldest": an empty string precedes every real ISO timestamp. */
function updatedAtOrOldest(value: string | undefined): string {
  return value ?? '';
}

/** Newest wins by `updatedAt` (missing = oldest, both missing → local): a parent's settings are one
 * coherent choice, not a field to combine. */
export function mergeProfileSettings(
  local: ProfileSettings,
  incoming: ProfileSettings,
): ProfileSettings {
  const localAt = updatedAtOrOldest(local.updatedAt);
  const incomingAt = updatedAtOrOldest(incoming.updatedAt);
  return incomingAt > localAt ? incoming : local;
}

// Keyed by (date, deviceId) so a re-import never double-counts; a row with no deviceId is treated
// as that side's own legacy row, never merged with the other side's. Larger minutes/extraMinutes,
// later hoursOverrideUntil/warnedAt win within a matching pair.
function sessionLogKey(log: SessionLog): string {
  return `${log.date}:${log.deviceId ?? `legacy:${log.id}`}`;
}

function mergeOneSessionLog(local: SessionLog, incoming: SessionLog, now: Date): SessionLog {
  const minutes = Math.max(local.minutes, incoming.minutes);
  const extraMinutes = Math.max(local.extraMinutes ?? 0, incoming.extraMinutes ?? 0);
  const hoursOverrideUntil =
    (local.hoursOverrideUntil ?? '') > (incoming.hoursOverrideUntil ?? '')
      ? local.hoursOverrideUntil
      : incoming.hoursOverrideUntil;
  const warnedAt =
    (local.warnedAt ?? '') > (incoming.warnedAt ?? '') ? local.warnedAt : incoming.warnedAt;
  const unchanged =
    minutes === local.minutes &&
    extraMinutes === (local.extraMinutes ?? 0) &&
    hoursOverrideUntil === local.hoursOverrideUntil &&
    warnedAt === local.warnedAt;
  if (unchanged) return local;
  return {
    ...local,
    minutes,
    ...(extraMinutes === 0 ? {} : { extraMinutes }),
    ...(hoursOverrideUntil === undefined ? {} : { hoursOverrideUntil }),
    ...(warnedAt === undefined ? {} : { warnedAt }),
    updatedAt: now.toISOString(),
  };
}

export function mergeSessionLogs(
  local: readonly SessionLog[],
  incoming: readonly SessionLog[],
  now: Date,
): SessionLog[] {
  const localByKey = new Map(local.map((log) => [sessionLogKey(log), log]));
  const incomingByKey = new Map(incoming.map((log) => [sessionLogKey(log), log]));
  const result: SessionLog[] = [];
  for (const [key, localLog] of localByKey) {
    const incomingLog = incomingByKey.get(key);
    result.push(
      incomingLog === undefined ? localLog : mergeOneSessionLog(localLog, incomingLog, now),
    );
  }
  for (const [key, incomingLog] of incomingByKey) {
    if (!localByKey.has(key)) result.push(incomingLog);
  }
  return result;
}

/** Union by `targetType:targetId`: an unlock has no field worth combining, only whether it exists. */
export function mergeUnlocks(local: readonly Unlock[], incoming: readonly Unlock[]): Unlock[] {
  const byKey = new Map(local.map((unlock) => [`${unlock.targetType}:${unlock.targetId}`, unlock]));
  for (const unlock of incoming) {
    const key = `${unlock.targetType}:${unlock.targetId}`;
    if (!byKey.has(key)) byKey.set(key, unlock);
  }
  return [...byKey.values()];
}

/** Merges one profile's full backed-up data. `local`/`incoming` must already share the same target
 * profile id (`app/merge.ts` re-keys an incoming child first). Idempotent: re-applying the same
 * `incoming` changes nothing further. */
export function mergeProfileData(
  local: MergeableProfileData,
  incoming: MergeableProfileData,
  now: Date,
): MergeableProfileData {
  const merged: MergeableProfileData = {
    settings: mergeProfileSettings(local.settings, incoming.settings),
    lessonProgress: mergeLessonProgress(local.lessonProgress, incoming.lessonProgress, now),
    attempts: unionById(local.attempts, incoming.attempts, MAX_ATTEMPTS),
    miniGameProgress: mergeMiniGameProgress(local.miniGameProgress, incoming.miniGameProgress, now),
    conceptStats: mergeConceptStats(local.conceptStats, incoming.conceptStats),
    gameRecords: unionById(local.gameRecords, incoming.gameRecords, MAX_GAME_RECORDS),
    earnedBadges: mergeEarnedBadges(local.earnedBadges, incoming.earnedBadges),
    streak: mergeStreak(local.streak, incoming.streak),
    sessionLogs: mergeSessionLogs(local.sessionLogs, incoming.sessionLogs, now),
    assessmentResults: unionById(
      local.assessmentResults,
      incoming.assessmentResults,
      MAX_ASSESSMENT_RESULTS,
    ),
    unlocks: mergeUnlocks(local.unlocks, incoming.unlocks),
  };
  return merged;
}

/** Total minutes played over the last `days` local calendar days ending today, across every device
 * row in `data.sessionLogs`. */
export function totalMinutesOverDays(data: MergeableProfileData, now: Date, days: number): number {
  return lastNDays(now, days).reduce(
    (sum, date) => sum + totalMinutesForDate(data.sessionLogs, date),
    0,
  );
}

/** A brand-new local profile's data: `settings` (the caller's composed default) and every list
 * empty. Safe fallback, not a real code path (`buildBackupFile` always returns one entry per
 * profile). */
export function emptyProfileData(settings: ProfileSettings): MergeableProfileData {
  return {
    settings,
    lessonProgress: [],
    attempts: [],
    miniGameProgress: [],
    conceptStats: [],
    gameRecords: [],
    earnedBadges: [],
    sessionLogs: [],
    assessmentResults: [],
    unlocks: [],
  };
}

/** Re-keys every record in `data` to `targetProfileId`, when the chosen local profile's id differs
 * from the incoming child's own. Record ids are left untouched: independently random, never collide. */
export function rekeyProfileData(
  data: MergeableProfileData,
  targetProfileId: string,
): MergeableProfileData {
  return {
    ...data,
    lessonProgress: data.lessonProgress.map((row) => ({ ...row, profileId: targetProfileId })),
    attempts: data.attempts.map((row) => ({ ...row, profileId: targetProfileId })),
    miniGameProgress: data.miniGameProgress.map((row) => ({ ...row, profileId: targetProfileId })),
    conceptStats: data.conceptStats.map((row) => ({ ...row, profileId: targetProfileId })),
    gameRecords: data.gameRecords.map((row) => ({ ...row, profileId: targetProfileId })),
    earnedBadges: data.earnedBadges.map((row) => ({ ...row, profileId: targetProfileId })),
    ...(data.streak === undefined
      ? {}
      : { streak: { ...data.streak, profileId: targetProfileId } }),
    sessionLogs: data.sessionLogs.map((row) => ({ ...row, profileId: targetProfileId })),
    assessmentResults: data.assessmentResults.map((row) => ({
      ...row,
      profileId: targetProfileId,
    })),
    unlocks: data.unlocks.map((row) => ({ ...row, profileId: targetProfileId })),
  };
}

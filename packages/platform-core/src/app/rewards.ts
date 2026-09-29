import type { BadgeFacts, EarnedBadge } from '../domain/badges.ts';
import { evaluateBadges, newEarnedBadge } from '../domain/badges.ts';
import type { Attempt, LessonProgress } from '../domain/progress.ts';
import { totalStars } from '../domain/progress.ts';
import { addMinutes, lastNDays, totalMinutesForDate } from '../domain/session-log.ts';
import type { SessionLog } from '../domain/session-log.ts';
import type { Streak } from '../domain/streak.ts';
import { localDayString, newStreak, recordActivityDay } from '../domain/streak.ts';
import { getOrCreateDeviceId } from './device.ts';
import type { Journey } from './journey.ts';
import { loadJourney } from './journey.ts';
import type { RewardsRepository } from './ports.ts';
import type { AppDeps } from './use-cases.ts';

function requireRewards(deps: AppDeps): RewardsRepository {
  if (deps.rewards === undefined) {
    throw new Error('AppDeps.rewards is not wired up');
  }
  return deps.rewards;
}

/** Lessons with 3 stars on every exercise; boss stars don't count. */
function perfectLessonsCount(journey: Journey, progresses: readonly LessonProgress[]): number {
  const progressByLesson = new Map(progresses.map((progress) => [progress.lessonId, progress]));
  let count = 0;
  for (const lesson of journey.lessons) {
    if (lesson.exercises.length === 0) continue;
    const progress = progressByLesson.get(lesson.id);
    const allThreeStars = lesson.exercises.every(
      (exercise) => (progress?.bestStars[exercise.id] ?? 0) === 3,
    );
    if (allThreeStars) count += 1;
  }
  return count;
}

function masteredScopes(journey: Journey): ReadonlySet<string> {
  const scopes = new Set<string>();
  const worldsByTrack = new Map<string, boolean[]>();
  for (const { world, status } of journey.worlds) {
    if (status === 'mastered') scopes.add(`world:${world.id}`);
    const list = worldsByTrack.get(world.track) ?? [];
    list.push(status === 'mastered');
    worldsByTrack.set(world.track, list);
  }
  for (const [trackId, statuses] of worldsByTrack) {
    if (statuses.length > 0 && statuses.every(Boolean)) scopes.add(`track:${trackId}`);
  }
  return scopes;
}

interface ConceptFacts {
  readonly correctTotal: Readonly<Record<string, number>>;
  readonly correctInARow: Readonly<Record<string, number>>;
  readonly noHintsInARow: Readonly<Record<string, number>>;
}

/** Lifetime / streak facts per concept from every scored `Attempt` (lesson or review), oldest first. */
function conceptFacts(attempts: readonly Attempt[]): ConceptFacts {
  const byConcept = new Map<string, Attempt[]>();
  for (const attempt of attempts) {
    if (!attempt.scored) continue;
    const list = byConcept.get(attempt.conceptId) ?? [];
    list.push(attempt);
    byConcept.set(attempt.conceptId, list);
  }

  const correctTotal: Record<string, number> = {};
  const correctInARow: Record<string, number> = {};
  const noHintsInARow: Record<string, number> = {};

  for (const [conceptId, list] of byConcept) {
    const sorted = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    let total = 0;
    let trailingCorrect = 0;
    let trailingNoHints = 0;
    for (const attempt of sorted) {
      if (attempt.correct) total += 1;
      trailingCorrect = attempt.correct ? trailingCorrect + 1 : 0;
      const solvedNoHint = attempt.stars > 0 && attempt.hints === 0;
      trailingNoHints = solvedNoHint ? trailingNoHints + 1 : 0;
    }
    correctTotal[conceptId] = total;
    correctInARow[conceptId] = trailingCorrect;
    noHintsInARow[conceptId] = trailingNoHints;
  }

  return { correctTotal, correctInARow, noHintsInARow };
}

/** Freshly derived facts for the engine's 7 generic condition types (`domain/badges.ts` stays pure); the other 3 read
 * `deps.subject.rewards`. */
export async function buildBadgeFacts(
  deps: AppDeps,
  profileId: string,
  journey: Journey,
  streakCurrent: number,
): Promise<BadgeFacts> {
  const [progresses, attempts] = await Promise.all([
    deps.progress.listLessons(profileId),
    deps.progress.listAttempts(profileId),
  ]);

  const { correctTotal, correctInARow, noHintsInARow } = conceptFacts(attempts);

  return {
    masteredScopes: masteredScopes(journey),
    starsTotal: totalStars(progresses),
    perfectLessons: perfectLessonsCount(journey, progresses),
    conceptCorrectTotal: correctTotal,
    conceptCorrectInARow: correctInARow,
    conceptNoHintsInARow: noHintsInARow,
    streakCurrent,
    warmupsCompleted: attempts.filter(
      (attempt) => attempt.review === true && attempt.reviewSource === 'warmup',
    ).length,
    comebackCount: attempts.filter(
      (attempt) => attempt.scored && attempt.stars > 0 && attempt.errors >= 2,
    ).length,
  };
}

export async function evaluateAndRecordBadges(
  deps: AppDeps,
  profileId: string,
  journey: Journey,
  streakCurrent: number,
  now: Date,
): Promise<readonly EarnedBadge[]> {
  const defs = deps.content.badges?.() ?? [];
  if (defs.length === 0) {
    return [];
  }
  const rewards = requireRewards(deps);
  const [facts, earned, records] = await Promise.all([
    buildBadgeFacts(deps, profileId, journey, streakCurrent),
    rewards.listEarnedBadges(profileId),
    deps.gameRecords.listByProfile(profileId),
  ]);
  const subjectRewards = deps.subject.rewards;
  const newlyEarned = evaluateBadges(
    defs,
    facts,
    earned,
    subjectRewards,
    subjectRewards?.facts(records),
  );

  const saved: EarnedBadge[] = [];
  for (const { badgeId, tier } of newlyEarned) {
    const badge = newEarnedBadge(deps.ids.next(), profileId, badgeId, tier, now);
    await rewards.addEarnedBadge(badge);
    saved.push(badge);
  }
  return saved;
}

export async function recordDailyActivity(
  deps: AppDeps,
  profileId: string,
  now: Date,
): Promise<Streak> {
  const rewards = requireRewards(deps);
  const existing = await rewards.getStreak(profileId);
  const streak = existing ?? newStreak(deps.ids.next(), profileId, now);
  const updated = recordActivityDay(streak, localDayString(now), now);
  if (updated !== streak) {
    await rewards.saveStreak(updated);
  }
  return updated;
}

export async function recordSessionMinutes(
  deps: AppDeps,
  profileId: string,
  minutes: number,
  now: Date,
): Promise<SessionLog> {
  const rewards = requireRewards(deps);
  const date = localDayString(now);
  const [existing, deviceId] = await Promise.all([
    rewards.getSessionLog(profileId, date),
    getOrCreateDeviceId(deps),
  ]);
  const log = addMinutes(existing, deps.ids.next(), profileId, date, minutes, now, deviceId);
  await rewards.saveSessionLog(log);
  return log;
}

export interface DayMinutes {
  readonly date: string;
  readonly minutes: number;
}

/** Played minutes for the last `days` local days, oldest first, ending today; each day sums every device's row
 * (`totalMinutesForDate`). `0` without `deps.rewards`. */
export async function minutesByDay(
  deps: AppDeps,
  profileId: string,
  days: number,
): Promise<readonly DayMinutes[]> {
  const now = deps.clock.now();
  const dayStrings = lastNDays(now, days);
  if (deps.rewards === undefined) {
    return dayStrings.map((date) => ({ date, minutes: 0 }));
  }
  const logs = await deps.rewards.listSessionLogs(profileId);
  return dayStrings.map((date) => ({ date, minutes: totalMinutesForDate(logs, date) }));
}

/** Sum of today's scored `Attempt.stars` for the "See you tomorrow" line; a tally, not deduplicated against `bestStars`. */
export async function starsToday(deps: AppDeps, profileId: string, now: Date): Promise<number> {
  const attempts = await deps.progress.listAttempts(profileId);
  const today = localDayString(now);
  return attempts
    .filter((attempt) => attempt.scored && localDayString(new Date(attempt.createdAt)) === today)
    .reduce((sum, attempt) => sum + attempt.stars, 0);
}

export interface RewardsCheckResult {
  readonly streak: Streak;
  readonly newBadges: readonly EarnedBadge[];
}

/** The one call every activity choke point makes: folds today into the streak, then persists newly earned badges/tiers.
 * Idempotent; no-ops without `deps.rewards`, badges also without `content.catalog()`. */
export async function checkRewards(deps: AppDeps, profileId: string): Promise<RewardsCheckResult> {
  const now = deps.clock.now();
  if (deps.rewards === undefined) {
    return { streak: newStreak('', profileId, now), newBadges: [] };
  }

  const streak = await recordDailyActivity(deps, profileId, now);
  if (deps.content.catalog?.() === undefined) {
    return { streak, newBadges: [] };
  }

  const journey = await loadJourney(deps, profileId);
  const newBadges = await evaluateAndRecordBadges(deps, profileId, journey, streak.current, now);
  return { streak, newBadges };
}

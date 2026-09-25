import type { AssessmentResult } from '../domain/assessment.ts';
import type { EarnedBadge } from '../domain/badges.ts';
import type { RankDef, World } from '../domain/journey.ts';
import type { Profile } from '../domain/profile.ts';
import type { GameRecord } from '../domain/progress.ts';
import { lessonStars, totalStars } from '../domain/progress.ts';
import type { ConceptStats } from '../domain/review.ts';
import { accuracy, isWeak } from '../domain/review.ts';
import type { DayMinutes } from './rewards.ts';
import { minutesByDay } from './rewards.ts';
import type { Journey } from './journey.ts';
import { loadJourney } from './journey.ts';
import type { AppDeps } from './use-cases.ts';

/** Days shown in the parent report's "minutes per day" list (app-structure.md §11's own row). */
const REPORT_MINUTES_DAYS = 14;
/** Days the Overview's "minutes today / last 7 days" card reads (`buildChildOverview`). */
const OVERVIEW_MINUTES_DAYS = 7;
/** Most recent games / assessments the report keeps (app-structure.md §11: "last 10"). */
const REPORT_RECENT_COUNT = 10;

/** `deps.profiles.get`, or a clear error if the profile does not exist. */
async function requireProfile(deps: AppDeps, profileId: string) {
  const profile = await deps.profiles.get(profileId);
  if (profile === undefined) {
    throw new Error(`profile "${profileId}" not found`);
  }
  return profile;
}

/** Parent area Overview: one card's worth of at-a-glance stats for one child. */
export interface ChildOverview {
  readonly profile: Profile;
  readonly rank: RankDef | undefined;
  readonly totalStars: number;
  readonly minutesToday: number;
  readonly minutesLast7Days: number;
  readonly streakCurrent: number;
}

/**
 * Builds one child's Overview card (app-structure.md §11): avatar/nickname come from `profile`
 * itself, alongside rank, total stars, minutes today / over the last 7 days, and the current streak.
 * Lighter than {@link buildChildReport} — no per-world/concept/game/badge detail, since the
 * Overview only shows one line per stat.
 */
export async function buildChildOverview(deps: AppDeps, profileId: string): Promise<ChildOverview> {
  const [profile, journey, days, streak] = await Promise.all([
    requireProfile(deps, profileId),
    loadJourney(deps, profileId),
    minutesByDay(deps, profileId, OVERVIEW_MINUTES_DAYS),
    deps.rewards?.getStreak(profileId),
  ]);
  return {
    profile,
    rank: journey.rank,
    totalStars: journey.totalStars,
    minutesToday: days[days.length - 1]?.minutes ?? 0,
    minutesLast7Days: days.reduce((sum, day) => sum + day.minutes, 0),
    streakCurrent: streak?.current ?? 0,
  };
}

/** Progress on one world (parent report "Progress by world"). */
export interface WorldProgressSummary {
  readonly world: World;
  readonly lessonsTotal: number;
  readonly lessonsComplete: number;
  readonly lessonsMastered: number;
  readonly starsEarned: number;
  readonly starsMax: number;
}

/** One concept's accuracy over its last (up to 10) results (parent report "concept accuracy"). */
export interface ConceptAccuracySummary {
  readonly conceptId: string;
  readonly accuracy: number;
  readonly attempts: number;
  readonly weak: boolean;
}

/** Everything the parent area's per-child report screen shows (app-structure.md §11). */
export interface ChildReport {
  readonly profile: Profile;
  readonly rank: RankDef | undefined;
  readonly totalStars: number;
  readonly worlds: readonly WorldProgressSummary[];
  readonly conceptAccuracy: readonly ConceptAccuracySummary[];
  /** Concept ids from `conceptAccuracy` with `weak: true`, in the same order. */
  readonly weakConcepts: readonly string[];
  readonly minutesByDay: readonly DayMinutes[];
  readonly streakCurrent: number;
  /** Most recent games first, capped at {@link REPORT_RECENT_COUNT}. */
  readonly games: readonly GameRecord[];
  readonly badges: readonly EarnedBadge[];
  /** Most recent assessment runs first, capped at {@link REPORT_RECENT_COUNT}. */
  readonly assessments: readonly AssessmentResult[];
}

/** One `WorldProgressSummary` for `world`, from `journey`'s lessons/statuses + this profile's own
 * `LessonProgress` rows (for stars — `journey` itself does not carry per-lesson star counts). */
function worldProgress(
  journey: Journey,
  world: World,
  progressByLesson: ReadonlyMap<string, Parameters<typeof lessonStars>[1]>,
): WorldProgressSummary {
  const lessons = journey.lessons.filter((lesson) => lesson.world === world.id);
  let lessonsComplete = 0;
  let lessonsMastered = 0;
  let starsEarned = 0;
  let starsMax = 0;
  for (const lesson of lessons) {
    const status = journey.statuses.get(lesson.id);
    if (status === 'complete' || status === 'mastered') lessonsComplete += 1;
    if (status === 'mastered') lessonsMastered += 1;
    const stars = lessonStars(lesson, progressByLesson.get(lesson.id));
    starsEarned += stars.earned;
    starsMax += stars.max;
  }
  return {
    world,
    lessonsTotal: lessons.length,
    lessonsComplete,
    lessonsMastered,
    starsEarned,
    starsMax,
  };
}

/**
 * Builds one child's full parent-area report (app-structure.md §11): progress by world, concept
 * accuracy + weak-concept list (from the last up to 10 results each, `domain/review.ts`'s own
 * cap), minutes per day over the last 14 days, the last 10 games and assessment runs (newest
 * first), and every earned badge. Permissive without `deps.rewards`/`deps.assessment` wired up
 * (badges/assessments read `[]`), same reasoning `checkRewards`/`loadUnlocked` already use.
 */
export async function buildChildReport(deps: AppDeps, profileId: string): Promise<ChildReport> {
  const [profile, journey, progresses, conceptStats, days, streak, records, badges, assessments] =
    await Promise.all([
      requireProfile(deps, profileId),
      loadJourney(deps, profileId),
      deps.progress.listLessons(profileId),
      deps.progress.listConceptStats(profileId),
      minutesByDay(deps, profileId, REPORT_MINUTES_DAYS),
      deps.rewards?.getStreak(profileId),
      deps.gameRecords.listByProfile(profileId),
      deps.rewards?.listEarnedBadges(profileId) ?? Promise.resolve([]),
      deps.assessment?.listAssessmentResults(profileId) ?? Promise.resolve([]),
    ]);

  const progressByLesson = new Map(progresses.map((progress) => [progress.lessonId, progress]));
  const worlds = journey.worlds.map(({ world }) => worldProgress(journey, world, progressByLesson));

  const conceptAccuracy: ConceptAccuracySummary[] = conceptStats
    .map((stats: ConceptStats) => ({
      conceptId: stats.conceptId,
      accuracy: accuracy(stats),
      attempts: stats.recent.length,
      weak: isWeak(stats),
    }))
    .sort((a, b) => a.conceptId.localeCompare(b.conceptId));

  const byRecencyDesc = (a: { readonly createdAt: string }, b: { readonly createdAt: string }) =>
    b.createdAt.localeCompare(a.createdAt);

  return {
    profile,
    rank: journey.rank,
    totalStars: totalStars(progresses),
    worlds,
    conceptAccuracy,
    weakConcepts: conceptAccuracy.filter((entry) => entry.weak).map((entry) => entry.conceptId),
    minutesByDay: days,
    streakCurrent: streak?.current ?? 0,
    games: [...records].sort(byRecencyDesc).slice(0, REPORT_RECENT_COUNT),
    badges,
    assessments: [...assessments]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, REPORT_RECENT_COUNT),
  };
}

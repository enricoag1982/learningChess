import type { AssessmentResult } from '../domain/assessment.ts';
import type { EarnedBadge } from '../domain/badges.ts';
import type { RankDef, World } from '../domain/journey.ts';
import type { Lesson } from '../domain/lesson.ts';
import type { Profile } from '../domain/profile.ts';
import type { GameRecord } from '../domain/progress.ts';
import { lessonStars, totalStars } from '../domain/progress.ts';
import type { ConceptStats } from '../domain/review.ts';
import { accuracy, isWeak } from '../domain/review.ts';
import type { DayMinutes } from './rewards.ts';
import { minutesByDay } from './rewards.ts';
import type { Journey } from './journey.ts';
import { loadJourney } from './journey.ts';
import { getProfileSettings } from './settings.ts';
import type { AppDeps } from './use-cases.ts';

const REPORT_MINUTES_DAYS = 14;
const OVERVIEW_MINUTES_DAYS = 7;
const REPORT_RECENT_COUNT = 10;

async function requireProfile(deps: AppDeps, profileId: string) {
  const profile = await deps.profiles.get(profileId);
  if (profile === undefined) {
    throw new Error(`profile "${profileId}" not found`);
  }
  return profile;
}

export interface ChildOverview {
  readonly profile: Profile;
  readonly rank: RankDef | undefined;
  readonly totalStars: number;
  readonly minutesToday: number;
  readonly minutesLast7Days: number;
  readonly streakCurrent: number;
}

/** One child's Overview card: rank, total stars, minutes today / last 7 days, streak; lighter than {@link buildChildReport}. */
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

export interface WorldProgressSummary {
  readonly world: World;
  readonly lessonsTotal: number;
  readonly lessonsComplete: number;
  readonly lessonsMastered: number;
  readonly starsEarned: number;
  readonly starsMax: number;
  /** Lessons of this world with non-empty `LessonProgress.skippedPhases` ("intro skipped" line). */
  readonly skippedIntroLessons: readonly Lesson[];
}

export interface ConceptAccuracySummary {
  readonly conceptId: string;
  readonly accuracy: number;
  readonly attempts: number;
  readonly weak: boolean;
}

export interface ChildReport {
  readonly profile: Profile;
  readonly rank: RankDef | undefined;
  readonly totalStars: number;
  readonly worlds: readonly WorldProgressSummary[];
  readonly conceptAccuracy: readonly ConceptAccuracySummary[];
  readonly weakConcepts: readonly string[];
  readonly minutesByDay: readonly DayMinutes[];
  readonly dailyLimitMinutes: number | null;
  /** The "active rules" line under the minutes-per-day chart. */
  readonly weekendLimitMinutes: number | null | undefined;
  readonly playUntil: string | null | undefined;
  readonly playFrom: string | null | undefined;
  readonly streakCurrent: number;
  readonly games: readonly GameRecord[];
  readonly badges: readonly EarnedBadge[];
  readonly assessments: readonly AssessmentResult[];
}

/** Stars come from this profile's `LessonProgress` rows: `journey` does not carry per-lesson star counts. */
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
  const skippedIntroLessons: Lesson[] = [];
  for (const lesson of lessons) {
    const status = journey.statuses.get(lesson.id);
    if (status === 'complete' || status === 'mastered') lessonsComplete += 1;
    if (status === 'mastered') lessonsMastered += 1;
    const progress = progressByLesson.get(lesson.id);
    const stars = lessonStars(lesson, progress);
    starsEarned += stars.earned;
    starsMax += stars.max;
    if ((progress?.skippedPhases?.length ?? 0) > 0) {
      skippedIntroLessons.push(lesson);
    }
  }
  return {
    world,
    lessonsTotal: lessons.length,
    lessonsComplete,
    lessonsMastered,
    starsEarned,
    starsMax,
    skippedIntroLessons,
  };
}

/** Permissive without `deps.rewards` / `deps.assessment` wired up (reads `[]`). */
export async function buildChildReport(deps: AppDeps, profileId: string): Promise<ChildReport> {
  const [
    profile,
    journey,
    progresses,
    conceptStats,
    days,
    streak,
    records,
    badges,
    assessments,
    settings,
  ] = await Promise.all([
    requireProfile(deps, profileId),
    loadJourney(deps, profileId),
    deps.progress.listLessons(profileId),
    deps.progress.listConceptStats(profileId),
    minutesByDay(deps, profileId, REPORT_MINUTES_DAYS),
    deps.rewards?.getStreak(profileId),
    deps.gameRecords.listByProfile(profileId),
    deps.rewards?.listEarnedBadges(profileId) ?? Promise.resolve([]),
    deps.assessment?.listAssessmentResults(profileId) ?? Promise.resolve([]),
    getProfileSettings(deps, profileId),
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
    dailyLimitMinutes: settings.dailyLimitMinutes,
    weekendLimitMinutes: settings.weekendLimitMinutes,
    playUntil: settings.playUntil,
    playFrom: settings.playFrom,
    streakCurrent: streak?.current ?? 0,
    games: [...records].sort(byRecencyDesc).slice(0, REPORT_RECENT_COUNT),
    badges,
    assessments: [...assessments]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, REPORT_RECENT_COUNT),
  };
}

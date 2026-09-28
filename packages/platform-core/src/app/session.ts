import type { NextStep, TracksCatalog, World } from '../domain/journey.ts';
import { nextStep } from '../domain/journey.ts';
import type { Lesson, MiniGame } from '../domain/lesson.ts';
import { unlockedMiniGames } from '../domain/play.ts';
import type { LessonProgress, MiniGameProgress } from '../domain/progress.ts';
import type { ConceptPoolEntry, ConceptStats, ConceptTask } from '../domain/review.ts';
import { conceptPool, pickPracticeTasks, pickWarmUp } from '../domain/review.ts';
import type { ExerciseDefBase } from '../domain/subject.ts';
import { loadUnlocked } from './assessment.ts';
import type { ContentSource, Random } from './ports.ts';
import type { AppDeps } from './use-cases.ts';

/** `content.catalog()`, or a clear error if this `ContentSource` has not wired it up yet. */
function requireCatalog(content: ContentSource): TracksCatalog {
  const catalog = content.catalog?.();
  if (catalog === undefined) {
    throw new Error('ContentSource.catalog() is not implemented');
  }
  return catalog;
}

/** Every pool a set of concept ids needs, keyed by concept id (`conceptPool`, computed once). */
function poolsFor<E extends ExerciseDefBase>(
  lessons: readonly Lesson<E>[],
  conceptIds: Iterable<string>,
): ReadonlyMap<string, readonly ConceptPoolEntry<E>[]> {
  const pools = new Map<string, readonly ConceptPoolEntry<E>[]>();
  for (const conceptId of conceptIds) {
    pools.set(conceptId, conceptPool(lessons, conceptId));
  }
  return pools;
}

/** Today's warm-up tasks: `[]` when no concept is in review. */
export function planWarmUp<E extends ExerciseDefBase>(
  lessons: readonly Lesson<E>[],
  conceptStats: readonly ConceptStats[],
  now: Date,
  random: Random,
): readonly ConceptTask<E>[] {
  const inReview = conceptStats.filter((stats) => stats.box !== undefined);
  const pools = poolsFor(
    lessons,
    inReview.map((stats) => stats.conceptId),
  );
  return pickWarmUp(conceptStats, pools, now, random);
}

/** Loads today's warm-up tasks for a profile (see `planWarmUp`). Inferred (not annotated) return
 * type: preserves the subject's own concrete exercise def, from `deps.content`, through to the
 * caller (chess: `ConceptTask<ExerciseDef>`). */
export async function loadWarmUp(deps: AppDeps, profileId: string) {
  const [lessons, conceptStats] = await Promise.all([
    Promise.resolve(deps.content.lessons()),
    deps.progress.listConceptStats(profileId),
  ]);
  return planWarmUp(lessons, conceptStats, deps.clock.now(), deps.random);
}

/** Practice screen's default task count for one topic run. */
export const PRACTICE_TASK_COUNT = 5;

/** Loads `count` Practice tasks for one concept (see `pickPracticeTasks`). Inferred return type,
 * same reason as `loadWarmUp`'s. */
export async function loadPracticeTasks(
  deps: AppDeps,
  profileId: string,
  conceptId: string,
  count: number = PRACTICE_TASK_COUNT,
) {
  const [lessons, stats] = await Promise.all([
    Promise.resolve(deps.content.lessons()),
    deps.progress.getConceptStats(profileId, conceptId),
  ]);
  const pool = conceptPool(lessons, conceptId);
  return pickPracticeTasks(conceptId, pool, stats?.lastExerciseId, count, deps.random);
}

/** One activity of a Today session, in play order. */
export type TodayActivity<E extends ExerciseDefBase = ExerciseDefBase> =
  | { readonly kind: 'warmup'; readonly tasks: readonly ConceptTask<E>[] }
  | { readonly kind: 'lesson'; readonly lesson: Lesson }
  | { readonly kind: 'world-boss'; readonly world: World }
  | { readonly kind: 'minigame'; readonly miniGame: MiniGame };

/** A Today session's full ordered plan (see `planTodaySession`). */
export interface TodaySessionPlan<E extends ExerciseDefBase = ExerciseDefBase> {
  readonly activities: readonly TodayActivity<E>[];
}

/** Picks the session's one mini-game: the most recently unlocked one with best stars < 3, else the
 * most recently unlocked one regardless; `undefined` when nothing is unlocked yet. */
function pickSessionMiniGame(
  catalog: TracksCatalog,
  lessons: readonly Lesson[],
  minigames: readonly MiniGame[],
  progresses: readonly LessonProgress[],
  miniGameProgresses: readonly MiniGameProgress[],
  /** Left out of the pick: the world boss already playing as this session's other activity. */
  excludeId?: string,
): MiniGame | undefined {
  const unlocked = unlockedMiniGames(lessons, minigames, progresses).filter(
    (entry) => entry.unlocked && entry.minigame.id !== excludeId,
  );
  if (unlocked.length === 0) {
    return undefined;
  }

  const worldOrder = new Map(
    catalog.tracks.flatMap((track) =>
      track.worlds.map((world) => [world.id, world.order] as const),
    ),
  );
  const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const bestStarsById = new Map(
    miniGameProgresses.map((entry) => [entry.miniGameId, entry.bestStars]),
  );

  const ranked = unlocked
    .map((entry) => {
      const lesson = lessonById.get(entry.minigame.unlockAfter);
      return {
        minigame: entry.minigame,
        bestStars: Math.max(entry.bestStars, bestStarsById.get(entry.minigame.id) ?? 0),
        worldRank: lesson ? (worldOrder.get(lesson.world) ?? 0) : 0,
        lessonRank: lesson ? lesson.order : 0,
      };
    })
    .sort((a, b) => b.worldRank - a.worldRank || b.lessonRank - a.lessonRank);

  const needsPlay = ranked.find((entry) => entry.bestStars < 3);
  return (needsPlay ?? ranked[0])?.minigame;
}

/** Plans a Today session: warm-up (if due/weak) → the Journey's next step ({@link nextStep}) → one
 * mini-game (`pickSessionMiniGame`), skipping any activity with nothing to offer. Pure. */
export function planTodaySession<E extends ExerciseDefBase>(
  catalog: TracksCatalog,
  lessons: readonly Lesson<E>[],
  minigames: readonly MiniGame[],
  progresses: readonly LessonProgress[],
  miniGameProgresses: readonly MiniGameProgress[],
  conceptStats: readonly ConceptStats[],
  now: Date,
  random: Random,
  /** Lesson/world ids unlocked out of order by a test-out/placement/parent unlock. */
  unlocked?: ReadonlySet<string>,
): TodaySessionPlan<E> {
  const activities: TodayActivity<E>[] = [];

  const warmUpTasks = planWarmUp(lessons, conceptStats, now, random);
  if (warmUpTasks.length > 0) {
    activities.push({ kind: 'warmup', tasks: warmUpTasks });
  }

  const step: NextStep | null = nextStep(
    catalog,
    lessons,
    progresses,
    unlocked,
    miniGameProgresses,
  );
  if (step !== null) {
    activities.push(
      step.kind === 'lesson'
        ? { kind: 'lesson', lesson: step.lesson }
        : { kind: 'world-boss', world: step.world },
    );
  }

  const miniGame = pickSessionMiniGame(
    catalog,
    lessons,
    minigames,
    progresses,
    miniGameProgresses,
    step?.kind === 'world-boss' ? step.world.boss : undefined,
  );
  if (miniGame !== undefined) {
    activities.push({ kind: 'minigame', miniGame });
  }

  return { activities };
}

/** Loads and plans a profile's Today session (see `planTodaySession`). */
/** Inferred (not annotated) return type — same reason as `loadWarmUp`'s. */
export async function loadTodaySession(deps: AppDeps, profileId: string) {
  const catalog = requireCatalog(deps.content);
  const lessons = deps.content.lessons();
  const minigames = deps.content.minigames();
  const [progresses, miniGameProgresses, conceptStats, unlocked] = await Promise.all([
    deps.progress.listLessons(profileId),
    deps.progress.listMiniGames(profileId),
    deps.progress.listConceptStats(profileId),
    loadUnlocked(deps, profileId),
  ]);
  return planTodaySession(
    catalog,
    lessons,
    minigames,
    progresses,
    miniGameProgresses,
    conceptStats,
    deps.clock.now(),
    deps.random,
    unlocked,
  );
}

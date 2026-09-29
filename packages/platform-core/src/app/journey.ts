import {
  currentRank,
  lessonAvailability,
  nextLesson,
  nextStep,
  worldBossStatus,
  worldStatus,
  type JourneyLessonStatus,
  type NextStep,
  type RankDef,
  type TracksCatalog,
  type World,
  type WorldBossStatus,
  type WorldStatus,
} from '../domain/journey.ts';
import type { Lesson } from '../domain/lesson.ts';
import { totalStars } from '../domain/progress.ts';
import type { ExerciseDefBase } from '../domain/subject.ts';
import { loadUnlocked } from './assessment.ts';
import type { ContentSource } from './ports.ts';
import type { AppDeps } from './use-cases.ts';

export interface JourneyWorld {
  readonly world: World;
  readonly status: WorldStatus;
  readonly bossStatus: WorldBossStatus;
}

/** Everything the Journey screen needs for one profile; generic in the subject's exercise def / demo so callers keep
 * concrete types from `loadJourney`'s `deps.content`. */
export interface Journey<
  E extends ExerciseDefBase = ExerciseDefBase,
  Demo extends { readonly textKey: string } = { readonly textKey: string },
> {
  readonly catalog: TracksCatalog;
  readonly lessons: readonly Lesson<E, Demo>[];
  readonly statuses: ReadonlyMap<string, JourneyLessonStatus>;
  readonly worlds: readonly JourneyWorld[];
  /** Next lesson to do, ignoring any world boss (see `nextStep` for the full next-thing-to-do). */
  readonly next: Lesson<E, Demo> | null;
  /** The next thing to do: a lesson, or a world boss once its world's lessons are all done. */
  readonly nextStep: NextStep<E, Demo> | null;
  readonly rank: RankDef | undefined;
  readonly totalStars: number;
}

function requireCatalog(content: ContentSource): TracksCatalog {
  const catalog = content.catalog?.();
  if (catalog === undefined) {
    throw new Error('ContentSource.catalog() is not implemented');
  }
  return catalog;
}

/** Everything derived, nothing stored (domain-model.md §2). Inferred return type: keeps the subject's concrete types
 * from `deps.content`. */
export async function loadJourney(deps: AppDeps, profileId: string) {
  const catalog = requireCatalog(deps.content);
  const lessons = deps.content.lessons();
  const [progresses, miniGames, unlocked] = await Promise.all([
    deps.progress.listLessons(profileId),
    deps.progress.listMiniGames(profileId),
    loadUnlocked(deps, profileId),
  ]);

  const worlds: JourneyWorld[] = [];
  for (const track of catalog.tracks) {
    for (const world of [...track.worlds].sort((a, b) => a.order - b.order)) {
      worlds.push({
        world,
        status: worldStatus(catalog, world, lessons, progresses, unlocked, miniGames),
        bossStatus: worldBossStatus(catalog, world, lessons, progresses, unlocked, miniGames),
      });
    }
  }

  return {
    catalog,
    lessons,
    statuses: lessonAvailability(catalog, lessons, progresses, unlocked, miniGames),
    worlds,
    next: nextLesson(catalog, lessons, progresses, unlocked, miniGames),
    nextStep: nextStep(catalog, lessons, progresses, unlocked, miniGames),
    rank: currentRank(catalog, lessons, progresses, unlocked, miniGames),
    totalStars: totalStars(progresses),
  };
}

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
import { loadUnlocked } from './assessment.ts';
import type { ContentSource } from './ports.ts';
import type { AppDeps } from './use-cases.ts';

/** One world's place on the Journey map, alongside its derived status and its boss's, if any. */
export interface JourneyWorld {
  readonly world: World;
  readonly status: WorldStatus;
  readonly bossStatus: WorldBossStatus;
}

/** Everything the Journey screen (map, next-lesson banner, rank badge) needs for one profile. */
export interface Journey {
  readonly catalog: TracksCatalog;
  readonly lessons: readonly Lesson[];
  readonly statuses: ReadonlyMap<string, JourneyLessonStatus>;
  /** Every world across every track, in track then world order. */
  readonly worlds: readonly JourneyWorld[];
  /** Next lesson to do, ignoring any world boss (see `nextStep` for the full next-thing-to-do). */
  readonly next: Lesson | null;
  /** The next thing to do: a lesson, or a world boss once its world's lessons are all done. */
  readonly nextStep: NextStep | null;
  readonly rank: RankDef | undefined;
  readonly totalStars: number;
}

/** `content.catalog()`, or a clear error if this `ContentSource` has not wired it up yet. */
function requireCatalog(content: ContentSource): TracksCatalog {
  const catalog = content.catalog?.();
  if (catalog === undefined) {
    throw new Error('ContentSource.catalog() is not implemented');
  }
  return catalog;
}

/**
 * Loads a profile's Journey: the tracks/worlds/ranks catalog, every lesson's status, the world
 * map with its derived statuses, the next lesson to do, the current rank, and total stars —
 * everything derived (domain-model.md §2 "Derived"), nothing stored.
 */
export async function loadJourney(deps: AppDeps, profileId: string): Promise<Journey> {
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

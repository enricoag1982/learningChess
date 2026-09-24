import {
  currentRank,
  lessonAvailability,
  nextLesson,
  worldStatus,
  type JourneyLessonStatus,
  type RankDef,
  type TracksCatalog,
  type World,
  type WorldStatus,
} from '../domain/journey.ts';
import type { Lesson } from '../domain/lesson.ts';
import { totalStars } from '../domain/progress.ts';
import type { ContentSource } from './ports.ts';
import type { AppDeps } from './use-cases.ts';

/** One world's place on the Journey map, alongside its derived status. */
export interface JourneyWorld {
  readonly world: World;
  readonly status: WorldStatus;
}

/** Everything the Journey screen (map, next-lesson banner, rank badge) needs for one profile. */
export interface Journey {
  readonly catalog: TracksCatalog;
  readonly lessons: readonly Lesson[];
  readonly statuses: ReadonlyMap<string, JourneyLessonStatus>;
  /** Every world across every track, in track then world order. */
  readonly worlds: readonly JourneyWorld[];
  readonly next: Lesson | null;
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
  const progresses = await deps.progress.listLessons(profileId);

  const worlds: JourneyWorld[] = [];
  for (const track of catalog.tracks) {
    for (const world of [...track.worlds].sort((a, b) => a.order - b.order)) {
      worlds.push({ world, status: worldStatus(catalog, world, lessons, progresses) });
    }
  }

  return {
    catalog,
    lessons,
    statuses: lessonAvailability(catalog, lessons, progresses),
    worlds,
    next: nextLesson(catalog, lessons, progresses),
    rank: currentRank(catalog, lessons, progresses),
    totalStars: totalStars(progresses),
  };
}

import type { Lesson } from './lesson.ts';
import { lessonStatus, totalStars } from './progress.ts';
import type { LessonProgress, MiniGameProgress } from './progress.ts';
import type { ExerciseDefBase } from './subject.ts';

export const HABITATS = [
  'meadow',
  'savannah',
  'jungle',
  'mountains',
  'river',
  'forest',
  'ocean',
  'arctic',
] as const;

export type Habitat = (typeof HABITATS)[number];

export interface World {
  readonly id: string;
  readonly track: string;
  /** 1-based order within its track. */
  readonly order: number;
  readonly habitat: Habitat;
  readonly titleKey: string;
  /** Id of this world's boss mini-game (domain-model.md §3); unlike a lesson's `boss`, played once every lesson
   * is complete, and gates mastery. */
  readonly boss?: string;
}

/** Main road (Basics) or one of the branch tracks (Openings / Tactics / Endgames), any order. */
export interface Track {
  readonly id: string;
  readonly kind: 'main' | 'branch';
  readonly titleKey: string;
  readonly worlds: readonly World[];
}

/** Unlock condition: `'start'`, `'world:<id>'`, `'track:<id>'` or `'all-tracks'` (domain-model.md §1). */
export interface RankDef {
  readonly id: string;
  readonly after: string;
}

export interface TracksCatalog {
  readonly tracks: readonly Track[];
  readonly ranks: readonly RankDef[];
}

export type JourneyLessonStatus = 'locked' | 'available' | 'complete' | 'mastered';

/** A world's status on the Journey map. `coming-soon`: no lesson has been authored for it yet. */
export type WorldStatus = 'locked' | 'available' | 'mastered' | 'coming-soon';

export type WorldBossStatus = 'none' | 'locked' | 'available' | 'won';

/** `lessons` of `world` by `order`; none means `coming-soon` (see {@link worldStatus}). */
export function worldLessons<
  E extends ExerciseDefBase,
  Demo extends { readonly textKey: string } = { readonly textKey: string },
>(world: World, lessons: readonly Lesson<E, Demo>[]): readonly Lesson<E, Demo>[] {
  return lessons
    .filter((lesson) => lesson.world === world.id)
    .slice()
    .sort((a, b) => a.order - b.order);
}

function worldsSorted(track: Track): readonly World[] {
  return track.worlds.slice().sort((a, b) => a.order - b.order);
}

/** Main-track lessons in Journey/session order; branch tracks open only once the main track is mastered. */
export function mainTrackLessons<
  E extends ExerciseDefBase,
  Demo extends { readonly textKey: string } = { readonly textKey: string },
>(catalog: TracksCatalog, lessons: readonly Lesson<E, Demo>[]): readonly Lesson<E, Demo>[] {
  const mainTrack = catalog.tracks.find((track) => track.kind === 'main');
  if (!mainTrack) throw new Error('mainTrackLessons: catalog has no main track');
  return worldsSorted(mainTrack).flatMap((world) => worldLessons(world, lessons));
}

export function findWorld(catalog: TracksCatalog, worldId: string): World | undefined {
  for (const track of catalog.tracks) {
    const found = track.worlds.find((world) => world.id === worldId);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

export function worldOrderById(catalog: TracksCatalog): Map<string, number> {
  return new Map(
    catalog.tracks.flatMap((track) =>
      track.worlds.map((world) => [world.id, world.order] as const),
    ),
  );
}

function findTrack(catalog: TracksCatalog, world: World): Track | undefined {
  return catalog.tracks.find((track) => track.id === world.track);
}

/** True when `world` has no boss, or its boss's `MiniGameProgress.wins >= 1` (any win: Journey or Play). */
function isWorldBossWon(world: World, miniGames?: readonly MiniGameProgress[]): boolean {
  if (world.boss === undefined) {
    return true;
  }
  return (miniGames ?? []).some(
    (progress) => progress.miniGameId === world.boss && progress.wins >= 1,
  );
}

/** Every authored lesson mastered, every lesson boss `bossStars >= 2`, and the world boss won (domain-model.md §3).
 * A `coming-soon` world never masters; see {@link isWorldEffectivelyMastered}. */
function isWorldMastered(
  world: World,
  lessons: readonly Lesson[],
  progresses: readonly LessonProgress[],
  miniGames?: readonly MiniGameProgress[],
): boolean {
  const lessonsOfWorld = worldLessons(world, lessons);
  if (lessonsOfWorld.length === 0) {
    return false;
  }
  const progressByLesson = new Map(progresses.map((progress) => [progress.lessonId, progress]));
  const lessonsMastered = lessonsOfWorld.every((lesson) => {
    const progress = progressByLesson.get(lesson.id);
    if (lessonStatus(lesson, progress) !== 'mastered') {
      return false;
    }
    return lesson.boss === undefined || (progress?.bossStars ?? 0) >= 2;
  });
  return lessonsMastered && isWorldBossWon(world, miniGames);
}

/** `isWorldMastered`, or unlocked by a parent/test-out (`unlocked` holds its id); also stands in for an unwon
 * world boss (domain-model.md §3). */
function isWorldEffectivelyMastered(
  world: World,
  lessons: readonly Lesson[],
  progresses: readonly LessonProgress[],
  unlocked?: ReadonlySet<string>,
  miniGames?: readonly MiniGameProgress[],
): boolean {
  return isWorldMastered(world, lessons, progresses, miniGames) || unlocked?.has(world.id) === true;
}

function isTrackMastered(
  track: Track,
  lessons: readonly Lesson[],
  progresses: readonly LessonProgress[],
  unlocked?: ReadonlySet<string>,
  miniGames?: readonly MiniGameProgress[],
): boolean {
  return track.worlds.every((world) =>
    isWorldEffectivelyMastered(world, lessons, progresses, unlocked, miniGames),
  );
}

/** Track available (domain-model.md §3): main track always; branch tracks after Basics mastered. */
function isTrackAvailable(
  catalog: TracksCatalog,
  track: Track,
  lessons: readonly Lesson[],
  progresses: readonly LessonProgress[],
  unlocked?: ReadonlySet<string>,
  miniGames?: readonly MiniGameProgress[],
): boolean {
  if (track.kind === 'main') {
    return true;
  }
  const mainTrack = catalog.tracks.find((candidate) => candidate.kind === 'main');
  return (
    mainTrack !== undefined && isTrackMastered(mainTrack, lessons, progresses, unlocked, miniGames)
  );
}

/** Previous world in the track mastered (first world: track available); a `coming-soon` predecessor is skipped
 * so later worlds can open when content is authored out of order. */
function isWorldAvailable(
  catalog: TracksCatalog,
  world: World,
  lessons: readonly Lesson[],
  progresses: readonly LessonProgress[],
  unlocked?: ReadonlySet<string>,
  miniGames?: readonly MiniGameProgress[],
): boolean {
  const track = findTrack(catalog, world);
  if (track === undefined) {
    return false;
  }
  const sorted = worldsSorted(track);
  const index = sorted.findIndex((candidate) => candidate.id === world.id);
  for (let i = index - 1; i >= 0; i -= 1) {
    const previous = sorted[i];
    if (previous === undefined || worldLessons(previous, lessons).length === 0) {
      continue; // coming-soon: keep looking further back
    }
    return isWorldEffectivelyMastered(previous, lessons, progresses, unlocked, miniGames);
  }
  return isTrackAvailable(catalog, track, lessons, progresses, unlocked, miniGames);
}

/** Journey-map status (domain-model.md §3). `unlocked` makes a world `available` past the natural rule (not
 * `coming-soon`); `miniGames` decides whether its boss is won (`mastered`). */
export function worldStatus(
  catalog: TracksCatalog,
  world: World,
  lessons: readonly Lesson[],
  progresses: readonly LessonProgress[],
  unlocked?: ReadonlySet<string>,
  miniGames?: readonly MiniGameProgress[],
): WorldStatus {
  if (worldLessons(world, lessons).length === 0) {
    return 'coming-soon';
  }
  if (isWorldMastered(world, lessons, progresses, miniGames)) {
    return 'mastered';
  }
  if (unlocked?.has(world.id) === true) {
    return 'available';
  }
  return isWorldAvailable(catalog, world, lessons, progresses, unlocked, miniGames)
    ? 'available'
    : 'locked';
}

/** `none` without a boss; `won` on any win of its mini-game (Journey or Play); `available` once every authored
 * lesson is `complete` or better and the world is unlocked; else `locked`. */
export function worldBossStatus(
  catalog: TracksCatalog,
  world: World,
  lessons: readonly Lesson[],
  progresses: readonly LessonProgress[],
  unlocked?: ReadonlySet<string>,
  miniGames?: readonly MiniGameProgress[],
): WorldBossStatus {
  if (world.boss === undefined) {
    return 'none';
  }
  if (isWorldBossWon(world, miniGames)) {
    return 'won';
  }
  const status = worldStatus(catalog, world, lessons, progresses, unlocked, miniGames);
  if (status === 'locked' || status === 'coming-soon') {
    return 'locked';
  }
  const progressByLesson = new Map(progresses.map((progress) => [progress.lessonId, progress]));
  const lessonsOfWorld = worldLessons(world, lessons);
  const allLessonsDone = lessonsOfWorld.every((lesson) => {
    const lessonState = lessonStatus(lesson, progressByLesson.get(lesson.id));
    return lessonState === 'complete' || lessonState === 'mastered';
  });
  return allLessonsDone ? 'available' : 'locked';
}

/** First lesson of a world is available with the world; the next once the previous is `complete`+ (`mastered` implies
 * it); `unlocked` ids are always reachable and satisfy the gate after them (domain-model.md §3). */
export function lessonAvailability(
  catalog: TracksCatalog,
  lessons: readonly Lesson[],
  progresses: readonly LessonProgress[],
  unlocked?: ReadonlySet<string>,
  miniGames?: readonly MiniGameProgress[],
): ReadonlyMap<string, JourneyLessonStatus> {
  const progressByLesson = new Map(progresses.map((progress) => [progress.lessonId, progress]));
  const result = new Map<string, JourneyLessonStatus>();

  for (const track of catalog.tracks) {
    for (const world of worldsSorted(track)) {
      const status = worldStatus(catalog, world, lessons, progresses, unlocked, miniGames);
      let previousSatisfied = status === 'available' || status === 'mastered';

      for (const lesson of worldLessons(world, lessons)) {
        const lessonUnlocked = unlocked?.has(lesson.id) === true;
        const raw = lessonStatus(lesson, progressByLesson.get(lesson.id));
        const mapped: JourneyLessonStatus =
          raw === 'mastered'
            ? 'mastered'
            : raw === 'complete'
              ? 'complete'
              : previousSatisfied || lessonUnlocked
                ? 'available'
                : 'locked';
        result.set(lesson.id, mapped);
        previousSatisfied = raw === 'complete' || raw === 'mastered' || lessonUnlocked;
      }
    }
  }

  return result;
}

function trackStars(
  track: Track,
  lessons: readonly Lesson[],
  progresses: readonly LessonProgress[],
): number {
  const lessonIds = new Set(
    track.worlds.flatMap((world) => worldLessons(world, lessons).map((lesson) => lesson.id)),
  );
  return totalStars(progresses.filter((progress) => lessonIds.has(progress.lessonId)));
}

/** Session priority (domain-model.md §3.3): main track, then branch tracks by fewest stars (ties: catalog order);
 * shared by `nextLesson` and `nextStep`. */
function orderedTracksForNext(
  catalog: TracksCatalog,
  lessons: readonly Lesson[],
  progresses: readonly LessonProgress[],
): readonly Track[] {
  const mainTrack = catalog.tracks.find((track) => track.kind === 'main');
  const branchTracks = catalog.tracks
    .map((track, index) => ({ track, index }))
    .filter((entry) => entry.track.kind === 'branch')
    .sort((a, b) => {
      const starsDiff =
        trackStars(a.track, lessons, progresses) - trackStars(b.track, lessons, progresses);
      return starsDiff !== 0 ? starsDiff : a.index - b.index;
    })
    .map((entry) => entry.track);
  return mainTrack === undefined ? branchTracks : [mainTrack, ...branchTracks];
}

/** First available-but-not-complete lesson (§3.3): main track, then the least advanced branch track; `null` when done
 * or blocked on an unwon world boss ({@link nextStep}). Branch tie-break is a placeholder until a 2nd branch has content. */
export function nextLesson<
  E extends ExerciseDefBase,
  Demo extends { readonly textKey: string } = { readonly textKey: string },
>(
  catalog: TracksCatalog,
  lessons: readonly Lesson<E, Demo>[],
  progresses: readonly LessonProgress[],
  unlocked?: ReadonlySet<string>,
  miniGames?: readonly MiniGameProgress[],
): Lesson<E, Demo> | null {
  const availability = lessonAvailability(catalog, lessons, progresses, unlocked, miniGames);

  const firstAvailableIn = (track: Track): Lesson<E, Demo> | null => {
    for (const world of worldsSorted(track)) {
      for (const lesson of worldLessons(world, lessons)) {
        if (availability.get(lesson.id) === 'available') {
          return lesson;
        }
      }
    }
    return null;
  };

  for (const track of orderedTracksForNext(catalog, lessons, progresses)) {
    const found = firstAvailableIn(track);
    if (found !== null) {
      return found;
    }
  }

  return null;
}

/** Next lesson ({@link nextLesson}) or, once a world's lessons are done, its available unwon boss (an earlier boss
 * blocks later ones); `null` when all done. */
export type NextStep<
  E extends ExerciseDefBase = ExerciseDefBase,
  Demo extends { readonly textKey: string } = { readonly textKey: string },
> =
  | { readonly kind: 'lesson'; readonly lesson: Lesson<E, Demo> }
  | { readonly kind: 'world-boss'; readonly world: World };

export function nextStep<
  E extends ExerciseDefBase,
  Demo extends { readonly textKey: string } = { readonly textKey: string },
>(
  catalog: TracksCatalog,
  lessons: readonly Lesson<E, Demo>[],
  progresses: readonly LessonProgress[],
  unlocked?: ReadonlySet<string>,
  miniGames?: readonly MiniGameProgress[],
): NextStep<E, Demo> | null {
  const lesson = nextLesson(catalog, lessons, progresses, unlocked, miniGames);
  if (lesson !== null) {
    return { kind: 'lesson', lesson };
  }

  for (const track of orderedTracksForNext(catalog, lessons, progresses)) {
    for (const world of worldsSorted(track)) {
      const bossStatus = worldBossStatus(catalog, world, lessons, progresses, unlocked, miniGames);
      if (bossStatus === 'available') {
        return { kind: 'world-boss', world };
      }
    }
  }

  return null;
}

function isRankSatisfied(
  after: string,
  catalog: TracksCatalog,
  lessons: readonly Lesson[],
  progresses: readonly LessonProgress[],
  unlocked?: ReadonlySet<string>,
  miniGames?: readonly MiniGameProgress[],
): boolean {
  if (after === 'start') {
    return true;
  }
  if (after === 'all-tracks') {
    return catalog.tracks.every((track) =>
      isTrackMastered(track, lessons, progresses, unlocked, miniGames),
    );
  }
  if (after.startsWith('world:')) {
    const world = findWorld(catalog, after.slice('world:'.length));
    return (
      world !== undefined &&
      isWorldEffectivelyMastered(world, lessons, progresses, unlocked, miniGames)
    );
  }
  if (after.startsWith('track:')) {
    const track = catalog.tracks.find((candidate) => candidate.id === after.slice('track:'.length));
    return track !== undefined && isTrackMastered(track, lessons, progresses, unlocked, miniGames);
  }
  return false;
}

/** Highest rank whose `after` is satisfied, assuming `catalog.ranks` runs easiest to hardest; `undefined` when empty. */
export function currentRank(
  catalog: TracksCatalog,
  lessons: readonly Lesson[],
  progresses: readonly LessonProgress[],
  unlocked?: ReadonlySet<string>,
  miniGames?: readonly MiniGameProgress[],
): RankDef | undefined {
  let current: RankDef | undefined;
  for (const rank of catalog.ranks) {
    if (isRankSatisfied(rank.after, catalog, lessons, progresses, unlocked, miniGames)) {
      current = rank;
    }
  }
  return current;
}

import type { Lesson } from './lesson.ts';
import { lessonStatus, totalStars } from './progress.ts';
import type { LessonProgress, MiniGameProgress } from './progress.ts';

/** Fixed set of habitats a world can be set in (app-structure.md §8: one habitat per world). */
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

/** True if `value` is one of the fixed habitat ids. */
export function isHabitat(value: string): value is Habitat {
  return (HABITATS as readonly string[]).includes(value);
}

/** One world in a track: one habitat, `lessons[]` are derived from compiled content (`worldLessons`). */
export interface World {
  readonly id: string;
  /** Track id this world belongs to. */
  readonly track: string;
  /** 1-based order within its track. */
  readonly order: number;
  readonly habitat: Habitat;
  readonly titleKey: string;
  /**
   * Id of this world's boss mini-game (domain-model.md §3 "World mastered"), if it has one.
   * Distinct from a lesson's own `boss` (its per-lesson mini-game): a world boss is played once
   * every lesson of the world is complete, gates the world's mastery, and is not tied to any one
   * lesson's boss slot.
   */
  readonly boss?: string;
}

/** Main road (Basics) or one of the branch tracks (Openings / Tactics / Endgames), any order. */
export interface Track {
  readonly id: string;
  readonly kind: 'main' | 'branch';
  readonly titleKey: string;
  readonly worlds: readonly World[];
}

/**
 * A rank's unlock condition: `'start'` (always), `'world:<id>'`, `'track:<id>'` or `'all-tracks'`
 * (domain-model.md §1, Rank).
 */
export interface RankDef {
  readonly id: string;
  readonly after: string;
}

/** Whole tracks/worlds/ranks catalog, compiled from `tracks.yaml`. */
export interface TracksCatalog {
  readonly tracks: readonly Track[];
  readonly ranks: readonly RankDef[];
}

/** A lesson's status on the Journey map (domain-model.md §3). */
export type JourneyLessonStatus = 'locked' | 'available' | 'complete' | 'mastered';

/** A world's status on the Journey map. `coming-soon`: no lesson has been authored for it yet. */
export type WorldStatus = 'locked' | 'available' | 'mastered' | 'coming-soon';

/**
 * A world boss's status (domain-model.md §3): `none` when the world has no boss (`World.boss` is
 * unset); otherwise `locked` / `available` / `won` — see {@link worldBossStatus}.
 */
export type WorldBossStatus = 'none' | 'locked' | 'available' | 'won';

/**
 * `lessons` belonging to `world`, sorted by `order`. A world with no authored lessons yet (content
 * not written) has none: callers treat that as `coming-soon` (see {@link worldStatus}).
 */
export function worldLessons(world: World, lessons: readonly Lesson[]): readonly Lesson[] {
  return lessons
    .filter((lesson) => lesson.world === world.id)
    .slice()
    .sort((a, b) => a.order - b.order);
}

function worldsSorted(track: Track): readonly World[] {
  return track.worlds.slice().sort((a, b) => a.order - b.order);
}

function findWorld(catalog: TracksCatalog, worldId: string): World | undefined {
  for (const track of catalog.tracks) {
    const found = track.worlds.find((world) => world.id === worldId);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
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

/**
 * World mastered (domain-model.md §3): every authored lesson mastered, every lesson with a boss
 * has `bossStars >= 2` ("boss won"), and — when the world has its own boss (`World.boss`) — that
 * boss is won too. A `coming-soon` world (no authored lessons) is never naturally mastered; see
 * {@link isWorldEffectivelyMastered} for the parent-unlock override.
 */
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

/**
 * `isWorldMastered`, or the world was unlocked by a parent/test-out (`unlocked` holds its id):
 * counts as mastered for gating the next world/track/rank, per `LessonProgress.masteredVia`
 * (`'parent'`) — the parent area (a later task) is what actually adds ids to this set. The
 * override also stands in for an unwon world boss (domain-model.md §3).
 */
function isWorldEffectivelyMastered(
  world: World,
  lessons: readonly Lesson[],
  progresses: readonly LessonProgress[],
  unlocked?: ReadonlySet<string>,
  miniGames?: readonly MiniGameProgress[],
): boolean {
  return isWorldMastered(world, lessons, progresses, miniGames) || unlocked?.has(world.id) === true;
}

/** Track mastered (domain-model.md §3): all its worlds effectively mastered. */
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

/**
 * World available (domain-model.md §3): previous world in the track mastered (first world: track
 * available). A `coming-soon` predecessor never blocks — it is skipped when looking for the
 * nearest previous world with authored content, so a later world can still open up (e.g. while
 * content is authored out of order) instead of being locked forever behind unwritten lessons.
 */
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

/**
 * World status for the Journey map (domain-model.md §3). `unlocked` (lesson/world ids from a
 * parent unlock or test-out) makes a world `available` even where the natural rule would lock it;
 * it does not apply to a `coming-soon` world (there is nothing to show yet). `miniGames` (a
 * profile's standalone mini-game progress) decides whether this world's own boss, if it has one,
 * is won — needed for `mastered`.
 */
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

/**
 * A world boss's status (domain-model.md §3): `none` when the world has no boss. Otherwise `won`
 * once its mini-game has any win (`MiniGameProgress.wins >= 1`, from the Journey node or the Play
 * screen); else `available` once every authored lesson of the world is `complete` or better and
 * the world itself is not locked (or `coming-soon`); else `locked`.
 */
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

/**
 * Per-lesson status for the Journey map (domain-model.md §3): first lesson of a world is
 * `available` when the world is `available` or `mastered`; each next lesson becomes reachable
 * once the previous one is `complete` (a `mastered` lesson also satisfies this — mastery implies
 * at least as much progress as completion). `unlocked` lesson ids are always reachable and count
 * as satisfying that gate for the lesson after them, same as a `complete` one.
 */
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

/** Total stars earned across a track's authored lessons (used to rank branch tracks by progress). */
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

/**
 * Tracks in session priority order (domain-model.md §3.3): the main track first, then branch
 * tracks by fewest stars earned so far (ties broken by catalog order) — shared by `nextLesson` and
 * `nextStep` so both scan tracks/worlds in the same order.
 */
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

/**
 * First available-but-not-complete lesson (domain-model.md §3.3 session order): main-track order
 * first, then the least advanced branch track (fewest stars earned so far, ties broken by catalog
 * order) once Basics is mastered. `null` when nothing is left to do (including: blocked on an
 * available-but-unwon world boss — see {@link nextStep} for that case). The branch-track tie-break
 * is a simple placeholder — refine once more than one branch track has authored content.
 */
export function nextLesson(
  catalog: TracksCatalog,
  lessons: readonly Lesson[],
  progresses: readonly LessonProgress[],
  unlocked?: ReadonlySet<string>,
  miniGames?: readonly MiniGameProgress[],
): Lesson | null {
  const availability = lessonAvailability(catalog, lessons, progresses, unlocked, miniGames);

  const firstAvailableIn = (track: Track): Lesson | null => {
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

/**
 * The next thing to do on the Journey (domain-model.md §3.3, extended for world bosses): the next
 * available lesson (same as {@link nextLesson}), or — once a world's lessons are all done and its
 * boss is `available` but not yet won — that world boss. Scans tracks/worlds in the same priority
 * order as `nextLesson`, so at most one boss can ever be "next" (an earlier one blocks anything
 * after it). `null` once every lesson and every world boss is done.
 */
export type NextStep =
  | { readonly kind: 'lesson'; readonly lesson: Lesson }
  | { readonly kind: 'world-boss'; readonly world: World };

export function nextStep(
  catalog: TracksCatalog,
  lessons: readonly Lesson[],
  progresses: readonly LessonProgress[],
  unlocked?: ReadonlySet<string>,
  miniGames?: readonly MiniGameProgress[],
): NextStep | null {
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

/** True when a rank's `after` condition is satisfied. */
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

/**
 * Highest rank whose `after` condition is satisfied (domain-model.md §3), assuming `catalog.ranks`
 * is listed from easiest to hardest (as authored in `tracks.yaml`). `undefined` only if `ranks` is
 * empty.
 */
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

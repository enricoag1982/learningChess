import { describe, expect, it } from 'vitest';

import type { Track, TracksCatalog, World } from '../domain/journey.ts';
import type { ExerciseDef } from '../domain/exercise/types.ts';
import type { Lesson, MiniGame } from '../domain/lesson.ts';
import { newLessonProgress, recordExerciseStars } from '../domain/progress.ts';
import type { Attempt, LessonProgress, MiniGameProgress } from '../domain/progress.ts';
import type { Profile } from '../domain/profile.ts';
import type { ParentLock } from '../domain/parent-lock.ts';
import { seededRandom } from '../domain/random.ts';
import { loadJourney } from './journey.ts';
import type {
  AppSettings,
  Clock,
  ContentSource,
  GameRecordRepository,
  IdGenerator,
  ParentLockRepository,
  PasswordFileWriter,
  ProfileRepository,
  ProgressRepository,
  SettingsRepository,
} from './ports.ts';
import type { AppDeps } from './use-cases.ts';

function makeGameRecordRepo(): GameRecordRepository {
  return {
    add: () => Promise.resolve(),
    listByProfile: () => Promise.resolve([]),
    deleteProfileData: () => Promise.resolve(),
  };
}

const EMPTY_POSITION = {
  pieces: {},
  markers: { stars: [], blocked: [] },
  toMove: 'w',
  castling: '-',
  enPassant: null,
} as const;

const NOW = new Date('2026-01-01T00:00:00.000Z');

function makeExercise(id: string): ExerciseDef {
  return {
    id,
    concept: `${id}-concept`,
    textKey: `lessons:${id}`,
    position: EMPTY_POSITION,
    type: 'collect-stars',
    stars3: 1,
    stars2: 2,
  };
}

function makeLesson(id: string, world: string, order: number): Lesson {
  return {
    id,
    world,
    order,
    concept: `${id}-concept`,
    character: 'rhino',
    titleKey: `lessons:${id}.title`,
    storyKey: `lessons:${id}.story`,
    demo: {
      position: EMPTY_POSITION,
      textKey: `lessons:${id}.demo`,
      highlight: { legalMovesFrom: 'd4' },
    },
    guided: [],
    exercises: [makeExercise(`${id}-01`)],
  };
}

function masteredProgress(lesson: Lesson): LessonProgress {
  const progress = newLessonProgress(`p-${lesson.id}`, 'profile-1', lesson.id, NOW);
  return recordExerciseStars(progress, `${lesson.id}-01`, 3, lesson, NOW);
}

const W1: World = {
  id: 'w1',
  track: 'basics',
  order: 1,
  habitat: 'meadow',
  titleKey: 'journey:worlds.board',
};
const BASICS: Track = {
  id: 'basics',
  kind: 'main',
  titleKey: 'journey:tracks.basics',
  worlds: [W1],
};
const CATALOG: TracksCatalog = {
  tracks: [BASICS],
  ranks: [
    { id: 'pawn', after: 'start' },
    { id: 'knight', after: 'world:w1' },
  ],
};

const L1 = makeLesson('l1', 'w1', 1);
const L2 = makeLesson('l2', 'w1', 2);
const LESSONS = [L1, L2];

function makeContent(catalog: TracksCatalog | undefined): ContentSource {
  const lessonsById = new Map(LESSONS.map((lesson) => [lesson.id, lesson]));
  return {
    lessons: () => LESSONS,
    lesson: (id) => lessonsById.get(id),
    minigames: () => [],
    minigame: () => undefined,
    ...(catalog === undefined ? {} : { catalog: () => catalog }),
  };
}

function makeProgressRepo(
  initial: readonly LessonProgress[] = [],
  initialMiniGames: readonly MiniGameProgress[] = [],
): ProgressRepository {
  const lessons = new Map(initial.map((progress) => [progress.lessonId, progress]));
  const miniGames = new Map(initialMiniGames.map((progress) => [progress.miniGameId, progress]));
  return {
    listLessons: (profileId) =>
      Promise.resolve([...lessons.values()].filter((p) => p.profileId === profileId)),
    getLesson: (_profileId, lessonId) => Promise.resolve(lessons.get(lessonId)),
    saveLesson: (progress) => {
      lessons.set(progress.lessonId, progress);
      return Promise.resolve();
    },
    addAttempt: () => Promise.resolve(),
    listAttempts: () => Promise.resolve<Attempt[]>([]),
    getMiniGame: (_profileId, miniGameId) => Promise.resolve(miniGames.get(miniGameId)),
    listMiniGames: (profileId) =>
      Promise.resolve([...miniGames.values()].filter((p) => p.profileId === profileId)),
    saveMiniGame: (progress) => {
      miniGames.set(progress.miniGameId, progress);
      return Promise.resolve();
    },
    getConceptStats: () => Promise.resolve(undefined),
    listConceptStats: () => Promise.resolve([]),
    saveConceptStats: () => Promise.resolve(),
    deleteProfileData: () => Promise.resolve(),
  };
}

function makeProfileRepo(): ProfileRepository {
  return {
    list: () => Promise.resolve<Profile[]>([]),
    get: () => Promise.resolve(undefined),
    save: () => Promise.resolve(),
    delete: () => Promise.resolve(),
  };
}

function makeClock(): Clock {
  return { now: () => NOW };
}

function makeIds(): IdGenerator {
  let count = 0;
  return {
    next: () => {
      count += 1;
      return `id-${String(count)}`;
    },
  };
}

function makeParentLockRepo(): ParentLockRepository {
  return {
    get: () => Promise.resolve<ParentLock | undefined>(undefined),
    save: () => Promise.resolve(),
  };
}

function makePasswordFileWriter(): PasswordFileWriter {
  return { write: () => Promise.resolve({ location: 'fake.txt' }) };
}

function makeSettingsRepo(): SettingsRepository {
  return {
    get: () => Promise.resolve<AppSettings>({ lastProfileId: null, suggestedLevels: {} }),
    save: () => Promise.resolve(),
  };
}

function makeDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  return {
    profiles: makeProfileRepo(),
    progress: makeProgressRepo(),
    gameRecords: makeGameRecordRepo(),
    clock: makeClock(),
    ids: makeIds(),
    content: makeContent(CATALOG),
    parentLock: makeParentLockRepo(),
    passwordFile: makePasswordFileWriter(),
    settings: makeSettingsRepo(),
    random: seededRandom(1),
    ...overrides,
  };
}

describe('loadJourney', () => {
  it('returns the catalog and lessons straight from the content source', async () => {
    const deps = makeDeps();
    const journey = await loadJourney(deps, 'profile-1');
    expect(journey.catalog).toBe(CATALOG);
    expect(journey.lessons).toEqual(LESSONS);
  });

  it('with no progress: l1 available, l2 locked, next is l1, rank is pawn, 0 stars', async () => {
    const deps = makeDeps();

    const journey = await loadJourney(deps, 'profile-1');

    expect(journey.statuses.get('l1')).toBe('available');
    expect(journey.statuses.get('l2')).toBe('locked');
    expect(journey.next?.id).toBe('l1');
    expect(journey.nextStep).toEqual({ kind: 'lesson', lesson: L1 });
    expect(journey.rank?.id).toBe('pawn');
    expect(journey.totalStars).toBe(0);
    expect(journey.worlds).toEqual([{ world: W1, status: 'available', bossStatus: 'none' }]);
  });

  it('advances once w1 is mastered: next is null, rank is knight, stars counted', async () => {
    const progress = [masteredProgress(L1), masteredProgress(L2)];
    const deps = makeDeps({ progress: makeProgressRepo(progress) });

    const journey = await loadJourney(deps, 'profile-1');

    expect(journey.statuses.get('l1')).toBe('mastered');
    expect(journey.statuses.get('l2')).toBe('mastered');
    expect(journey.next).toBeNull();
    expect(journey.nextStep).toBeNull();
    expect(journey.rank?.id).toBe('knight');
    expect(journey.totalStars).toBe(6);
    expect(journey.worlds).toEqual([{ world: W1, status: 'mastered', bossStatus: 'none' }]);
  });

  it("only counts this profile's progress", async () => {
    const other = masteredProgress(L1);
    const deps = makeDeps({
      progress: makeProgressRepo([{ ...other, profileId: 'someone-else' }]),
    });

    const journey = await loadJourney(deps, 'profile-1');

    expect(journey.statuses.get('l1')).toBe('available');
    expect(journey.totalStars).toBe(0);
  });

  it('throws a clear error when the content source has no catalog()', async () => {
    const deps = makeDeps({ content: makeContent(undefined) });
    await expect(loadJourney(deps, 'profile-1')).rejects.toThrow(
      'ContentSource.catalog() is not implemented',
    );
  });
});

// World with its own boss (M3.2a): w1's lessons plus a `boss-mg` mini-game unlocked by l2.
const W1_BOSS: World = { ...W1, boss: 'boss-mg' };
const BASICS_BOSS: Track = { ...BASICS, worlds: [W1_BOSS] };
const CATALOG_BOSS: TracksCatalog = { ...CATALOG, tracks: [BASICS_BOSS] };
const BOSS_MINIGAME: MiniGame = {
  mode: 'static',
  id: 'boss-mg',
  concept: 'boss-concept',
  titleKey: 'fixtures:boss-mg.title',
  goalKey: 'fixtures:boss-mg.goal',
  unlockAfter: 'l2',
  position: EMPTY_POSITION,
  par: 5,
};

function makeContentWithBoss(): ContentSource {
  const lessonsById = new Map(LESSONS.map((lesson) => [lesson.id, lesson]));
  return {
    lessons: () => LESSONS,
    lesson: (id) => lessonsById.get(id),
    minigames: () => [BOSS_MINIGAME],
    minigame: (id) => (id === BOSS_MINIGAME.id ? BOSS_MINIGAME : undefined),
    catalog: () => CATALOG_BOSS,
  };
}

function bossMiniGameProgress(wins: number): MiniGameProgress {
  const nowIso = NOW.toISOString();
  return {
    id: 'mg-1',
    profileId: 'profile-1',
    miniGameId: BOSS_MINIGAME.id,
    bestStars: wins > 0 ? 3 : 0,
    plays: Math.max(wins, 1),
    wins,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

describe('loadJourney with a world boss', () => {
  it('boss locked while lessons are unfinished; world not mastered even once lessons are', async () => {
    const deps = makeDeps({
      content: makeContentWithBoss(),
      progress: makeProgressRepo([masteredProgress(L1)]),
    });

    const journey = await loadJourney(deps, 'profile-1');

    expect(journey.worlds).toEqual([{ world: W1_BOSS, status: 'available', bossStatus: 'locked' }]);
    expect(journey.nextStep).toEqual({ kind: 'lesson', lesson: L2 });
  });

  it('boss available once every lesson is complete, and is the next step (not a lesson)', async () => {
    const deps = makeDeps({
      content: makeContentWithBoss(),
      progress: makeProgressRepo([masteredProgress(L1), masteredProgress(L2)]),
    });

    const journey = await loadJourney(deps, 'profile-1');

    expect(journey.worlds).toEqual([
      { world: W1_BOSS, status: 'available', bossStatus: 'available' },
    ]);
    expect(journey.next).toBeNull(); // no lesson left — the boss is next, not a lesson
    expect(journey.nextStep).toEqual({ kind: 'world-boss', world: W1_BOSS });
    expect(journey.rank?.id).toBe('pawn'); // world:w1 rank not reached: boss unwon
  });

  it('boss won (from Play or the Journey node) masters the world and advances the rank', async () => {
    const deps = makeDeps({
      content: makeContentWithBoss(),
      progress: makeProgressRepo(
        [masteredProgress(L1), masteredProgress(L2)],
        [bossMiniGameProgress(1)],
      ),
    });

    const journey = await loadJourney(deps, 'profile-1');

    expect(journey.worlds).toEqual([{ world: W1_BOSS, status: 'mastered', bossStatus: 'won' }]);
    expect(journey.nextStep).toBeNull();
    expect(journey.rank?.id).toBe('knight');
  });
});

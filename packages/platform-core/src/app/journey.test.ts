import { describe, expect, it } from 'vitest';

import type { Track, TracksCatalog, World } from '../domain/journey.ts';
import type { Lesson } from '../domain/lesson.ts';
import { newLessonProgress, recordExerciseStars } from '../domain/progress.ts';
import type { LessonProgress, MiniGameProgress } from '../domain/progress.ts';
import {
  makeProgressRepo as buildProgressRepo,
  makeExercise,
  makeLesson as buildLesson,
  makeMiniGame as buildMiniGame,
  makeContentSource,
  makeDeps as buildDeps,
} from '../testing/index.ts';
import { loadJourney } from './journey.ts';
import type { ContentSource } from './ports.ts';
import type { AppDeps } from './use-cases.ts';

const NOW = new Date('2026-01-01T00:00:00.000Z');

function makeLesson(id: string, world: string, order: number) {
  return buildLesson({
    id,
    world,
    order,
    concept: `${id}-concept`,
    exercises: [makeExercise({ id: `${id}-01`, concept: `${id}-01-concept` })],
  });
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
  return makeContentSource({ lessons: LESSONS, catalog });
}

function makeProgressRepo(
  lessons: readonly LessonProgress[] = [],
  miniGames: readonly MiniGameProgress[] = [],
): AppDeps['progress'] {
  return buildProgressRepo({ lessons, miniGames });
}

function makeDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  return buildDeps({
    clock: { now: () => NOW },
    content: makeContent(CATALOG),
    ...overrides,
  });
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

// World with its own boss: w1's lessons plus a `boss-mg` mini-game unlocked by l2.
const W1_BOSS: World = { ...W1, boss: 'boss-mg' };
const BASICS_BOSS: Track = { ...BASICS, worlds: [W1_BOSS] };
const CATALOG_BOSS: TracksCatalog = { ...CATALOG, tracks: [BASICS_BOSS] };
const BOSS_MINIGAME = buildMiniGame({
  id: 'boss-mg',
  concept: 'boss-concept',
  titleKey: 'fixtures:boss-mg.title',
  goalKey: 'fixtures:boss-mg.goal',
  unlockAfter: 'l2',
  par: 5,
});

function makeContentWithBoss(): ContentSource {
  return makeContentSource({ lessons: LESSONS, minigames: [BOSS_MINIGAME], catalog: CATALOG_BOSS });
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

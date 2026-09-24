import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { getLessonProgress } from '@chess-kids/core';
import type {
  ContentSource,
  Lesson,
  MiniGame,
  MiniGameProgress,
  Track,
  TracksCatalog,
  World,
} from '@chess-kids/core';
import '../i18n.ts';
import { fixtureLesson } from '../testing/fixtures.ts';
import { renderWithStore } from '../testing/render-with-store.tsx';
import { createTestServices } from '../testing/test-services.ts';
import { JourneyScreen } from './JourneyScreen.tsx';

afterEach(cleanup);

// World order 2 (not 1): JourneyScreen shows the Owl instead of a character icon for a main
// track's very first world (matched by `world.order === 1`), which this fixture is not testing.
const WORLD: World = {
  id: 'test',
  track: 'test',
  order: 2,
  habitat: 'meadow',
  titleKey: 'fixtures:world',
};
const TRACK: Track = { id: 'test', kind: 'main', titleKey: 'fixtures:track', worlds: [WORLD] };
const CATALOG: TracksCatalog = { tracks: [TRACK], ranks: [{ id: 'pawn', after: 'start' }] };

/** Two lessons in the same (fixture) world: `l1` (rhino) then `l2` (elephant). */
function twoLessons(): readonly [Lesson, Lesson] {
  const l1 = fixtureLesson({ id: 'l1', order: 1, character: 'rhino' });
  const l2 = fixtureLesson({ id: 'l2', order: 2, character: 'elephant' });
  return [l1, l2];
}

function contentSource(lessons: readonly Lesson[]): ContentSource {
  return {
    lessons: () => lessons,
    lesson: (id) => lessons.find((lesson) => lesson.id === id),
    minigames: () => [],
    minigame: () => undefined,
    catalog: () => CATALOG,
  };
}

describe('JourneyScreen', () => {
  it('shows the first lesson current and the next one locked', async () => {
    const [l1, l2] = twoLessons();
    const services = createTestServices(contentSource([l1, l2]));
    await renderWithStore(<JourneyScreen />, services);

    await screen.findByRole('button', { name: /Rhino the Rook, current/ });
    expect(screen.getByRole('button', { name: /Elephant the Bishop, locked/ })).toBeTruthy();
  });

  it('tapping the locked lesson explains what to finish first', async () => {
    const [l1, l2] = twoLessons();
    const services = createTestServices(contentSource([l1, l2]));
    await renderWithStore(<JourneyScreen />, services);

    fireEvent.click(await screen.findByRole('button', { name: /Elephant the Bishop, locked/ }));

    await screen.findByText('Finish Rhino first!');
  });

  it('tapping the current lesson opens it', async () => {
    const [l1, l2] = twoLessons();
    const services = createTestServices(contentSource([l1, l2]));
    const { store } = await renderWithStore(<JourneyScreen />, services);

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: /Rhino the Rook, current/ }));
    });

    expect(store.getState().screen).toBe('lesson');
    expect(store.getState().lessonId).toBe('l1');
  });

  it('back button returns to Home', async () => {
    const [l1, l2] = twoLessons();
    const services = createTestServices(contentSource([l1, l2]));
    const { store } = await renderWithStore(<JourneyScreen />, services);

    fireEvent.click(await screen.findByRole('button', { name: 'Back to Home' }));

    expect(store.getState().screen).toBe('home');
  });
});

// A one-lesson world with its own boss (M3.2a): dev fixture only, not the real tracks.yaml (the
// real World 3 boss arrives from another agent; the lead wires `boss: win-the-queen` at integration).
const WORLD_BOSS: World = { ...WORLD, boss: 'boss-mg' };
const TRACK_BOSS: Track = {
  id: 'test',
  kind: 'main',
  titleKey: 'fixtures:track',
  worlds: [WORLD_BOSS],
};
const CATALOG_BOSS: TracksCatalog = {
  tracks: [TRACK_BOSS],
  ranks: [{ id: 'pawn', after: 'start' }],
};
const BOSS_MINIGAME: MiniGame = {
  mode: 'static',
  id: 'boss-mg',
  concept: 'boss-concept',
  titleKey: 'fixtures:boss-mg.title',
  goalKey: 'fixtures:boss-mg.goal',
  unlockAfter: 'bl',
  position: {
    pieces: {},
    markers: { stars: [], blocked: [] },
    toMove: 'w',
    castling: '-',
    enPassant: null,
  },
  par: 5,
};

function contentSourceWithBoss(lesson: Lesson): ContentSource {
  return {
    lessons: () => [lesson],
    lesson: (id) => (id === lesson.id ? lesson : undefined),
    minigames: () => [BOSS_MINIGAME],
    minigame: (id) => (id === BOSS_MINIGAME.id ? BOSS_MINIGAME : undefined),
    catalog: () => CATALOG_BOSS,
  };
}

/** Marks `lesson` complete (every exercise at 1+ star) for the just-selected test profile. */
async function completeLesson(
  services: ReturnType<typeof createTestServices>,
  lesson: Lesson,
): Promise<void> {
  const [profile] = await services.deps.profiles.list();
  if (!profile) throw new Error('no profile found');
  const saved = await getLessonProgress(services.deps, profile.id, lesson.id);
  const bestStars = Object.fromEntries(
    lesson.exercises.map((exercise) => [exercise.id, 1 as const]),
  );
  await services.deps.progress.saveLesson({ ...saved, bestStars });
}

describe('JourneyScreen world boss node', () => {
  it('is locked while the world’s lessons are not all complete', async () => {
    const bl = fixtureLesson({ id: 'bl', order: 1, character: 'rhino' });
    const services = createTestServices(contentSourceWithBoss(bl));
    await renderWithStore(<JourneyScreen />, services);

    await screen.findByRole('button', { name: /^World boss: .*, locked$/ });
  });

  it('is available (highlighted as next) once every lesson of the world is complete', async () => {
    const bl = fixtureLesson({ id: 'bl', order: 1, character: 'rhino' });
    const services = createTestServices(contentSourceWithBoss(bl));
    const { store } = await renderWithStore(<JourneyScreen />, services);

    await completeLesson(services, bl);
    await act(async () => {
      await store.getState().refreshProgress();
    });

    const button = await screen.findByRole('button', { name: /^World boss: .*, available$/ });
    // Same "current" pulse the next lesson node gets: a sibling animated ring.
    expect(button.parentElement?.querySelector('.animate-ping')).toBeTruthy();
    expect(store.getState().journey?.nextStep).toEqual({ kind: 'world-boss', world: WORLD_BOSS });
  });

  it('is won once its mini-game has a win, and no longer offers to start it again as "available"', async () => {
    const bl = fixtureLesson({ id: 'bl', order: 1, character: 'rhino' });
    const services = createTestServices(contentSourceWithBoss(bl));
    const { store } = await renderWithStore(<JourneyScreen />, services);
    await completeLesson(services, bl);

    const nowIso = new Date().toISOString();
    const win: MiniGameProgress = {
      id: 'mg-1',
      profileId: store.getState().profile?.id ?? '',
      miniGameId: 'boss-mg',
      bestStars: 3,
      plays: 1,
      wins: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await services.deps.progress.saveMiniGame(win);
    await act(async () => {
      await store.getState().refreshProgress();
    });

    await screen.findByRole('button', { name: /^World boss: .*, won$/ });
    expect(screen.queryByRole('button', { name: /^World boss: .*, available$/ })).toBeNull();
  });

  it('tapping the available boss starts its mini-game session, returning to the Journey on exit', async () => {
    const bl = fixtureLesson({ id: 'bl', order: 1, character: 'rhino' });
    const services = createTestServices(contentSourceWithBoss(bl));
    const { store } = await renderWithStore(<JourneyScreen />, services);
    await completeLesson(services, bl);
    await act(async () => {
      await store.getState().refreshProgress();
    });

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: /^World boss: .*, available$/ }));
    });

    expect(store.getState().screen).toBe('minigame');
    expect(store.getState().miniGameId).toBe('boss-mg');
    expect(store.getState().miniGameOrigin).toBe('journey');

    store.getState().exitMiniGame();
    expect(store.getState().screen).toBe('journey');
  });

  it('tapping the locked boss does nothing', async () => {
    const bl = fixtureLesson({ id: 'bl', order: 1, character: 'rhino' });
    const services = createTestServices(contentSourceWithBoss(bl));
    const { store } = await renderWithStore(<JourneyScreen />, services);

    const screenBefore = store.getState().screen;
    fireEvent.click(await screen.findByRole('button', { name: /^World boss: .*, locked$/ }));

    expect(store.getState().screen).toBe(screenBefore); // unchanged: locked tap is a no-op
    expect(store.getState().miniGameId).toBeNull();
  });
});

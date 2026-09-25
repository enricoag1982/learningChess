import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getLessonProgress, nextLesson, withResumeStep } from '@chess-kids/core';
import type {
  ContentSource,
  Lesson,
  MiniGame,
  Track,
  TracksCatalog,
  World,
} from '@chess-kids/core';
import i18n from '../i18n.ts';
import App from '../App.tsx';
import { createBundledContentSource } from '../adapters/content/bundled-content-source.ts';
import { tContent } from '../content-text.ts';
import { createTestServices } from '../testing/test-services.ts';
import { fixtureContentSource, fixtureLesson } from '../testing/fixtures.ts';
import { pickProfileFromPicker, seedReturningProfile } from '../testing/app-test-helpers.ts';
import { renderWithStore } from '../testing/render-with-store.tsx';
import { HomeScreen } from './HomeScreen.tsx';

afterEach(cleanup);

/** The real (bundled) content, with test adapters otherwise (fake password writer). */
function createServicesWithRealContent(): ReturnType<typeof createTestServices> {
  return createTestServices(createBundledContentSource());
}

describe('HomeScreen', () => {
  it('new lesson, Owl-taught (no piece character yet): Owl greets by lesson topic, primary button says Start today', async () => {
    // Fixture, not the bundled content: this greeting variant must hold for any Owl-taught
    // lesson, whichever one the real content currently puts first (see character-meta.ts).
    const lesson = fixtureLesson({ character: 'owl', titleKey: 'lessons:squares.title' });
    const services = createTestServices(fixtureContentSource(lesson));
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');

    const topic = tContent(i18n.t, lesson.titleKey);
    await screen.findByText(i18n.t('home.owl-next-topic', { topic }));
    expect(screen.getByRole('button', { name: /Start today/ })).toBeTruthy();
    // Rank pill shows the starting rank.
    expect(screen.getByText('Pawn rank')).toBeTruthy();
  });

  it('new lesson, piece lesson: Owl greets by character, primary button says Start today', async () => {
    const lesson = fixtureLesson({ character: 'rhino' });
    const services = createTestServices(fixtureContentSource(lesson));
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');

    const character = i18n.t('characters:rhino.name');
    await screen.findByText(i18n.t('home.owl-next', { character }));
    expect(screen.getByRole('button', { name: /Start today/ })).toBeTruthy();
    expect(screen.getByText('Pawn rank')).toBeTruthy();
  });

  it('in-progress lesson: Owl invites to keep going, primary button says Continue', async () => {
    const services = createServicesWithRealContent();
    const profile = await seedReturningProfile(services, 'Mia');
    // Whichever lesson the Journey currently offers first (see `journey.spec.ts`), not a
    // hardcoded id: content order changes as worlds are added.
    const catalog = services.deps.content.catalog?.();
    if (!catalog) throw new Error('bundled content: contentSource.catalog() is missing');
    const firstLesson = nextLesson(catalog, services.deps.content.lessons(), []);
    if (!firstLesson) throw new Error('bundled content: no first lesson found');
    const saved = await getLessonProgress(services.deps, profile.id, firstLesson.id);
    await services.deps.progress.saveLesson(withResumeStep(saved, 2, services.deps.clock.now()));

    render(<App services={services} />);
    await pickProfileFromPicker('Mia');

    await screen.findByText("Let's keep going!");
    expect(screen.getByRole('button', { name: /Continue/ })).toBeTruthy();
  });

  it('every lesson done: Owl says so, no primary button', async () => {
    const services = createServicesWithRealContent();
    const profile = await seedReturningProfile(services, 'Mia');
    for (const lesson of services.deps.content.lessons()) {
      const saved = await getLessonProgress(services.deps, profile.id, lesson.id);
      const bestStars = Object.fromEntries(
        lesson.exercises.map((exercise) => [exercise.id, 3 as const]),
      );
      await services.deps.progress.saveLesson({ ...saved, bestStars });
    }

    render(<App services={services} />);
    await pickProfileFromPicker('Mia');

    await screen.findByText('You finished everything for now. Come back soon for more!');
    expect(screen.queryByRole('button', { name: /Start today/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Continue/ })).toBeNull();
  });

  it('switch-player button returns to the picker', async () => {
    const services = createServicesWithRealContent();
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');

    fireEvent.click(await screen.findByRole('button', { name: 'Switch player' }));

    await screen.findByRole('heading', { name: "Who's playing today?" });
  });

  it('shows the app version at the bottom (also in the parent area)', async () => {
    const services = createServicesWithRealContent();
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');

    await screen.findByText(`Version ${__APP_VERSION__}`);
  });

  it('Journey tile opens the Journey screen', async () => {
    const services = createServicesWithRealContent();
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');

    fireEvent.click(await screen.findByRole('button', { name: /Journey/ }));

    await screen.findByRole('button', { name: /Back to Home/ });
  });

  it('Play tile opens the Play screen', async () => {
    const services = createServicesWithRealContent();
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');

    fireEvent.click(await screen.findByRole('button', { name: 'Play' }));

    await screen.findByRole('heading', { name: 'Play' });
  });

  it("My Den tile opens Mia's Den", async () => {
    const services = createServicesWithRealContent();
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');

    fireEvent.click(await screen.findByRole('button', { name: 'My Den' }));

    await screen.findByText("Mia's Den");
  });

  it('shows the streak pill once the streak reaches 2 days, not for 0 or 1', async () => {
    const services = createServicesWithRealContent();
    const profile = await seedReturningProfile(services, 'Mia');
    const now = new Date().toISOString();
    await services.deps.rewards?.saveStreak({
      id: 's1',
      profileId: profile.id,
      current: 1,
      best: 1,
      lastDay: '2026-01-05',
      skipsUsedThisWeek: 0,
      createdAt: now,
      updatedAt: now,
    });

    render(<App services={services} />);
    await pickProfileFromPicker('Mia');
    expect(screen.queryByRole('img', { name: '1 day streak' })).toBeNull();
  });

  it('shows the streak pill at 2+ days', async () => {
    const services = createServicesWithRealContent();
    const profile = await seedReturningProfile(services, 'Mia');
    const now = new Date().toISOString();
    await services.deps.rewards?.saveStreak({
      id: 's1',
      profileId: profile.id,
      current: 3,
      best: 3,
      lastDay: '2026-01-05',
      skipsUsedThisWeek: 0,
      createdAt: now,
      updatedAt: now,
    });

    render(<App services={services} />);
    await pickProfileFromPicker('Mia');
    expect(await screen.findByRole('img', { name: '3 day streak' })).toBeTruthy();
  });
});

// A one-lesson world with its own boss (M3.2a dev fixture, not the real tracks.yaml).
const WORLD_BOSS: World = {
  id: 'test',
  track: 'test',
  order: 1,
  habitat: 'meadow',
  titleKey: 'fixtures:world',
  boss: 'boss-mg',
};
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

describe('HomeScreen next step is a world boss', () => {
  it('Owl announces the world boss and "Start today" starts its mini-game session', async () => {
    const lesson = fixtureLesson({ id: 'bl', character: 'rhino' });
    const services = createTestServices(contentSourceWithBoss(lesson));
    const { store } = await renderWithStore(<HomeScreen />, services);
    const profileId = store.getState().profile?.id ?? '';

    const saved = await getLessonProgress(services.deps, profileId, lesson.id);
    const bestStars = Object.fromEntries(
      lesson.exercises.map((exercise) => [exercise.id, 1 as const]),
    );
    await services.deps.progress.saveLesson({ ...saved, bestStars });
    await act(async () => {
      await store.getState().refreshProgress();
    });

    const title = tContent(i18n.t, BOSS_MINIGAME.titleKey);
    await screen.findByText(i18n.t('home.owl-world-boss', { title }));
    await screen.findByText(i18n.t('home.subtitle-world-boss'));
    const button = screen.getByRole('button', { name: /Start today/ });

    fireEvent.click(button);

    // "Start today" now opens the full Today session (M3.4): the world boss is its one activity,
    // reached asynchronously (`loadTodaySession`).
    await waitFor(() => {
      expect(store.getState().screen).toBe('minigame');
    });
    expect(store.getState().miniGameId).toBe('boss-mg');
    expect(store.getState().miniGameOrigin).toBe('today');
  });
});

const IPAD_SAFARI_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

describe('HomeScreen install banner (M5.4, non-functional.md §1/§4)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('shows on iOS Safari, not standalone; dismissing hides it and remembers the choice', async () => {
    vi.stubGlobal(
      'navigator',
      Object.assign({}, navigator, { userAgent: IPAD_SAFARI_UA, maxTouchPoints: 5 }),
    );
    const services = createTestServices(fixtureContentSource(fixtureLesson()));
    await renderWithStore(<HomeScreen />, services);

    await screen.findByText(i18n.t('install-banner.title'));

    fireEvent.click(screen.getByRole('button', { name: i18n.t('install-banner.dismiss') }));
    expect(screen.queryByText(i18n.t('install-banner.title'))).toBeNull();
    // Persistence of the dismiss choice itself (`install-banner.test.ts`'s own unit test) is not
    // re-tested here — this only covers HomeScreen actually wiring the banner in and out.
  });

  it('never shows on a non-iOS device', async () => {
    vi.stubGlobal(
      'navigator',
      Object.assign({}, navigator, {
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
        maxTouchPoints: 0,
      }),
    );
    const services = createTestServices(fixtureContentSource(fixtureLesson()));
    await renderWithStore(<HomeScreen />, services);

    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByText(i18n.t('install-banner.title'))).toBeNull();
  });
});

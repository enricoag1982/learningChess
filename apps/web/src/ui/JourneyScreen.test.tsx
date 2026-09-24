import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import type { ContentSource, Lesson, Track, TracksCatalog, World } from '@chess-kids/core';
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

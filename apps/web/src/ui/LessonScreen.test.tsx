import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import type { MiniGame } from '@chess-kids/core';
import { parseDiagram } from '@chess-kids/core';
import '../i18n.ts';
import { fixtureContentSource, fixtureExercise, fixtureLesson } from '../testing/fixtures.ts';
import { stubMatchMedia } from '../testing/mock-media-query.ts';
import { renderWithStore } from '../testing/render-with-store.tsx';
import { createTestServices } from '../testing/test-services.ts';
import { LessonScreen } from './LessonScreen.tsx';

afterEach(cleanup);

function fixtureBoss(): MiniGame {
  return {
    mode: 'static',
    id: 'fixture-boss',
    concept: 'fixture-move',
    position: parseDiagram(`
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      R . . . . . . p
    `),
    par: 1,
    moveLimit: 5,
    titleKey: 'fixtures:boss-title',
    goalKey: 'fixtures:boss-goal',
    unlockAfter: 'fixture',
  };
}

describe('LessonScreen', () => {
  it('Story: "Let me try" advances to the Demo step', async () => {
    const lesson = fixtureLesson();
    const services = createTestServices(fixtureContentSource(lesson));
    const { store } = await renderWithStore(<LessonScreen />, services);
    await act(async () => {
      await store.getState().startLesson(lesson.id);
    });

    await screen.findByRole('button', { name: /Let me try/ });
    fireEvent.click(screen.getByRole('button', { name: /Let me try/ }));

    await screen.findByRole('button', { name: /^Next/ });
    expect(store.getState().stepIndex).toBe(1);
  });

  describe('Skip (playtest 2)', () => {
    it('on Story: moves straight to Demo and marks Story skipped in StepPills', async () => {
      const restoreMatchMedia = stubMatchMedia('(min-width: 640px)'); // forces StepPills, not PhaseChip
      try {
        const lesson = fixtureLesson();
        const services = createTestServices(fixtureContentSource(lesson));
        const { store } = await renderWithStore(<LessonScreen />, services);
        await act(async () => {
          await store.getState().startLesson(lesson.id);
        });

        fireEvent.click(await screen.findByRole('button', { name: 'Skip' }));

        await screen.findByRole('button', { name: /^Next/ }); // Demo
        expect(store.getState().stepIndex).toBe(1);
        expect(screen.getByText('Story, skipped')).toBeTruthy();

        const profile = store.getState().profile;
        const saved = await services.deps.progress.getLesson(profile?.id ?? '', lesson.id);
        expect(saved?.skippedPhases).toEqual(['story']);
      } finally {
        restoreMatchMedia();
      }
    });

    it('on Demo: moves to Try and marks Demo skipped', async () => {
      const restoreMatchMedia = stubMatchMedia('(min-width: 640px)');
      try {
        const lesson = fixtureLesson({ guided: [fixtureExercise('guided-1')] });
        const services = createTestServices(fixtureContentSource(lesson));
        const { store } = await renderWithStore(<LessonScreen />, services);
        await act(async () => {
          await store.getState().startLesson(lesson.id);
        });

        fireEvent.click(await screen.findByRole('button', { name: /Let me try/ })); // Story -> Demo
        fireEvent.click(await screen.findByRole('button', { name: 'Skip' })); // Demo -> Try

        await screen.findByRole('button', { name: /^a1,/ }); // the guided try's own board
        expect(store.getState().stepIndex).toBe(2);
        expect(screen.getByText('Demo, skipped')).toBeTruthy();
      } finally {
        restoreMatchMedia();
      }
    });

    it('on Try: skips every remaining guided try, straight to the first scored exercise', async () => {
      const restoreMatchMedia = stubMatchMedia('(min-width: 640px)');
      try {
        const lesson = fixtureLesson({
          guided: [fixtureExercise('guided-1'), fixtureExercise('guided-2')],
        });
        const services = createTestServices(fixtureContentSource(lesson));
        const { store } = await renderWithStore(<LessonScreen />, services);
        await act(async () => {
          await store.getState().startLesson(lesson.id);
        });

        fireEvent.click(await screen.findByRole('button', { name: /Let me try/ })); // Story -> Demo
        fireEvent.click(await screen.findByRole('button', { name: /^Next/ })); // Demo -> Try (1/2)
        fireEvent.click(await screen.findByRole('button', { name: 'Skip' })); // Try -> Exercises

        await screen.findByRole('button', { name: /^a1,/ }); // the scored exercise's own board
        expect(store.getState().stepIndex).toBe(4); // story, demo, guided x2, exercise
        expect(screen.getByText('Try, skipped')).toBeTruthy();

        const profile = store.getState().profile;
        const saved = await services.deps.progress.getLesson(profile?.id ?? '', lesson.id);
        expect(saved?.skippedPhases).toEqual(['try']);
      } finally {
        restoreMatchMedia();
      }
    });

    it('never appears on a scored exercise step', async () => {
      const restoreMatchMedia = stubMatchMedia('(min-width: 640px)');
      try {
        const lesson = fixtureLesson(); // guided: []
        const services = createTestServices(fixtureContentSource(lesson));
        const { store } = await renderWithStore(<LessonScreen />, services);
        await act(async () => {
          await store.getState().startLesson(lesson.id);
        });

        fireEvent.click(await screen.findByRole('button', { name: /Let me try/ })); // Story -> Demo
        fireEvent.click(await screen.findByRole('button', { name: /^Next/ })); // Demo -> Exercise

        await screen.findByRole('button', { name: /^a1,/ });
        expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
      } finally {
        restoreMatchMedia();
      }
    });

    it('never appears on the boss step', async () => {
      const restoreMatchMedia = stubMatchMedia('(min-width: 640px)');
      try {
        const boss = fixtureBoss();
        const lesson = fixtureLesson({ boss: boss.id });
        const services = createTestServices(fixtureContentSource(lesson, [boss]));
        const { store } = await renderWithStore(<LessonScreen />, services);
        await act(async () => {
          await store.getState().startLesson(lesson.id);
        });

        fireEvent.click(await screen.findByRole('button', { name: /Let me try/ })); // Story -> Demo
        fireEvent.click(await screen.findByRole('button', { name: /^Next/ })); // Demo -> Exercise
        fireEvent.click(await screen.findByRole('button', { name: /^a1,/ })); // solve it
        fireEvent.click(screen.getByRole('button', { name: /^h1,/ }));
        fireEvent.click(await screen.findByRole('button', { name: /^Next/ })); // Exercise -> Boss

        await screen.findByRole('button', { name: /^a1,/ }); // the boss's own board
        expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
      } finally {
        restoreMatchMedia();
      }
    });

    it('resume shows the skipped marks', async () => {
      const restoreMatchMedia = stubMatchMedia('(min-width: 640px)');
      try {
        const lesson = fixtureLesson();
        const services = createTestServices(fixtureContentSource(lesson));
        const { store } = await renderWithStore(<LessonScreen />, services);
        await act(async () => {
          await store.getState().startLesson(lesson.id);
        });

        fireEvent.click(await screen.findByRole('button', { name: 'Skip' })); // skip Story
        await screen.findByRole('button', { name: /^Next/ }); // now on Demo

        // Leave, then resume the same lesson: `resumeStep` (Demo) and the Story skip mark both come
        // back from the saved `LessonProgress`, not from any leftover component state.
        act(() => {
          store.getState().exitLesson();
        });
        await act(async () => {
          await store.getState().startLesson(lesson.id);
        });

        await screen.findByRole('button', { name: /^Next/ }); // resumed straight at Demo
        expect(store.getState().stepIndex).toBe(1);
        expect(screen.getByText('Story, skipped')).toBeTruthy();
      } finally {
        restoreMatchMedia();
      }
    });
  });
});

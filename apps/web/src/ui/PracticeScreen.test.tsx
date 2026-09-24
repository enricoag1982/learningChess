import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { recordExerciseResult, startExercise } from '@chess-kids/core';
import '../i18n.ts';
import App from '../App.tsx';
import { fixtureContentSource, fixtureExercise, fixtureLesson } from '../testing/fixtures.ts';
import { pickProfileFromPicker, seedReturningProfile } from '../testing/app-test-helpers.ts';
import { renderWithStore } from '../testing/render-with-store.tsx';
import { createTestServices } from '../testing/test-services.ts';
import { PracticeScreen } from './PracticeScreen.tsx';

afterEach(cleanup);

describe('PracticeScreen', () => {
  it('nothing complete yet: no topics, warm-up disabled ("All done for today!")', async () => {
    const lesson = fixtureLesson();
    const services = createTestServices(fixtureContentSource(lesson));
    await renderWithStore(<PracticeScreen />, services);

    await screen.findByText('Finish a lesson to see it here!');
    expect(screen.getByText('All done for today!')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Daily warm-up/ }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('a complete lesson shows as a topic, with accuracy dots from its attempts', async () => {
    const lesson = fixtureLesson();
    const services = createTestServices(fixtureContentSource(lesson));
    const { store } = await renderWithStore(<PracticeScreen />, services);
    const profileId = store.getState().profile?.id ?? '';
    const exercise = lesson.exercises[0] ?? fixtureExercise();

    await recordExerciseResult(services.deps, {
      profileId,
      lesson,
      state: { ...startExercise(exercise), solved: true, moves: 1 },
      scored: true,
      durationMs: 500,
      nextStep: 1,
    });
    await act(async () => {
      await store.getState().refreshProgress();
    });

    await screen.findByRole('button', { name: /title, 1 of 1 correct/ });
  });

  it('a weak concept (accuracy < 60%, ≥3 results) gets the "Needs practice" tag', async () => {
    const lesson = fixtureLesson();
    const services = createTestServices(fixtureContentSource(lesson));
    const { store } = await renderWithStore(<PracticeScreen />, services);
    const profileId = store.getState().profile?.id ?? '';

    await services.deps.progress.saveLesson({
      id: 'lp1',
      profileId,
      lessonId: lesson.id,
      bestStars: { [lesson.exercises[0]?.id ?? '']: 1 },
      bossStars: 0,
      resumeStep: 5,
      completedAt: services.deps.clock.now().toISOString(),
      createdAt: services.deps.clock.now().toISOString(),
      updatedAt: services.deps.clock.now().toISOString(),
    });
    await services.deps.progress.saveConceptStats({
      id: 'cs1',
      profileId,
      conceptId: lesson.concept,
      recent: [false, false, true],
      createdAt: services.deps.clock.now().toISOString(),
      updatedAt: services.deps.clock.now().toISOString(),
    });
    await act(async () => {
      await store.getState().refreshProgress();
    });

    await screen.findByRole('button', { name: /Needs practice/ });
  });

  it('due warm-up card starts a review task; solving it updates the due count back to "All done for today!"', async () => {
    const lesson = fixtureLesson();
    const services = createTestServices(fixtureContentSource(lesson));
    const profile = await seedReturningProfile(services, 'Mia');

    await services.deps.progress.saveConceptStats({
      id: 'cs1',
      profileId: profile.id,
      conceptId: lesson.concept,
      recent: [],
      box: 1,
      dueAt: services.deps.clock.now().toISOString(),
      createdAt: services.deps.clock.now().toISOString(),
      updatedAt: services.deps.clock.now().toISOString(),
    });

    render(<App services={services} />);
    await pickProfileFromPicker('Mia');

    fireEvent.click(await screen.findByRole('button', { name: 'Practice' }));
    await screen.findByText('1 due today');

    fireEvent.click(screen.getByRole('button', { name: /Daily warm-up/ }));

    await screen.findByText('Warm-up 1/1');
    fireEvent.click(await screen.findByRole('button', { name: /^a1,/ }));
    fireEvent.click(screen.getByRole('button', { name: /^h1,/ }));

    await screen.findByText('Amazing!');
    fireEvent.click(await screen.findByRole('button', { name: /^Next/ }));

    // Back on Practice: the review moved the concept's box up, no longer due today.
    await screen.findByText('All done for today!');
    expect(screen.queryByText('1 due today')).toBeNull();

    const stats = await services.deps.progress.getConceptStats(profile.id, lesson.concept);
    expect(stats?.box).toBe(2);
  });
});

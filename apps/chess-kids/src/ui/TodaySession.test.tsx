import { describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { fixtureContentSource, fixtureLesson } from '@learn/subject-chess/web/testing/fixtures.ts';
import { seedReturningProfile } from '@learn/subject-chess/web/testing/app-test-helpers.ts';
import { renderApp } from '@learn/subject-chess/web/testing/render-app.tsx';
import { createTestServices } from '@learn/subject-chess/web/testing/test-services.ts';

describe('Today session (M3.4)', () => {
  it('Start today runs the due warm-up first ("Warm-up 1/1"), then lands in the next lesson', async () => {
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

    await renderApp(services, { at: 'home' });

    fireEvent.click(await screen.findByRole('button', { name: /Start today/ }));

    await screen.findByText('Warm-up 1/1');
    fireEvent.click(await screen.findByRole('button', { name: /^a1,/ }));
    fireEvent.click(screen.getByRole('button', { name: /^h1,/ }));
    await screen.findByText('Amazing!');
    fireEvent.click(await screen.findByRole('button', { name: /^Next/ }));

    // Warm-up done: the session's next activity is the lesson (the Journey's next step).
    await screen.findByRole('button', { name: /Let me try/ });

    // The review task itself must not have changed the lesson's own progress.
    const savedLesson = await services.deps.progress.getLesson(profile.id, lesson.id);
    expect(savedLesson?.bestStars ?? {}).toEqual({});

    const stats = await services.deps.progress.getConceptStats(profile.id, lesson.concept);
    expect(stats?.box).toBe(2);
  });

  it('leaving mid-warm-up (Close) abandons the whole session, back to Home', async () => {
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

    await renderApp(services, { at: 'home' });

    fireEvent.click(await screen.findByRole('button', { name: /Start today/ }));
    await screen.findByText('Warm-up 1/1');

    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));

    await screen.findByRole('heading', { level: 1, name: 'Chess for Kids' });
  });
});

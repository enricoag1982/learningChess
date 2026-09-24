import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { getLessonProgress, withResumeStep } from '@chess-kids/core';
import '../i18n.ts';
import App from '../App.tsx';
import { createBundledContentSource } from '../adapters/content/bundled-content-source.ts';
import { createTestServices } from '../testing/test-services.ts';
import { pickProfileFromPicker, seedReturningProfile } from '../testing/app-test-helpers.ts';

afterEach(cleanup);

/** The real (bundled) Rook lesson content, with test adapters otherwise (fake password writer). */
function createServicesWithRealContent(): ReturnType<typeof createTestServices> {
  return createTestServices(createBundledContentSource());
}

describe('HomeScreen', () => {
  it('new lesson: Owl greets by character, primary button says Start', async () => {
    const services = createServicesWithRealContent();
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');

    await screen.findByText("Hi! I'm Owl. Today you meet Rhino!");
    expect(screen.getByRole('button', { name: /Start/ })).toBeTruthy();
  });

  it('in-progress lesson: Owl welcomes back, primary button says Continue', async () => {
    const services = createServicesWithRealContent();
    const profile = await seedReturningProfile(services, 'Mia');
    const saved = await getLessonProgress(services.deps, profile.id, 'rook');
    await services.deps.progress.saveLesson(withResumeStep(saved, 2, services.deps.clock.now()));

    render(<App services={services} />);
    await pickProfileFromPicker('Mia');

    await screen.findByText("Welcome back! Let's keep going.");
    expect(screen.getByRole('button', { name: /Continue/ })).toBeTruthy();
  });

  it('complete lesson: Owl invites a replay, primary button says Play again', async () => {
    const services = createServicesWithRealContent();
    const profile = await seedReturningProfile(services, 'Mia');
    const lesson = services.deps.content.lesson('rook');
    if (!lesson) throw new Error('rook lesson missing from bundled content');
    const saved = await getLessonProgress(services.deps, profile.id, lesson.id);
    const bestStars = Object.fromEntries(
      lesson.exercises.map((exercise) => [exercise.id, 1 as const]),
    );
    await services.deps.progress.saveLesson({ ...saved, bestStars });

    render(<App services={services} />);
    await pickProfileFromPicker('Mia');

    await screen.findByText("You finished Rhino's lesson! Want to play again?");
    expect(screen.getByRole('button', { name: /Play again/ })).toBeTruthy();
  });

  it('switch-player button returns to the picker', async () => {
    const services = createServicesWithRealContent();
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');

    fireEvent.click(await screen.findByRole('button', { name: 'Switch player' }));

    await screen.findByRole('heading', { name: "Who's playing today?" });
  });
});

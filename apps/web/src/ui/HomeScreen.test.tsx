import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { getLessonProgress, withResumeStep } from '@chess-kids/core';
import '../i18n.ts';
import App from '../App.tsx';
import { createBundledContentSource } from '../adapters/content/bundled-content-source.ts';
import { createTestServices } from '../testing/test-services.ts';
import { pickProfileFromPicker, seedReturningProfile } from '../testing/app-test-helpers.ts';

afterEach(cleanup);

/** The real (bundled) content, with test adapters otherwise (fake password writer). */
function createServicesWithRealContent(): ReturnType<typeof createTestServices> {
  return createTestServices(createBundledContentSource());
}

describe('HomeScreen', () => {
  it('new lesson: Owl greets by character, primary button says Start today', async () => {
    const services = createServicesWithRealContent();
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');

    await screen.findByText('Today you meet Rhino!');
    expect(screen.getByRole('button', { name: /Start today/ })).toBeTruthy();
    // Rank pill shows the starting rank.
    expect(screen.getByText('Pawn rank')).toBeTruthy();
  });

  it('in-progress lesson: Owl invites to keep going, primary button says Continue', async () => {
    const services = createServicesWithRealContent();
    const profile = await seedReturningProfile(services, 'Mia');
    const saved = await getLessonProgress(services.deps, profile.id, 'rook');
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

  it('Journey tile opens the Journey screen', async () => {
    const services = createServicesWithRealContent();
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');

    fireEvent.click(await screen.findByRole('button', { name: /Journey/ }));

    await screen.findByRole('button', { name: /Back to Home/ });
  });
});

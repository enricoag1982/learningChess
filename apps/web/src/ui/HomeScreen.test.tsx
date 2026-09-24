import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ensureProfile, getLessonProgress, withResumeStep } from '@chess-kids/core';
import '../i18n.ts';
import App from '../App.tsx';
import { createServices } from '../app/services.ts';
import { createMemoryStorage } from '../testing/memory-storage.ts';

afterEach(cleanup);

describe('HomeScreen', () => {
  it('new lesson: Owl greets by character, primary button says Start', async () => {
    const services = createServices(createMemoryStorage());
    render(<App services={services} />);

    await screen.findByText("Hi! I'm Owl. Today you meet Rhino!");
    expect(screen.getByRole('button', { name: /Start/ })).toBeTruthy();
  });

  it('in-progress lesson: Owl welcomes back, primary button says Continue', async () => {
    const services = createServices(createMemoryStorage());
    const profile = await ensureProfile(services.deps);
    const saved = await getLessonProgress(services.deps, profile.id, 'rook');
    await services.deps.progress.saveLesson(withResumeStep(saved, 2, services.deps.clock.now()));

    render(<App services={services} />);

    await screen.findByText("Welcome back! Let's keep going.");
    expect(screen.getByRole('button', { name: /Continue/ })).toBeTruthy();
  });

  it('complete lesson: Owl invites a replay, primary button says Play again', async () => {
    const services = createServices(createMemoryStorage());
    const profile = await ensureProfile(services.deps);
    const lesson = services.deps.content.lesson('rook');
    if (!lesson) throw new Error('rook lesson missing from bundled content');
    const saved = await getLessonProgress(services.deps, profile.id, lesson.id);
    const bestStars = Object.fromEntries(
      lesson.exercises.map((exercise) => [exercise.id, 1 as const]),
    );
    await services.deps.progress.saveLesson({ ...saved, bestStars });

    render(<App services={services} />);

    await screen.findByText("You finished Rhino's lesson! Want to play again?");
    expect(screen.getByRole('button', { name: /Play again/ })).toBeTruthy();
  });
});

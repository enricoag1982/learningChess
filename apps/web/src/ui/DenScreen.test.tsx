import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { getLessonProgress } from '@chess-kids/core';
import '../i18n.ts';
import App from '../App.tsx';
import { createBundledContentSource } from '../adapters/content/bundled-content-source.ts';
import { createTestServices } from '../testing/test-services.ts';
import { pickProfileFromPicker, seedReturningProfile } from '../testing/app-test-helpers.ts';

afterEach(cleanup);

function createServicesWithRealContent(): ReturnType<typeof createTestServices> {
  return createTestServices(createBundledContentSource());
}

describe('DenScreen', () => {
  it('shows every friend unearned and the Pawn rank current, with nothing played', async () => {
    const services = createServicesWithRealContent();
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');

    fireEvent.click(await screen.findByRole('button', { name: 'My Den' }));
    await screen.findByText("Mia's Den");

    expect(
      screen.getByRole('listitem', { name: 'Rhino, locked, finish the Rook lesson' }),
    ).toBeTruthy();
    expect(screen.getByRole('listitem', { name: 'Pawn, You are here' })).toBeTruthy();
    expect(screen.getByRole('listitem', { name: 'Knight, After World 2' })).toBeTruthy();
  });

  it('marks Rhino a friend once the Rook lesson is complete', async () => {
    const services = createServicesWithRealContent();
    const profile = await seedReturningProfile(services, 'Mia');
    const rook = services.deps.content.lesson('rook');
    if (!rook) throw new Error('bundled content: "rook" lesson not found');
    const saved = await getLessonProgress(services.deps, profile.id, rook.id);
    const bestStars = Object.fromEntries(
      rook.exercises.map((exercise) => [exercise.id, 1 as const]),
    );
    await services.deps.progress.saveLesson({ ...saved, bestStars });

    render(<App services={services} />);
    await pickProfileFromPicker('Mia');
    fireEvent.click(await screen.findByRole('button', { name: 'My Den' }));
    await screen.findByText("Mia's Den");

    expect(screen.getByRole('listitem', { name: 'Rhino, friend' })).toBeTruthy();
    // Only Rhino's own lesson counts: Elephant (Bishop lesson) is still unearned.
    expect(
      screen.getByRole('listitem', { name: 'Elephant, locked, finish the Bishop lesson' }),
    ).toBeTruthy();
  });
});

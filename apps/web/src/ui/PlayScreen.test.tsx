import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getLessonProgress, solve } from '@chess-kids/core';
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

/** Clicks the board cell named "<square>, ..." (Board.tsx's accessible square names). */
function clickSquare(square: string): void {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${square},`) }));
}

describe('PlayScreen', () => {
  it('shows a locked mini-game greyed with its unlock condition, an unlocked one with best stars', async () => {
    const services = createServicesWithRealContent();
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');

    fireEvent.click(await screen.findByRole('button', { name: 'Play' }));
    await screen.findByRole('heading', { name: 'Play' });

    // Nothing played yet: every mini-game is locked, including Hungry Rook (unlocks after Rook).
    expect(
      screen.getByRole('button', { name: /^Hungry Rook, locked, After Rook lesson$/ }),
    ).toBeTruthy();
  });

  it('unlocks a mini-game once its lesson is complete, showing 0 stars until played', async () => {
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
    fireEvent.click(await screen.findByRole('button', { name: 'Play' }));
    await screen.findByRole('heading', { name: 'Play' });

    expect(screen.getByRole('button', { name: 'Hungry Rook, 0 stars' })).toBeTruthy();
    // A mini-game further down the curriculum (Bishop) is still locked.
    expect(
      screen.getByRole('button', { name: /^Hungry Bishop, locked, After Bishop lesson$/ }),
    ).toBeTruthy();
  });

  it('playing an unlocked static mini-game standalone saves best stars, shown back on the Play tile', async () => {
    const services = createServicesWithRealContent();
    const profile = await seedReturningProfile(services, 'Mia');
    const rook = services.deps.content.lesson('rook');
    const hungryRook = services.deps.content.minigame('hungry-rook');
    if (!rook || !hungryRook || hungryRook.mode !== 'static') {
      throw new Error('bundled content: "rook" lesson / "hungry-rook" mini-game not found');
    }
    const saved = await getLessonProgress(services.deps, profile.id, rook.id);
    const bestStars = Object.fromEntries(
      rook.exercises.map((exercise) => [exercise.id, 1 as const]),
    );
    await services.deps.progress.saveLesson({ ...saved, bestStars });

    render(<App services={services} />);
    await pickProfileFromPicker('Mia');
    fireEvent.click(await screen.findByRole('button', { name: 'Play' }));
    await screen.findByRole('heading', { name: 'Play' });

    fireEvent.click(screen.getByRole('button', { name: 'Hungry Rook, 0 stars' }));
    await screen.findByRole('heading', { name: 'Hungry Rook' });

    const line = solve(hungryRook.position, services.rules, 'capture');
    if (!line) throw new Error('no solution found by the core solver for "hungry-rook"');
    for (const move of line) {
      clickSquare(move.from);
      clickSquare(move.to);
    }

    // The win panel offers both "Play again" and "Back to Play" (standalone session).
    await screen.findByRole('button', { name: /Play again/ });
    fireEvent.click(await screen.findByRole('button', { name: /Back to Play/ }));

    await screen.findByRole('heading', { name: 'Play' });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Hungry Rook, \d+ stars$/ })).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: 'Hungry Rook, 0 stars' })).toBeNull();

    const miniGameProgress = await services.deps.progress.getMiniGame(profile.id, 'hungry-rook');
    expect(miniGameProgress?.plays).toBe(1);
    expect(miniGameProgress?.wins).toBe(1);
    expect(miniGameProgress?.bestStars).toBeGreaterThan(0);
  });
});

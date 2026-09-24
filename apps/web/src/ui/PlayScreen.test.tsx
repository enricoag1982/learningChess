import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getLessonProgress, recordGame, solve } from '@chess-kids/core';
import '../i18n.ts';
import App from '../App.tsx';
import { createBundledContentSource } from '../adapters/content/bundled-content-source.ts';
import { createTestServices } from '../testing/test-services.ts';
import { renderWithStore } from '../testing/render-with-store.tsx';
import {
  pickProfileFromPicker,
  seedReturningProfile,
  seedWorldFourMastered,
} from '../testing/app-test-helpers.ts';
import { PlayScreen } from './PlayScreen.tsx';

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

describe('PlayScreen: vs Computer (M3.5)', () => {
  it('shows every level locked, Mouse with its own condition, before World 4 is mastered', async () => {
    const services = createServicesWithRealContent();
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');

    fireEvent.click(await screen.findByRole('button', { name: 'Play' }));
    await screen.findByRole('heading', { name: 'Play' });

    expect(screen.getByRole('button', { name: 'Mouse, locked, After World 4' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rabbit, locked, Beat Mouse 3 times' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fox, locked, Beat Rabbit 3 times' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Wolf, locked, Beat Fox 3 times' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Bear, locked, Beat Wolf 3 times' })).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'Play a full game, After World 4',
      }),
    ).toHaveProperty('disabled', true);
  });

  it('unlocks Mouse once World 4 is mastered; Rabbit stays locked until 3 full-game wins', async () => {
    const services = createServicesWithRealContent();
    const profile = await seedReturningProfile(services, 'Mia');
    await seedWorldFourMastered(services, profile.id);
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');

    fireEvent.click(await screen.findByRole('button', { name: 'Play' }));
    await screen.findByRole('heading', { name: 'Play' });

    expect(screen.getByRole('button', { name: 'Mouse, not played yet' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rabbit, locked, Beat Mouse 3 times' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Play a full game' })).toHaveProperty(
      'disabled',
      false,
    );
  });

  it('the Full game button starts a full game vs the selected (unlocked) level', async () => {
    const services = createServicesWithRealContent();
    const profile = await seedReturningProfile(services, 'Mia');
    await seedWorldFourMastered(services, profile.id);
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');

    fireEvent.click(await screen.findByRole('button', { name: 'Play' }));
    await screen.findByRole('heading', { name: 'Play' });
    fireEvent.click(screen.getByRole('button', { name: 'Play a full game' }));

    expect(await screen.findByText('Full Game vs Mouse')).toBeTruthy();
    expect(screen.getByText('Checkmate the other king!')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Full Game' })).toBeTruthy();
  });

  it('preselects the vs Computer chip at the profile’s stored suggested level', async () => {
    const services = createServicesWithRealContent();
    const profile = await seedReturningProfile(services, 'Mia');
    await seedWorldFourMastered(services, profile.id);
    // 3 full-game wins vs Mouse unlock Rabbit; seeding the stored suggestion directly is the same
    // end state `updateAutomaticLevel` would have persisted after a real 4-of-5 streak.
    for (let i = 0; i < 3; i += 1) {
      await recordGame(services.deps, {
        profileId: profile.id,
        game: 'full',
        opponentLevel: 1,
        result: 'win',
        reason: 'checkmate',
        moves: [],
      });
    }
    const settings = await services.deps.settings.get();
    await services.deps.settings.save({
      ...settings,
      suggestedLevels: { [profile.id]: 2 },
    });

    render(<App services={services} />);
    await pickProfileFromPicker('Mia');
    fireEvent.click(await screen.findByRole('button', { name: 'Play' }));
    await screen.findByRole('heading', { name: 'Play' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Rabbit,/ }).getAttribute('aria-pressed')).toBe(
        'true',
      );
    });
    expect(screen.getByRole('button', { name: /^Mouse,/ }).getAttribute('aria-pressed')).toBe(
      'false',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Play a full game' }));
    expect(await screen.findByText('Full Game vs Rabbit')).toBeTruthy();
  });

  it('shows Owl’s suggestion line once a finished full game moves the suggestion up a level', async () => {
    const services = createServicesWithRealContent();
    const { store } = await renderWithStore(<PlayScreen />, services);
    const profile = store.getState().profile;
    if (!profile) throw new Error('renderWithStore: no profile');
    await seedWorldFourMastered(services, profile.id);

    for (let i = 0; i < 5; i += 1) {
      await recordGame(services.deps, {
        profileId: profile.id,
        game: 'full',
        opponentLevel: 1,
        result: 'win',
        reason: 'checkmate',
        moves: [],
      });
    }
    await store.getState().refreshProgress();
    await store.getState().updateAutomaticLevel(1);

    expect(await screen.findByText('Ready for the Rabbit?')).toBeTruthy();
  });
});

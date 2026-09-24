import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { BotPlayer, Move, Square } from '@chess-kids/core';
import { chessJsRules } from '@chess-kids/core';
import '../i18n.ts';
import App from '../App.tsx';
import { createBundledContentSource } from '../adapters/content/bundled-content-source.ts';
import { createTestServices } from '../testing/test-services.ts';
import {
  pickProfileFromPicker,
  seedReturningProfile,
  seedWorldFourMastered,
} from '../testing/app-test-helpers.ts';

// A fixed test seed shortens the bot's "thinking" pause to 300ms (VersusStep.tsx's pattern).
beforeEach(() => {
  window.localStorage.setItem('chess-kids:test-seed', '1');
});

afterEach(() => {
  cleanup();
  window.localStorage.removeItem('chess-kids:test-seed');
});

function createServicesWithRealContent(): ReturnType<typeof createTestServices> {
  return createTestServices(createBundledContentSource());
}

/** Clicks the board cell named "<square>, ..." (Board.tsx's accessible square names). */
function clickSquare(square: string): void {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${square},`) }));
}

/** A scripted `BotPlayer`: replies with the queued `from`/`to` moves in order. */
function scriptedBotPlayer(
  moves: readonly { readonly from: Square; readonly to: Square }[],
): BotPlayer {
  let index = 0;
  return {
    chooseMove(state) {
      const queued = moves[index];
      index += 1;
      if (queued === undefined) return Promise.resolve(null);
      const legal = chessJsRules.legalMoves(state.position);
      const move: Move | undefined = legal.find(
        (candidate) => candidate.from === queued.from && candidate.to === queued.to,
      );
      return Promise.resolve(move ?? null);
    },
  };
}

async function openFullGame(): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: 'Play' }));
  await screen.findByRole('heading', { name: 'Play' });
  fireEvent.click(screen.getByRole('button', { name: 'Play a full game' }));
  await screen.findByText('Full Game vs Mouse');
}

describe('FullGameScreen (M3.5)', () => {
  it('a Scholar\'s-mate win is saved as a "full" GameRecord and shown back on Play', async () => {
    const services = {
      ...createServicesWithRealContent(),
      botPlayer: scriptedBotPlayer([
        { from: 'e7', to: 'e5' },
        { from: 'b8', to: 'c6' },
        { from: 'g8', to: 'f6' },
      ]),
    };
    const profile = await seedReturningProfile(services, 'Mia');
    await seedWorldFourMastered(services, profile.id);
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');
    await openFullGame();

    // 1.e4 e5 2.Qh5 Nc6 3.Bc4 Nf6?? 4.Qxf7# (Scholar's mate) — the bot's replies are scripted above.
    clickSquare('e2');
    clickSquare('e4');
    await screen.findByRole('button', { name: /^e5, black pawn/ });
    clickSquare('d1');
    clickSquare('h5');
    await screen.findByRole('button', { name: /^c6, black knight/ });
    clickSquare('f1');
    clickSquare('c4');
    await screen.findByRole('button', { name: /^f6, black knight/ });
    clickSquare('h5');
    clickSquare('f7');

    await screen.findByText('You won!');

    await waitFor(async () => {
      const records = await services.deps.gameRecords.listByProfile(profile.id);
      expect(records.some((r) => r.game === 'full' && r.result === 'win')).toBe(true);
    });
    const [record] = (await services.deps.gameRecords.listByProfile(profile.id)).filter(
      (r) => r.game === 'full',
    );
    expect(record).toMatchObject({ opponent: 'computer:1', result: 'win', reason: 'checkmate' });

    fireEvent.click(screen.getByRole('button', { name: /Back to Play/ }));
    await screen.findByRole('heading', { name: 'Play' });
    expect(screen.getByRole('button', { name: 'Mouse, won 1 of 1' })).toBeTruthy();
  });

  it('leaving mid-game asks to confirm; confirming records it as abandoned, not a loss', async () => {
    const services = {
      ...createServicesWithRealContent(),
      botPlayer: scriptedBotPlayer([{ from: 'e7', to: 'e5' }]),
    };
    const profile = await seedReturningProfile(services, 'Mia');
    await seedWorldFourMastered(services, profile.id);
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');
    await openFullGame();

    clickSquare('e2');
    clickSquare('e4');
    await screen.findByRole('button', { name: /^e5, black pawn/ });

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await screen.findByRole('alertdialog', { name: 'Stop this game?' });

    // Cancel keeps the game going.
    fireEvent.click(screen.getByRole('button', { name: 'Keep playing' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByText('Full Game vs Mouse')).toBeTruthy();

    // Close again, this time confirming.
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await screen.findByRole('alertdialog', { name: 'Stop this game?' });
    fireEvent.click(screen.getByRole('button', { name: 'Stop game' }));

    await screen.findByRole('heading', { name: 'Play' });
    await waitFor(async () => {
      const records = await services.deps.gameRecords.listByProfile(profile.id);
      expect(records.some((r) => r.game === 'full' && r.result === 'abandoned')).toBe(true);
    });
    const abandoned = (await services.deps.gameRecords.listByProfile(profile.id)).find(
      (r) => r.game === 'full',
    );
    expect(abandoned).toMatchObject({ result: 'abandoned', reason: 'left' });
    expect(abandoned?.moves).toEqual(['e4', 'e5']);
    // Not counted as a loss/win: still "not played yet" (only "full" games with a real result count).
    expect(screen.getByRole('button', { name: 'Mouse, not played yet' })).toBeTruthy();
  });
});

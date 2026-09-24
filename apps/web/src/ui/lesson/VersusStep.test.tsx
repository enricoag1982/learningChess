import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import type { BotPlayer, Move, PieceType, Square, VersusMiniGame } from '@chess-kids/core';
import { chessJsRules, parseDiagram } from '@chess-kids/core';
import '../../i18n.ts';
import { fixtureContentSource, fixtureLesson } from '../../testing/fixtures.ts';
import { renderWithStore } from '../../testing/render-with-store.tsx';
import { createTestServices } from '../../testing/test-services.ts';
import { BossStep } from './BossStep.tsx';

/**
 * A scripted `BotPlayer`: replies with the queued `from`/`to` moves in order (resolved into a real
 * `Move`, looked up from the position's own legal moves so it always carries the right `san` /
 * `piece` / `captured`), then `null` once the queue is empty.
 */
function scriptedBotPlayer(
  moves: readonly { readonly from: Square; readonly to: Square; readonly promotion?: PieceType }[],
): BotPlayer {
  let index = 0;
  return {
    chooseMove(state) {
      const queued = moves[index];
      index += 1;
      if (queued === undefined) return Promise.resolve(null);
      const legal = chessJsRules.legalMoves(state.position);
      const move: Move | undefined = legal.find(
        (candidate) =>
          candidate.from === queued.from &&
          candidate.to === queued.to &&
          (queued.promotion === undefined || candidate.promotion === queued.promotion),
      );
      return Promise.resolve(move ?? null);
    },
  };
}

/** White pawn on a6 (2 moves from promoting) and a lone black pawn on h7 (its own home rank). */
function racingPawnsGame(overrides: Partial<VersusMiniGame> = {}): VersusMiniGame {
  return {
    mode: 'versus',
    id: 'fixture-pawn-wars',
    concept: 'pawn-move',
    position: parseDiagram(`
      . . . . . . . .
      . . . . . . . p
      P . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
    `),
    rules: {
      kings: false,
      checkRules: false,
      noMoves: 'lose',
      win: {
        w: [{ kind: 'promote' }, { kind: 'capture-all' }],
        b: [{ kind: 'promote' }, { kind: 'capture-all' }],
      },
    },
    opponentLevel: 1,
    kidColor: 'w',
    par: 3,
    titleKey: 'fixtures:boss-title',
    goalKey: 'fixtures:boss-goal',
    unlockAfter: 'fixture',
    ...overrides,
  };
}

// A fixed test seed shortens the bot's "thinking" pause to 300ms (VersusStep.tsx) and would make
// a real bot deterministic; the scripted `BotPlayer` above ignores it, but the short pause keeps
// these tests fast and free of the otherwise-random 0.8-1.5s delay.
beforeEach(() => {
  window.localStorage.setItem('chess-kids:test-seed', '1');
});

afterEach(() => {
  cleanup();
  window.localStorage.removeItem('chess-kids:test-seed');
});

describe('VersusStep (via BossStep dispatching on mode)', () => {
  it('kid wins by promotion within par for 3 stars, with the bot replying in between', async () => {
    const boss = racingPawnsGame();
    const lesson = fixtureLesson({ boss: boss.id });
    const services = {
      ...createTestServices(fixtureContentSource(lesson, [boss])),
      botPlayer: scriptedBotPlayer([{ from: 'h7', to: 'h6' }]),
    };
    const { store } = await renderWithStore(
      <BossStep lesson={lesson} game={boss} nextStepIndex={5} />,
      services,
    );

    // Move 1: a6-a7. The bot then replies (h7-h6), narrated once it lands.
    fireEvent.click(screen.getByRole('button', { name: /^a6,/ }));
    fireEvent.click(screen.getByRole('button', { name: /^a7,/ }));
    await screen.findByText(/Mouse moved a pawn\./);
    expect(screen.getByRole('button', { name: /^h6, black pawn/ })).toBeTruthy();

    // Move 2: a7-a8, promoting and winning.
    fireEvent.click(screen.getByRole('button', { name: /^a7,/ }));
    fireEvent.click(screen.getByRole('button', { name: /^a8,/ }));

    await screen.findByText('You won!');
    expect(screen.getByTestId('stars-row')).toBeTruthy();

    const profile = store.getState().profile;
    await waitFor(async () => {
      const saved = await services.deps.progress.getLesson(profile?.id ?? '', lesson.id);
      expect(saved?.bossStars).toBe(3);
    });
  });

  it('take back undoes both the kid move and the bot reply', async () => {
    const boss = racingPawnsGame();
    const lesson = fixtureLesson({ boss: boss.id });
    const services = {
      ...createTestServices(fixtureContentSource(lesson, [boss])),
      botPlayer: scriptedBotPlayer([{ from: 'h7', to: 'h6' }]),
    };
    await renderWithStore(<BossStep lesson={lesson} game={boss} nextStepIndex={5} />, services);

    fireEvent.click(screen.getByRole('button', { name: /^a6,/ }));
    fireEvent.click(screen.getByRole('button', { name: /^a7,/ }));
    await screen.findByRole('button', { name: /^h6, black pawn/ });
    expect(screen.getByText('Your moves: 1')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Take back/ }));

    expect(screen.getByRole('button', { name: /^a6, white pawn/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^h7, black pawn/ })).toBeTruthy();
    expect(screen.getByText('Your moves: 0')).toBeTruthy();
    // Nothing left to take back right after undoing the only round played.
    expect(screen.getByRole('button', { name: /Take back/ })).toHaveProperty('disabled', true);
  });

  it('shows a danger ring on a kid pawn that is attacked and undefended', async () => {
    const boss = racingPawnsGame({
      id: 'fixture-danger',
      position: parseDiagram(`
        . . . . . . . .
        . . . . . . . .
        . . . . . . . .
        . . . . p . . .
        . . . P . . . .
        . . . . . . . .
        P . . . . . . .
        . . . . . . . .
      `),
    });
    const lesson = fixtureLesson({ boss: boss.id });
    const services = {
      ...createTestServices(fixtureContentSource(lesson, [boss])),
      botPlayer: scriptedBotPlayer([]),
    };
    await renderWithStore(<BossStep lesson={lesson} game={boss} nextStepIndex={5} />, services);

    // d4 is attacked by the black pawn on e5 and defended by no other white piece.
    expect(screen.getByRole('button', { name: /^d4,.*in danger/ })).toBeTruthy();
    // a2 is a safe white pawn, elsewhere.
    expect(screen.getByRole('button', { name: /^a2, white pawn$/ })).toBeTruthy();
  });
});

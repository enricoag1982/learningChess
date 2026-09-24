import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import type { BotPlayer, Move, PieceType, Square, VersusMiniGame } from '@chess-kids/core';
import { chessJsRules, parseDiagram, parseFen } from '@chess-kids/core';
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

/**
 * A full-rules `versus` boss (M3.3 `first-game`): both kings, real check rules, checkmate wins,
 * everything else (stalemate, insufficient material, move-limit) a draw — `position` defaults to a
 * simple check-in-one-move setup, overridable per test.
 */
function kingsGame(overrides: Partial<VersusMiniGame> = {}): VersusMiniGame {
  return {
    mode: 'versus',
    id: 'fixture-first-game',
    concept: 'full-game',
    position: parseDiagram(`
      . . . . . . k .
      . . . . . p p p
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      . . . . . . . .
      R . K . . . . .
    `),
    rules: {
      kings: true,
      checkRules: true,
      noMoves: 'draw',
      win: { w: [{ kind: 'checkmate' }], b: [{ kind: 'checkmate' }] },
    },
    opponentLevel: 1,
    kidColor: 'w',
    par: 60,
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

  // M3.3: `first-game` is the first `versus` boss with real check rules (every earlier boss is
  // kingless), so this is the first place check/checkmate/stalemate and castling/en passant/
  // promotion ever reach a `versus` game through the UI, not just the exercise engine.
  describe('a full game with real check rules (M3.3 first-game)', () => {
    it('shows the check ring on the kid king when the kid is in check', async () => {
      const boss = kingsGame({
        id: 'fixture-check-ring',
        position: parseDiagram(`
          . . . . k . . .
          . . . . . . . .
          . . . . . . . .
          . . . . . . . .
          . . . . r . . .
          . . . . . . . .
          . . . . . . . .
          . . . . K . . .
        `),
      });
      const lesson = fixtureLesson({ boss: boss.id });
      const services = {
        ...createTestServices(fixtureContentSource(lesson, [boss])),
        botPlayer: scriptedBotPlayer([]),
      };
      await renderWithStore(<BossStep lesson={lesson} game={boss} nextStepIndex={5} />, services);

      expect(screen.getByRole('button', { name: /^e1,.*in check/ })).toBeTruthy();
    });

    it('kid wins by checkmate: the result screen shows "You won!"', async () => {
      const boss = kingsGame(); // Ra8# is mate in one from the default position.
      const lesson = fixtureLesson({ boss: boss.id });
      const services = {
        ...createTestServices(fixtureContentSource(lesson, [boss])),
        botPlayer: scriptedBotPlayer([]),
      };
      await renderWithStore(<BossStep lesson={lesson} game={boss} nextStepIndex={5} />, services);

      fireEvent.click(screen.getByRole('button', { name: /^a1,/ }));
      fireEvent.click(screen.getByRole('button', { name: /^a8,/ }));

      await screen.findByText('You won!');
      expect(screen.getByRole('button', { name: /^g8,.*in check/ })).toBeTruthy();
    });

    it('a move that only stalemates the opponent ends the game as a draw', async () => {
      // Queen h2 -> Qd6 stalemates the black king (a8, boxed in by the white king on b6) without
      // giving check — the exact "don't stalemate" trap `stalemate.yaml` teaches.
      const boss = kingsGame({
        id: 'fixture-stalemate-trap',
        position: parseDiagram(`
          k . . . . . . .
          . . . . . . . .
          . K . . . . . .
          . . . . . . . .
          . . . . . . . .
          . . . . . . . .
          . . . . . . . Q
          . . . . . . . .
        `),
      });
      const lesson = fixtureLesson({ boss: boss.id });
      const services = {
        ...createTestServices(fixtureContentSource(lesson, [boss])),
        botPlayer: scriptedBotPlayer([]),
      };
      await renderWithStore(<BossStep lesson={lesson} game={boss} nextStepIndex={5} />, services);

      fireEvent.click(screen.getByRole('button', { name: /^h2,/ }));
      fireEvent.click(screen.getByRole('button', { name: /^d6,/ }));

      await screen.findByText("It's a draw! Want to try again?");
      // M3.5: Owl explains *which* draw, alongside the existing generic result text.
      expect(screen.getByText("No safe moves left for anyone — that's a stalemate.")).toBeTruthy();
    });

    it('a draw by insufficient material names that reason', async () => {
      // The kid's king captures the last black pawn, leaving a bare king vs king — neither side can
      // ever force checkmate, an instant draw the moment the position is reached.
      const boss = kingsGame({
        id: 'fixture-insufficient-material',
        position: parseFen('k7/8/8/8/8/8/p7/K7 w - - 0 1'),
      });
      const lesson = fixtureLesson({ boss: boss.id });
      const services = {
        ...createTestServices(fixtureContentSource(lesson, [boss])),
        botPlayer: scriptedBotPlayer([]),
      };
      await renderWithStore(<BossStep lesson={lesson} game={boss} nextStepIndex={5} />, services);

      fireEvent.click(screen.getByRole('button', { name: /^a1,/ }));
      fireEvent.click(screen.getByRole('button', { name: /^a2,/ }));

      await screen.findByText("It's a draw! Want to try again?");
      expect(screen.getByText('Not enough pieces left for either side to checkmate.')).toBeTruthy();
    });

    it('the kid can castle kingside', async () => {
      const boss = kingsGame({
        id: 'fixture-castling',
        position: parseFen('k7/8/8/8/8/8/8/4K2R w K - 0 1'),
      });
      const lesson = fixtureLesson({ boss: boss.id });
      const services = {
        ...createTestServices(fixtureContentSource(lesson, [boss])),
        botPlayer: scriptedBotPlayer([]),
      };
      await renderWithStore(<BossStep lesson={lesson} game={boss} nextStepIndex={5} />, services);

      fireEvent.click(screen.getByRole('button', { name: /^e1,/ }));
      fireEvent.click(screen.getByRole('button', { name: /^g1,/ }));

      // Castling moves both pieces: the king to g1, the rook from h1 to f1.
      expect(screen.getByRole('button', { name: /^g1, white king/ })).toBeTruthy();
      expect(screen.getByRole('button', { name: /^f1, white rook/ })).toBeTruthy();
    });

    it('the kid can capture en passant', async () => {
      const boss = kingsGame({
        id: 'fixture-en-passant',
        position: parseFen('k7/8/8/3pP3/8/8/8/K7 w - d6 0 1'),
      });
      const lesson = fixtureLesson({ boss: boss.id });
      const services = {
        ...createTestServices(fixtureContentSource(lesson, [boss])),
        botPlayer: scriptedBotPlayer([]),
      };
      await renderWithStore(<BossStep lesson={lesson} game={boss} nextStepIndex={5} />, services);

      fireEvent.click(screen.getByRole('button', { name: /^e5,/ }));
      fireEvent.click(screen.getByRole('button', { name: /^d6,/ }));

      // The white pawn lands on d6 and the black pawn on d5 (not d6) is gone.
      expect(screen.getByRole('button', { name: /^d6, white pawn/ })).toBeTruthy();
      expect(screen.getByRole('button', { name: /^d5, empty/ })).toBeTruthy();
    });

    it('a pawn reaching the back rank auto-promotes to a queen', async () => {
      const boss = kingsGame({
        id: 'fixture-promotion',
        position: parseFen('7k/P7/8/8/8/8/8/K7 w - - 0 1'),
      });
      const lesson = fixtureLesson({ boss: boss.id });
      const services = {
        ...createTestServices(fixtureContentSource(lesson, [boss])),
        botPlayer: scriptedBotPlayer([]),
      };
      await renderWithStore(<BossStep lesson={lesson} game={boss} nextStepIndex={5} />, services);

      fireEvent.click(screen.getByRole('button', { name: /^a7,/ }));
      fireEvent.click(screen.getByRole('button', { name: /^a8,/ }));

      expect(screen.getByRole('button', { name: /^a8, white queen/ })).toBeTruthy();
    });
  });
});

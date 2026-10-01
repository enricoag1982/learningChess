import { describe, expect, it } from 'vitest';

import { chessJsRules as rules } from '../chess/chessjs-rules.ts';
import { parseFen } from '../chess/fen.ts';
import type { Move } from '../chess/rules.ts';
import type { Color, Piece, Position, Square } from '../chess/types.ts';
import { playGameMove, startGame } from '../game/index.ts';
import type { GameRulesDef, GameState } from '../game/index.ts';
import { seededRandom } from '@learn/platform-core/domain/random';
import { BOT_LEVELS } from './levels.ts';
import { chooseMove } from './search.ts';

// Bot self-play and strength/timing tests live in `search.slow.test.ts` (m8.2 item 1, `pnpm
// test:slow`): the fast search unit tests below stay here, in the default `pnpm test` run.

function levelNamed(name: (typeof BOT_LEVELS)[number]['name']) {
  const level = BOT_LEVELS.find((candidate) => candidate.name === name);
  if (level === undefined) {
    throw new Error(`no such level: ${name}`);
  }
  return level;
}

function pos(pieces: Partial<Record<Square, Piece>>, toMove: Color = 'w'): Position {
  return { pieces, markers: { stars: [], blocked: [] }, toMove, castling: '-', enPassant: null };
}

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const STANDARD: GameRulesDef = {
  kings: true,
  checkRules: true,
  noMoves: 'draw',
  win: { w: [{ kind: 'checkmate' }], b: [{ kind: 'checkmate' }] },
};

const PAWN_WARS: GameRulesDef = {
  kings: false,
  checkRules: false,
  noMoves: 'lose',
  win: {
    w: [{ kind: 'promote' }, { kind: 'capture-all' }],
    b: [{ kind: 'promote' }, { kind: 'capture-all' }],
  },
};

describe('determinism', () => {
  it('picks the same move for the same state, level and seed', () => {
    const state = startGame(
      STANDARD,
      parseFen('r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4'),
    );
    const fox = levelNamed('fox');
    const first = chooseMove(state, fox, rules, seededRandom(99));
    const second = chooseMove(state, fox, rules, seededRandom(99));
    expect(second).toEqual(first);
  });

  // Bear alone uses the transposition table / killer moves / time-capped iterative deepening
  // (`docs/computer-opponent.md` §3/§8 "Bear speed") — the level most likely to lose determinism
  // to a wall-clock-driven search. Every depth `chooseBySearch` uses is always a fully completed,
  // exact alpha-beta pass (`negamax`'s own doc comment), so this holds regardless of machine speed.
  it('Bear picks the same move for the same state and seed, several times over', () => {
    const state = startGame(
      STANDARD,
      parseFen('r1bqk2r/ppp2ppp/2n2n2/2bpp3/2B1P3/3P1N2/PPP2PPP/RNBQ1RK1 w kq - 4 6'),
    );
    const bear = levelNamed('bear');
    const first = chooseMove(state, bear, rules, seededRandom(42));
    for (let i = 0; i < 4; i += 1) {
      expect(chooseMove(state, bear, rules, seededRandom(42))).toEqual(first);
    }
  });
});

describe('search report (calibrate telemetry)', () => {
  const state = startGame(
    STANDARD,
    parseFen('r1bqk2r/ppp2ppp/2n2n2/2bpp3/2B1P3/3P1N2/PPP2PPP/RNBQ1RK1 w kq - 4 6'),
  );

  it('reports the completed depth of a searched move, within the level depth', () => {
    const reports: { depth: number; targetDepth: number; cutByTime: boolean }[] = [];
    const bear = levelNamed('bear');
    chooseMove(state, bear, rules, seededRandom(7), undefined, (report) => reports.push(report));
    expect(reports).toHaveLength(1);
    const [report] = reports;
    expect(report?.targetDepth).toBe(bear.depth);
    expect(report?.depth).toBeGreaterThanOrEqual(1);
    expect(report?.depth).toBeLessThanOrEqual(bear.depth);
    expect(report?.cutByTime).toBe((report?.depth ?? 0) < bear.depth);
  });

  it('reports nothing when the move is not chosen by search (Mouse never searches)', () => {
    const reports: unknown[] = [];
    chooseMove(state, levelNamed('mouse'), rules, seededRandom(7), undefined, (report) =>
      reports.push(report),
    );
    expect(reports).toEqual([]);
  });
});

describe('Bear root pool', () => {
  // White to move, Black's bishop on f4 threatens Bg3#. Ke1-f2 is the only move that keeps
  // the exact best score; most of the others lose at once (Black mates), yet a bound-only root
  // score once tied them with the best and let the pool pick them (m10.1 diagnosis).
  const state = startGame(
    STANDARD,
    parseFen('rnb1k1nr/p2pqp2/2p1p1pp/1p6/1P3bPP/P1P5/R2PP3/1NBQKBNR w Kkq - 0 1'),
  );
  // Depth 2 already sees the mate and keeps the sweep fast; `level: 5` still switches Bear's search on.
  const bear = { ...levelNamed('bear'), depth: 2 };

  function allowsMateInOne(move: Move): boolean {
    const played = playGameMove(state, rules, move);
    if (played === null) {
      return false;
    }
    return rules.legalMoves(played.state.position).some((reply) => {
      const after = rules.play(played.state.position, reply);
      return after !== null && rules.status(after.position).checkmate;
    });
  }

  // 24 searches, each capped by Bear's 250 ms time budget: up to ~6 s on a slow runner, past vitest's 5 s default.
  it(
    'never picks a move that allows mate in 1, whichever pool entry the dice select',
    { timeout: 15_000 },
    () => {
      for (let i = 0; i < 24; i += 1) {
        const roll = (i + 0.5) / 24;
        const move = chooseMove(state, bear, rules, { next: () => roll });
        expect(move).not.toBeNull();
        if (move !== null) {
          expect(allowsMateInOne(move)).toBe(false);
        }
      }
    },
  );
});

describe('tactics', () => {
  // Back-rank mate: 1.Ra8#.
  const BACK_RANK_MATE = parseFen('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1');

  it('Rabbit+ always plays an available mate in 1', () => {
    const state = startGame(STANDARD, BACK_RANK_MATE);
    for (const name of ['rabbit', 'fox', 'wolf', 'bear'] as const) {
      const move = chooseMove(state, levelNamed(name), rules, seededRandom(1));
      expect(move?.san).toBe('Ra8#');
    }
  });

  it('Mouse does not always find the same mate in 1', () => {
    const state = startGame(STANDARD, BACK_RANK_MATE);
    const mouse = levelNamed('mouse');
    const sans = Array.from(
      { length: 20 },
      (_, seed) => chooseMove(state, mouse, rules, seededRandom(seed))?.san,
    );
    expect(sans.some((san) => san !== 'Ra8#')).toBe(true);
  });

  it('Fox+ takes a free queen', () => {
    const state = startGame(STANDARD, parseFen('4k3/8/8/8/3q4/8/2N5/4K3 w - - 0 1'));
    const fox = levelNamed('fox');
    const results = Array.from({ length: 20 }, (_, seed) =>
      chooseMove(state, fox, rules, seededRandom(seed)),
    );
    const captured = results.filter((move) => move?.captured === 'q');
    expect(captured.length).toBeGreaterThanOrEqual(15);
  });

  it('pushes an unstoppable pawn to promotion in Pawn Wars', () => {
    const state = startGame(
      PAWN_WARS,
      pos({ a7: { color: 'w', type: 'p' }, h2: { color: 'b', type: 'p' } }),
    );
    const bear = levelNamed('bear');
    const move = chooseMove(state, bear, rules, seededRandom(5));
    expect(move).toMatchObject({ from: 'a7', to: 'a8' });
  });

  // Black to move; White threatens Ra8# next (the same back-rank pattern as BACK_RANK_MATE, one
  // ply earlier). Only opening luft (f6 / g6 / h6) or moving off the back rank via f8 avoids it —
  // Kh8 does not (still on the rank Ra8 covers). Confirmed against `chessJsRules` directly: every
  // other legal Black move (including Kh8) leaves White a mate in 1.
  const STOP_BACK_RANK_MATE = parseFen('6k1/5ppp/8/8/8/8/5PPP/R5K1 b - - 0 1');

  /** True once no White reply from `position` delivers checkmate. */
  function stopsTheMate(position: Position): boolean {
    return rules.legalMoves(position).every((candidate) => {
      const played = rules.play(position, candidate);
      return played === null || !rules.status(played.position).checkmate;
    });
  }

  it('Fox+ stops the kid’s mate in 1', () => {
    const state = startGame(STANDARD, STOP_BACK_RANK_MATE);
    for (const name of ['fox', 'wolf', 'bear'] as const) {
      const level = levelNamed(name);
      const results = Array.from({ length: 20 }, (_, seed) => {
        const move = chooseMove(state, level, rules, seededRandom(seed));
        expect(move).not.toBeNull();
        const played = playGameMove(state, rules, move as Move);
        expect(played).not.toBeNull();
        return stopsTheMate((played as NonNullable<typeof played>).state.position);
      });
      const safe = results.filter(Boolean).length;
      expect(
        safe,
        `${name}: only ${String(safe)}/20 seeds stopped the mate`,
      ).toBeGreaterThanOrEqual(15);
    }
  });
});

describe('queen home', () => {
  function dummyMove(color: Color): Move {
    return { from: 'a2', to: 'a3', san: 'a3', color, piece: 'p' };
  }

  const developedPosition: Position = {
    pieces: {
      d4: { color: 'w', type: 'q' },
      a1: { color: 'w', type: 'r' },
      e1: { color: 'w', type: 'k' },
      e8: { color: 'b', type: 'k' },
      h7: { color: 'b', type: 'p' },
    },
    markers: { stars: [], blocked: [] },
    toMove: 'w',
    castling: '-',
    enPassant: null,
  };

  it('keeps the queen home during the restricted window', () => {
    const state: GameState = {
      position: developedPosition,
      history: Array.from({ length: 4 }, () => dummyMove('w')),
      def: STANDARD,
      positions: [developedPosition],
      halfmoveClock: 0,
    };
    const mouse = levelNamed('mouse');
    for (let seed = 0; seed < 30; seed += 1) {
      const move = chooseMove(state, mouse, rules, seededRandom(seed));
      expect(move?.piece).not.toBe('q');
    }
  });

  it('allows queen moves once the queen is attacked', () => {
    const attacked: Position = {
      ...developedPosition,
      pieces: { ...developedPosition.pieces, b5: { color: 'b', type: 'n' } },
    };
    const state: GameState = {
      position: attacked,
      history: Array.from({ length: 4 }, () => dummyMove('w')),
      def: STANDARD,
      positions: [attacked],
      halfmoveClock: 0,
    };
    const mouse = levelNamed('mouse');
    const sans = Array.from(
      { length: 30 },
      (_, seed) => chooseMove(state, mouse, rules, seededRandom(seed))?.san,
    );
    expect(sans.some((san) => san?.startsWith('Q'))).toBe(true);
  });

  it('allows queen moves once the restricted window has passed', () => {
    const state: GameState = {
      position: developedPosition,
      history: Array.from({ length: 5 }, () => dummyMove('w')),
      def: STANDARD,
      positions: [developedPosition],
      halfmoveClock: 0,
    };
    const mouse = levelNamed('mouse');
    const sans = Array.from(
      { length: 30 },
      (_, seed) => chooseMove(state, mouse, rules, seededRandom(seed))?.san,
    );
    expect(sans.some((san) => san?.startsWith('Q'))).toBe(true);
  });
});

describe('opening book (chooseMove wiring — book.test.ts covers bookMove/bookCandidates itself)', () => {
  const BOOK = {
    lines: [{ name: 'e4-italian', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'] }],
  };

  it('plays the book move at a level with book: true, while the position is in it', () => {
    const state = startGame(STANDARD, parseFen(START_FEN));
    const fox = levelNamed('fox');
    for (let seed = 0; seed < 10; seed += 1) {
      expect(chooseMove(state, fox, rules, seededRandom(seed), BOOK)?.san).toBe('e4');
    }
  });

  it('ignores the book at a level with book: false (Mouse, Rabbit)', () => {
    const state = startGame(STANDARD, parseFen(START_FEN));
    for (const name of ['mouse', 'rabbit'] as const) {
      const level = levelNamed(name);
      expect(level.book).toBe(false);
      const sans = Array.from(
        { length: 20 },
        (_, seed) => chooseMove(state, level, rules, seededRandom(seed), BOOK)?.san,
      );
      expect(sans.some((san) => san !== 'e4')).toBe(true);
    }
  });

  it('falls back to the normal roll once no book line still matches', () => {
    const afterA4 = startGame(STANDARD, parseFen(START_FEN));
    const state: GameState = {
      ...afterA4,
      position: parseFen('rnbqkbnr/pppppppp/8/8/P7/8/1PPPPPPP/RNBQKBNR b KQkq - 0 1'),
      history: [{ from: 'a2', to: 'a4', san: 'a4', color: 'w', piece: 'p' }],
    };
    const fox = levelNamed('fox');
    const move = chooseMove(state, fox, rules, seededRandom(1), BOOK);
    expect(move).not.toBeNull();
  });
});

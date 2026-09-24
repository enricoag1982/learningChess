import { describe, expect, it } from 'vitest';

import { chessJsRules as rules } from '../chess/chessjs-rules.ts';
import { parseFen } from '../chess/fen.ts';
import type { Move } from '../chess/rules.ts';
import type { Color, Piece, Position, Square } from '../chess/types.ts';
import { gameResult, legalGameMoves, playGameMove, startGame } from '../game/index.ts';
import type { GameRulesDef, GameState } from '../game/index.ts';
import { seededRandom } from '../random.ts';
import { BOT_LEVELS } from './levels.ts';
import { chooseMove } from './search.ts';

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

const PAWN_WARS_START = pos({
  a7: { color: 'b', type: 'p' },
  b7: { color: 'b', type: 'p' },
  c7: { color: 'b', type: 'p' },
  d7: { color: 'b', type: 'p' },
  e7: { color: 'b', type: 'p' },
  f7: { color: 'b', type: 'p' },
  g7: { color: 'b', type: 'p' },
  h7: { color: 'b', type: 'p' },
  a2: { color: 'w', type: 'p' },
  b2: { color: 'w', type: 'p' },
  c2: { color: 'w', type: 'p' },
  d2: { color: 'w', type: 'p' },
  e2: { color: 'w', type: 'p' },
  f2: { color: 'w', type: 'p' },
  g2: { color: 'w', type: 'p' },
  h2: { color: 'w', type: 'p' },
});

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

describe('legality', () => {
  function selfPlay(def: GameRulesDef, position: Position, totalPlies: number, seed: number): void {
    const level = levelNamed('fox');
    const random = seededRandom(seed);
    let state: GameState = startGame(def, position);
    for (let played = 0; played < totalPlies;) {
      if (gameResult(state, rules).kind !== 'ongoing') {
        state = startGame(def, position);
        continue;
      }
      const legal = legalGameMoves(state, rules);
      const move = chooseMove(state, level, rules, random);
      expect(move).not.toBeNull();
      expect(legal.some((candidate) => candidate.san === move?.san)).toBe(true);
      const outcome = playGameMove(state, rules, move as Move);
      expect(outcome).not.toBeNull();
      state = outcome?.state ?? state;
      played += 1;
    }
  }

  it('always chooses a legal move over 1000 self-play plies', () => {
    selfPlay(PAWN_WARS, PAWN_WARS_START, 500, 11);
    selfPlay(STANDARD, parseFen(START_FEN), 500, 22);
  }, 20000);
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

// Regression guards only: bounds are wide so slower CI runners never flake. The real budget
// (≤ 300 ms per move on reference tablets, non-functional.md §4) is measured on devices in M4.
describe('performance', () => {
  it('Bear stays within budget on the start position', () => {
    const state = startGame(STANDARD, parseFen(START_FEN));
    const bear = levelNamed('bear');
    const start = performance.now();
    const move = chooseMove(state, bear, rules, seededRandom(1));
    const elapsed = performance.now() - start;
    console.log(`Bear (start position): ${elapsed.toFixed(1)}ms`);
    expect(move).not.toBeNull();
    expect(elapsed).toBeLessThan(5000);
  });

  it('Bear stays within budget on a middlegame position', () => {
    const state = startGame(
      STANDARD,
      parseFen('r1bqk2r/ppp2ppp/2n2n2/2bpp3/2B1P3/3P1N2/PPP2PPP/RNBQ1RK1 w kq - 4 6'),
    );
    const bear = levelNamed('bear');
    const start = performance.now();
    const move = chooseMove(state, bear, rules, seededRandom(2));
    const elapsed = performance.now() - start;
    console.log(`Bear (middlegame): ${elapsed.toFixed(1)}ms`);
    expect(move).not.toBeNull();
    expect(elapsed).toBeLessThan(5000);
  });

  // 10 varied middlegame positions (`docs/computer-opponent.md` §3/§8 "Bear speed" reference set):
  // open and closed, tactical and quiet, both sides to move. Measured p50/p95 on this machine
  // before M4.2's move ordering / transposition table / iterative deepening / quiescence:
  // p50 ≈ 1850ms, p95 ≈ 4080ms; after: p50 ≈ 270-330ms, p95 ≈ 290-360ms (`TIME_BUDGET_MS = 250`
  // plus overshoot until the next deadline check). The 300ms/600ms bounds below are the "≤ 300 ms
  // locally + ≤ 600 ms in CI" option (spec's other option, a documented CI multiplier on a single
  // 300ms bound, would need knowing this run is on CI — Vitest runs this file the same way in
  // both, so a flat, generous ceiling that already covers CI's slower/shared hardware is simpler
  // and just as safe against flakes).
  const REFERENCE_POSITIONS = [
    'r1bqk2r/ppp2ppp/2n2n2/2bpp3/2B1P3/3P1N2/PPP2PPP/RNBQ1RK1 w kq - 4 6',
    'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
    'r2q1rk1/ppp2ppp/2np1n2/2b1p1B1/2B1P3/2NP1N2/PPP2PPP/R2Q1RK1 w - - 6 8',
    'r1bq1rk1/1pp1bppp/p1np1n2/4p3/B3P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 9',
    'r1b1kb1r/1pqp1ppp/p1n1pn2/8/3NP3/2N5/PPP1BPPP/R1BQ1RK1 w kq - 3 8',
    'rnbq1rk1/pp2bppp/4pn2/2pp4/3P4/2N1PN2/PPP1BPPP/R1BQ1RK1 w - - 0 7',
    'r2qkb1r/pb1n1ppp/1pn1p3/2ppP3/3P4/2PB1N2/PP1N1PPP/R1BQ1RK1 w kq - 2 9',
    'r1bqr1k1/pp1nbppp/2p2n2/3p4/2PP4/1PN1PN2/P4PPP/R1BQ1RK1 w - - 0 9',
    '2kr1b1r/ppp2ppp/2n1bn2/4p1B1/4P3/2NP1N2/PPP2PPP/2KR1B1R w - - 4 9',
    'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPB1PPP/R3K2R w KQkq - 1 2',
  ];

  it('Bear on the reference set: p50/p95 within budget', () => {
    const bear = levelNamed('bear');
    const times = REFERENCE_POSITIONS.map((fen, index) => {
      const state = startGame(STANDARD, parseFen(fen));
      const start = performance.now();
      const move = chooseMove(state, bear, rules, seededRandom(index + 1));
      const elapsed = performance.now() - start;
      expect(move).not.toBeNull();
      return elapsed;
    }).sort((a, b) => a - b);
    const p50 = times[Math.floor(times.length * 0.5)] ?? 0;
    const p95 = times[Math.min(times.length - 1, Math.floor(times.length * 0.95))] ?? 0;
    console.log(
      `Bear reference set: p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms ` +
        `max=${Math.max(...times).toFixed(1)}ms`,
    );
    expect(p50, `p50 ${p50.toFixed(1)}ms`).toBeLessThan(300);
    expect(p95, `p95 ${p95.toFixed(1)}ms`).toBeLessThan(600);
  });

  it('Mouse responds within budget', () => {
    const state = startGame(STANDARD, parseFen(START_FEN));
    const mouse = levelNamed('mouse');
    const start = performance.now();
    const move = chooseMove(state, mouse, rules, seededRandom(3));
    const elapsed = performance.now() - start;
    console.log(`Mouse: ${elapsed.toFixed(1)}ms`);
    expect(move).not.toBeNull();
    expect(elapsed).toBeLessThan(200);
  });
});

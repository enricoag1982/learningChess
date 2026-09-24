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

describe('performance', () => {
  it('Bear stays within budget on the start position', () => {
    const state = startGame(STANDARD, parseFen(START_FEN));
    const bear = levelNamed('bear');
    const start = performance.now();
    const move = chooseMove(state, bear, rules, seededRandom(1));
    const elapsed = performance.now() - start;
    console.log(`Bear (start position): ${elapsed.toFixed(1)}ms`);
    expect(move).not.toBeNull();
    expect(elapsed).toBeLessThan(1500);
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
    expect(elapsed).toBeLessThan(1500);
  });

  it('Mouse responds within budget', () => {
    const state = startGame(STANDARD, parseFen(START_FEN));
    const mouse = levelNamed('mouse');
    const start = performance.now();
    const move = chooseMove(state, mouse, rules, seededRandom(3));
    const elapsed = performance.now() - start;
    console.log(`Mouse: ${elapsed.toFixed(1)}ms`);
    expect(move).not.toBeNull();
    expect(elapsed).toBeLessThan(20);
  });
});

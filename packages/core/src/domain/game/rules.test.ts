import { describe, expect, it } from 'vitest';

import { chessJsRules as rules } from '../chess/chessjs-rules.ts';
import { parseFen } from '../chess/fen.ts';
import type { Color, Piece, Position, Square } from '../chess/types.ts';
import { gameResult, legalGameMoves, playGameMove, startGame } from './rules.ts';
import type { GameRulesDef, GameState } from './types.ts';

function pos(pieces: Partial<Record<Square, Piece>>, toMove: Color = 'w'): Position {
  return { pieces, markers: { stars: [], blocked: [] }, toMove, castling: '-', enPassant: null };
}

function playMoves(state: GameState, ...sans: readonly string[]): GameState {
  return sans.reduce((current, san) => {
    const played = playGameMove(current, rules, san);
    if (played === null) {
      throw new Error(`test setup: illegal move "${san}"`);
    }
    return played.state;
  }, state);
}

/** Asserts a move was played and returns the resulting state, without a non-null assertion. */
function assertPlayed(played: { readonly state: GameState } | null): { readonly state: GameState } {
  if (played === null) {
    throw new Error('expected a move to be played');
  }
  return played;
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

describe('startGame / legalGameMoves', () => {
  it('starts ongoing with plain chess legality', () => {
    const state = startGame(STANDARD, parseFen(START_FEN));
    expect(gameResult(state, rules)).toEqual({ kind: 'ongoing' });
    expect(legalGameMoves(state, rules)).toHaveLength(20);
  });
});

describe('Pawn Wars', () => {
  it('promoting wins immediately', () => {
    const position = pos({ a7: { color: 'w', type: 'p' }, g2: { color: 'b', type: 'p' } });
    const state = startGame(PAWN_WARS, position);
    const played = assertPlayed(playGameMove(state, rules, { from: 'a7', to: 'a8' }));
    expect(gameResult(played.state, rules)).toEqual({
      kind: 'win',
      winner: 'w',
      reason: 'promote',
    });
  });

  it('capturing the last enemy pawn wins', () => {
    const position = pos({ b4: { color: 'w', type: 'p' }, a5: { color: 'b', type: 'p' } });
    const state = startGame(PAWN_WARS, position);
    const played = assertPlayed(playGameMove(state, rules, 'bxa5'));
    expect(gameResult(played.state, rules)).toEqual({
      kind: 'win',
      winner: 'w',
      reason: 'capture-all',
    });
  });

  it('no legal moves loses for the side to move', () => {
    const position = pos(
      {
        a7: { color: 'b', type: 'p' },
        a6: { color: 'w', type: 'p' },
        h2: { color: 'w', type: 'p' },
      },
      'b',
    );
    const state = startGame(PAWN_WARS, position);
    expect(legalGameMoves(state, rules)).toHaveLength(0);
    expect(gameResult(state, rules)).toEqual({ kind: 'win', winner: 'w', reason: 'no-moves' });
  });

  it('refuses to play once the game has ended', () => {
    const position = pos({ a7: { color: 'w', type: 'p' }, g2: { color: 'b', type: 'p' } });
    const state = startGame(PAWN_WARS, position);
    const played = assertPlayed(playGameMove(state, rules, { from: 'a7', to: 'a8' }));
    expect(playGameMove(played.state, rules, 'g5')).toBeNull();
  });
});

describe('Win the Queen', () => {
  const WIN_THE_QUEEN: GameRulesDef = {
    kings: false,
    checkRules: false,
    noMoves: 'draw',
    win: { w: [{ kind: 'capture', piece: 'q' }], b: [{ kind: 'capture', piece: 'q' }] },
  };

  it('capturing the enemy queen wins', () => {
    const position = pos({
      d1: { color: 'w', type: 'r' },
      d8: { color: 'b', type: 'q' },
      a1: { color: 'w', type: 'q' },
    });
    const state = startGame(WIN_THE_QUEEN, position);
    const played = assertPlayed(playGameMove(state, rules, 'Rxd8'));
    expect(gameResult(played.state, rules)).toEqual({
      kind: 'win',
      winner: 'w',
      reason: 'capture-q',
    });
  });
});

describe('reach', () => {
  const REACH: GameRulesDef = {
    kings: false,
    checkRules: false,
    noMoves: 'draw',
    win: { w: [{ kind: 'reach', squares: ['e8'] }], b: [] },
  };

  it('reaching a target square wins', () => {
    const state = startGame(REACH, pos({ e6: { color: 'w', type: 'r' } }));
    const played = assertPlayed(playGameMove(state, rules, { from: 'e6', to: 'e8' }));
    expect(gameResult(played.state, rules)).toEqual({ kind: 'win', winner: 'w', reason: 'reach' });
  });
});

describe('moveLimit', () => {
  const LIMITED: GameRulesDef = {
    kings: false,
    checkRules: false,
    noMoves: 'draw',
    win: { w: [{ kind: 'capture-all' }], b: [{ kind: 'capture-all' }] },
    moveLimit: 1,
  };
  const limitedStart = pos({ a2: { color: 'w', type: 'p' }, h7: { color: 'b', type: 'p' } });

  it('draws once the move limit is reached', () => {
    const state = playMoves(startGame(LIMITED, limitedStart), 'a3', 'h6');
    expect(gameResult(state, rules)).toEqual({ kind: 'draw', reason: 'move-limit' });
  });

  it('a survive condition wins instead of drawing', () => {
    const def: GameRulesDef = {
      ...LIMITED,
      win: { w: LIMITED.win.w, b: [{ kind: 'survive', moves: 1 }] },
    };
    const state = playMoves(startGame(def, limitedStart), 'a3', 'h6');
    expect(gameResult(state, rules)).toEqual({ kind: 'win', winner: 'b', reason: 'survive' });
  });
});

describe('standard chess', () => {
  it("fool's mate: black wins by checkmate", () => {
    const state = playMoves(startGame(STANDARD, parseFen(START_FEN)), 'f3', 'e5', 'g4', 'Qh4#');
    expect(gameResult(state, rules)).toEqual({ kind: 'win', winner: 'b', reason: 'checkmate' });
  });

  it('stalemate draws', () => {
    const state = startGame(STANDARD, parseFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'));
    expect(gameResult(state, rules)).toEqual({ kind: 'draw', reason: 'stalemate' });
  });

  it('insufficient material draws', () => {
    const state = startGame(STANDARD, parseFen('8/8/8/4k3/8/8/8/4K3 w - - 0 1'));
    expect(gameResult(state, rules)).toEqual({ kind: 'draw', reason: 'insufficient-material' });
  });

  it('threefold repetition draws', () => {
    const state = playMoves(
      startGame(STANDARD, parseFen(START_FEN)),
      'Nf3',
      'Nf6',
      'Ng1',
      'Ng8',
      'Nf3',
      'Nf6',
      'Ng1',
      'Ng8',
    );
    expect(gameResult(state, rules)).toEqual({ kind: 'draw', reason: 'threefold-repetition' });
  });

  it('the fifty-move rule draws', () => {
    const position = parseFen('4k3/8/8/8/8/4r3/8/4K3 w - - 0 1');
    const state: GameState = {
      position,
      history: [],
      def: STANDARD,
      positions: [position],
      halfmoveClock: 100,
    };
    expect(gameResult(state, rules)).toEqual({ kind: 'draw', reason: 'fifty-move' });
  });
});

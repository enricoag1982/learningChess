import { describe, expect, it } from 'vitest';

import { chessJsRules as rules } from '../chess/chessjs-rules.ts';
import { parseFen } from '../chess/fen.ts';
import { startGame } from '../game/rules.ts';
import type { GameRulesDef } from '../game/types.ts';
import { MATE_HINT_AFTER_MOVES, mateHint, shouldOfferMateHint } from './hint.ts';

const STANDARD: GameRulesDef = {
  kings: true,
  checkRules: true,
  noMoves: 'draw',
  win: { w: [{ kind: 'checkmate' }], b: [{ kind: 'checkmate' }] },
};

describe('mateHint', () => {
  it('finds a mate-in-one for the side to move', () => {
    // Kd6/Qh2 vs Ka8: Qd6-d8 style back-rank ideas aside, a simple, unambiguous mate-in-1 for
    // White: Qh2-a2# is not forced, so use a textbook king+queen mate instead — Kb6, Qh1 vs Ka8:
    // Qh1-a1# is legal but not the *only* best move at depth 2, which is fine: `mateHint` only
    // promises the single best-scored move, and a forced mate always outscores everything else.
    const state = startGame(STANDARD, parseFen('k7/8/1K6/8/8/8/8/7Q w - - 0 1'));

    const hint = mateHint(state, rules);

    if (hint === null) {
      throw new Error('expected a hint');
    }
    // The hinted move must itself be legal for the side to move (White).
    const legal = rules.legalMoves(state.position);
    expect(legal.some((move) => move.from === hint.from && move.to === hint.to)).toBe(true);
    // And it must actually deliver mate (the position after it has no legal reply).
    const played = rules.play(state.position, { from: hint.from, to: hint.to });
    expect(played).not.toBeNull();
    if (played) {
      expect(rules.status(played.position).checkmate).toBe(true);
    }
  });

  it('returns null when the side to move has no legal move at all (stalemated/checkmated)', () => {
    // Black to move, stalemated (no check, no legal move).
    const state = startGame(STANDARD, parseFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'));

    expect(mateHint(state, rules)).toBeNull();
  });

  it('picks a real legal move even with no forced mate on the board', () => {
    const state = startGame(
      STANDARD,
      parseFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
    );

    const hint = mateHint(state, rules);

    expect(hint).not.toBeNull();
    const legal = rules.legalMoves(state.position);
    expect(legal.some((move) => move.from === hint?.from && move.to === hint.to)).toBe(true);
  });
});

describe('shouldOfferMateHint', () => {
  it('offers a hint from MATE_HINT_AFTER_MOVES kid moves onward, not before', () => {
    expect(shouldOfferMateHint(MATE_HINT_AFTER_MOVES - 1)).toBe(false);
    expect(shouldOfferMateHint(MATE_HINT_AFTER_MOVES)).toBe(true);
    expect(shouldOfferMateHint(MATE_HINT_AFTER_MOVES + 1)).toBe(true);
  });
});

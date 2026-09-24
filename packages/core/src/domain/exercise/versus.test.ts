import { describe, expect, it } from 'vitest';

import { chessJsRules as rules } from '../chess/chessjs-rules.ts';
import type { Color, Piece, Position, Square } from '../chess/types.ts';
import type { GameRulesDef } from '../game/types.ts';
import {
  canTakeBack,
  isKidTurn,
  kidMoveCount,
  playVersusMove,
  startVersus,
  takeBackVersusMove,
  versusPosition,
  versusStars,
} from './versus.ts';
import type { VersusGameDef } from './versus.ts';

function pos(pieces: Partial<Record<Square, Piece>>, toMove: Color = 'w'): Position {
  return { pieces, markers: { stars: [], blocked: [] }, toMove, castling: '-', enPassant: null };
}

const PAWN_WARS_RULES: GameRulesDef = {
  kings: false,
  checkRules: false,
  noMoves: 'lose',
  win: {
    w: [{ kind: 'promote' }, { kind: 'capture-all' }],
    b: [{ kind: 'promote' }, { kind: 'capture-all' }],
  },
};

function def(overrides: Partial<VersusGameDef> = {}): VersusGameDef {
  return {
    id: 'pawn-wars-test',
    concept: 'pawn-move',
    rules: PAWN_WARS_RULES,
    position: pos({
      a2: { color: 'w', type: 'p' },
      h7: { color: 'b', type: 'p' },
    }),
    opponentLevel: 1,
    kidColor: 'w',
    ...overrides,
  };
}

describe('startVersus', () => {
  it('starts playing, at the authored position, kid to move', () => {
    const state = startVersus(def());
    expect(state.status).toBe('playing');
    expect(isKidTurn(state)).toBe(true);
    expect(versusPosition(state).toMove).toBe('w');
    expect(kidMoveCount(state)).toBe(0);
  });
});

describe('playVersusMove', () => {
  it('an illegal move leaves the state unchanged', () => {
    const state = startVersus(def());
    const { state: next, outcome } = playVersusMove(state, rules, { from: 'a2', to: 'a5' });
    expect(outcome).toEqual({ kind: 'illegal' });
    expect(next).toBe(state);
  });

  it('a legal kid move plays and keeps the game going', () => {
    const state = startVersus(def());
    const { state: next, outcome } = playVersusMove(state, rules, { from: 'a2', to: 'a4' });
    expect(outcome.kind).toBe('played');
    expect(next.status).toBe('playing');
    expect(isKidTurn(next)).toBe(false);
    expect(kidMoveCount(next)).toBe(1);
  });

  it('promoting wins the game for the mover', () => {
    const state = startVersus(
      def({ position: pos({ a7: { color: 'w', type: 'p' }, h7: { color: 'b', type: 'p' } }) }),
    );
    const { state: next, outcome } = playVersusMove(state, rules, { from: 'a7', to: 'a8' });
    expect(outcome).toMatchObject({ kind: 'ended', status: 'won' });
    expect(next.status).toBe('won');
  });

  it('no move is accepted once the game has ended', () => {
    const state = startVersus(
      def({ position: pos({ a7: { color: 'w', type: 'p' }, h7: { color: 'b', type: 'p' } }) }),
    );
    const { state: ended } = playVersusMove(state, rules, { from: 'a7', to: 'a8' });
    const { state: after, outcome } = playVersusMove(ended, rules, { from: 'a8', to: 'a7' });
    expect(outcome).toEqual({ kind: 'illegal' });
    expect(after).toBe(ended);
  });
});

describe('take back', () => {
  it('is only offered once it is the kid’s turn again, with a full round played', () => {
    const state = startVersus(def());
    expect(canTakeBack(state)).toBe(false);

    const { state: afterKid } = playVersusMove(state, rules, { from: 'a2', to: 'a4' });
    expect(canTakeBack(afterKid)).toBe(false); // waiting for the bot's reply

    const { state: afterBot } = playVersusMove(afterKid, rules, { from: 'h7', to: 'h5' });
    expect(canTakeBack(afterBot)).toBe(true);
  });

  it('undoes both the kid move and the bot reply, restoring the earlier position', () => {
    const state = startVersus(def());
    const { state: afterKid } = playVersusMove(state, rules, { from: 'a2', to: 'a4' });
    const { state: afterBot } = playVersusMove(afterKid, rules, { from: 'h7', to: 'h5' });

    const restored = takeBackVersusMove(afterBot);
    expect(restored.status).toBe('playing');
    expect(isKidTurn(restored)).toBe(true);
    expect(kidMoveCount(restored)).toBe(0);
    expect(versusPosition(restored)).toEqual(versusPosition(state));
  });

  it('is a no-op when not currently available', () => {
    const state = startVersus(def());
    expect(takeBackVersusMove(state)).toBe(state);
  });
});

describe('versusStars', () => {
  it('0 while playing', () => {
    expect(versusStars(startVersus(def()))).toBe(0);
  });

  it('3 for a win within par', () => {
    const state = startVersus(
      def({
        position: pos({ a7: { color: 'w', type: 'p' }, h7: { color: 'b', type: 'p' } }),
        par: 2,
      }),
    );
    const { state: won } = playVersusMove(state, rules, { from: 'a7', to: 'a8' });
    expect(versusStars(won)).toBe(3);
  });

  it('3 for any win when par is not set', () => {
    const state = startVersus(
      def({ position: pos({ a7: { color: 'w', type: 'p' }, h7: { color: 'b', type: 'p' } }) }),
    );
    const { state: won } = playVersusMove(state, rules, { from: 'a7', to: 'a8' });
    expect(versusStars(won)).toBe(3);
  });

  it('1 for a loss', () => {
    // Black promotes toward rank 1 (its own forward direction), which wins for black — a loss for
    // the kid (`kidColor: 'w'`, the default).
    const state = startVersus(
      def({
        position: pos({ h2: { color: 'b', type: 'p' }, a2: { color: 'w', type: 'p' } }, 'b'),
      }),
    );
    const { state: lost } = playVersusMove(state, rules, { from: 'h2', to: 'h1' });
    expect(lost.status).toBe('lost');
    expect(versusStars(lost)).toBe(1);
  });

  it('2 for a win outside par (capture-all)', () => {
    const state = startVersus(
      def({
        position: pos({ a2: { color: 'w', type: 'p' }, b3: { color: 'b', type: 'p' } }),
        par: 0,
      }),
    );
    const { state: won } = playVersusMove(state, rules, { from: 'a2', to: 'b3' });
    expect(won.status).toBe('won');
    expect(versusStars(won)).toBe(2);
  });
});

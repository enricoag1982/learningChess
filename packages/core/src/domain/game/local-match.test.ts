import { describe, expect, it } from 'vitest';

import { chessJsRules as rules } from '../chess/chessjs-rules.ts';
import { parseFen } from '../chess/fen.ts';
import type { LocalMatchState } from './local-match.ts';
import {
  canTakeBack,
  localMatchGameState,
  localMatchPosition,
  localMatchResult,
  playLocalMove,
  startLocalMatch,
  takeBack,
} from './local-match.ts';
import type { GameRulesDef } from './types.ts';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const STANDARD: GameRulesDef = {
  kings: true,
  checkRules: true,
  noMoves: 'draw',
  win: { w: [{ kind: 'checkmate' }], b: [{ kind: 'checkmate' }] },
};

function playMoves(state: LocalMatchState, ...sans: readonly string[]): LocalMatchState {
  return sans.reduce((current, san) => playLocalMove(current, rules, san).state, state);
}

/** Fool's mate: 2 plies each side, black mates on move 2. */
function foolsMateState(): LocalMatchState {
  return playMoves(startLocalMatch(STANDARD, parseFen(START_FEN)), 'f3', 'e5', 'g4', 'Qh4#');
}

describe('startLocalMatch', () => {
  it('starts ongoing at the given position', () => {
    const state = startLocalMatch(STANDARD, parseFen(START_FEN));
    expect(localMatchPosition(state).toMove).toBe('w');
    expect(localMatchResult(state, rules)).toEqual({ kind: 'ongoing' });
    expect(canTakeBack(state, rules)).toBe(false);
  });
});

describe('playLocalMove', () => {
  it('plays either side in turn, no bot involved', () => {
    const state = startLocalMatch(STANDARD, parseFen(START_FEN));
    const afterWhite = playLocalMove(state, rules, 'e4');
    expect(afterWhite.outcome.kind).toBe('played');
    expect(localMatchPosition(afterWhite.state).toMove).toBe('b');

    const afterBlack = playLocalMove(afterWhite.state, rules, 'e5');
    expect(afterBlack.outcome.kind).toBe('played');
    expect(localMatchPosition(afterBlack.state).toMove).toBe('w');
    expect(localMatchGameState(afterBlack.state).history).toHaveLength(2);
  });

  it('rejects an illegal move without changing state', () => {
    const state = startLocalMatch(STANDARD, parseFen(START_FEN));
    const attempt = playLocalMove(state, rules, { from: 'e2', to: 'e5' });
    expect(attempt.outcome).toEqual({ kind: 'illegal' });
    expect(attempt.state).toBe(state);
  });

  it("reports checkmate as 'ended' with the winning colour", () => {
    const state = playMoves(startLocalMatch(STANDARD, parseFen(START_FEN)), 'f3', 'e5', 'g4');
    const played = playLocalMove(state, rules, 'Qh4#');
    if (played.outcome.kind !== 'ended') {
      throw new Error('expected the game to end');
    }
    expect(played.outcome.move.san).toBe('Qh4#');
    expect(played.outcome.result).toEqual({ kind: 'win', winner: 'b', reason: 'checkmate' });
    expect(localMatchResult(played.state, rules)).toEqual({
      kind: 'win',
      winner: 'b',
      reason: 'checkmate',
    });
  });

  it('refuses further moves once the game has ended', () => {
    const attempt = playLocalMove(foolsMateState(), rules, 'a3');
    expect(attempt.outcome).toEqual({ kind: 'illegal' });
  });
});

describe('canTakeBack / takeBack', () => {
  it('is unavailable before any move is played', () => {
    const state = startLocalMatch(STANDARD, parseFen(START_FEN));
    expect(canTakeBack(state, rules)).toBe(false);
    expect(takeBack(state, rules)).toBe(state);
  });

  it('undoes exactly the last ply, giving the turn back to its mover', () => {
    const start = startLocalMatch(STANDARD, parseFen(START_FEN));
    const afterWhite = playLocalMove(start, rules, 'e4').state;
    expect(canTakeBack(afterWhite, rules)).toBe(true);

    const undone = takeBack(afterWhite, rules);
    expect(localMatchPosition(undone).toMove).toBe('w');
    expect(localMatchGameState(undone).history).toHaveLength(0);
    expect(localMatchPosition(undone)).toEqual(localMatchPosition(start));
  });

  it('either player may take back the move right before theirs', () => {
    const afterBlack = playMoves(startLocalMatch(STANDARD, parseFen(START_FEN)), 'e4', 'e5');
    const undone = takeBack(afterBlack, rules);
    expect(localMatchPosition(undone).toMove).toBe('b');
    expect(localMatchGameState(undone).history).toHaveLength(1);
  });

  it('is unavailable once the game has ended', () => {
    const state = foolsMateState();
    expect(canTakeBack(state, rules)).toBe(false);
    expect(takeBack(state, rules)).toBe(state);
  });
});

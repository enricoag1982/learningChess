import type { MoveOutcome } from '@chess-kids/core';
import type { UiPatch } from './kind-ui.ts';

/** Shared by every move kind's `toUi` (collect-stars, capture, best-move, mate-in-n's own kinds
 * layer their scripted-reply handling on top of this for the `moved`/`solved` case). */
export function moveToUi(outcome: MoveOutcome): UiPatch {
  if (outcome.kind === 'illegal') {
    return { feedback: { kind: 'illegal' }, hint: null, wrongSquares: [], wrongMove: undefined };
  }
  if (outcome.kind === 'wrong') {
    return {
      feedback: { kind: 'wrong-move' },
      hint: null,
      wrongSquares: [],
      wrongMove: { from: outcome.move.from, to: outcome.move.to },
    };
  }
  return {
    feedback: outcome.kind === 'solved' ? { kind: 'solved' } : { kind: 'instruction' },
    hint: null,
    wrongSquares: [],
    wrongMove: undefined,
    lastMove: { from: outcome.move.from, to: outcome.move.to },
  };
}

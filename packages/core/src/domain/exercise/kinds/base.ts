import { SQUARES } from '../../chess/types.ts';
import type { MoveInput } from '../../chess/rules.ts';
import type { Position, Square } from '../../chess/types.ts';

/** Attempt a kid move: collect-stars, capture, best-move and mate-in-n all share this action shape. */
export interface MoveAction {
  readonly type: 'move';
  readonly move: MoveInput;
}

/** Result of a yes-no / choice answer attempt. */
export type AnswerOutcome = { readonly kind: 'solved' | 'wrong' | 'ignored' };

/**
 * Derives a yes-no / choice `AnswerOutcome` by comparing progress before/after `answerYesNo` /
 * `answerChoice`, which return only the next state (no outcome of their own): newly solved, a fresh
 * error, or unchanged (already solved — a no-op).
 */
export function deriveAnswerOutcome(
  before: { readonly errors: number; readonly solved: boolean },
  after: { readonly errors: number; readonly solved: boolean },
): AnswerOutcome {
  if (after.solved && !before.solved) return { kind: 'solved' };
  if (after.errors > before.errors) return { kind: 'wrong' };
  return { kind: 'ignored' };
}

/**
 * Any square holding a piece of the side to move — used to build a universally-illegal `move`
 * (`from === to`, which chess.js never generates for any position) for a move-based kind's
 * `wrongAction`. Every move-based exercise type requires the kid to have a piece on the board
 * (content-checked at build time), so this never throws for compiled content.
 */
export function anyKidSquare(position: Position): Square {
  const square = SQUARES.find((sq) => position.pieces[sq]?.color === position.toMove);
  if (square === undefined) {
    throw new Error('anyKidSquare: position has no piece for the side to move');
  }
  return square;
}

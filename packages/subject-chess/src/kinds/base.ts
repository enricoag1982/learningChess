import { SQUARES } from '../core/chess/types.ts';
import type { MoveInput } from '../core/chess/rules.ts';
import type { Position, Square } from '../core/chess/types.ts';

/** Attempt a kid move: collect-stars, capture, best-move and mate-in-n all share this action shape. */
export interface MoveAction {
  readonly type: 'move';
  readonly move: MoveInput;
}

/** Result of a yes-no / choice answer attempt. */
export type AnswerOutcome = { readonly kind: 'solved' | 'wrong' | 'ignored' };

/** Derives a yes-no / choice `AnswerOutcome` by comparing progress before/after: newly solved, a
 * fresh error, or unchanged. */
export function deriveAnswerOutcome(
  before: { readonly errors: number; readonly solved: boolean },
  after: { readonly errors: number; readonly solved: boolean },
): AnswerOutcome {
  if (after.solved && !before.solved) return { kind: 'solved' };
  if (after.errors > before.errors) return { kind: 'wrong' };
  return { kind: 'ignored' };
}

/** Any square holding a piece of the side to move — used to build a universally-illegal `move`
 * (`from === to`) for a move-based kind's `wrongAction`. Never throws for compiled content. */
export function anyKidSquare(position: Position): Square {
  const square = SQUARES.find((sq) => position.pieces[sq]?.color === position.toMove);
  if (square === undefined) {
    throw new Error('anyKidSquare: position has no piece for the side to move');
  }
  return square;
}

/** A move that is always illegal (`from === to`), for exactly one error from a fresh state — every
 * move kind's `wrongAction` (collect-stars, capture, best-move, mate-in-n). */
export function illegalTapMove(def: { readonly position: Position }): readonly MoveAction[] {
  const square = anyKidSquare(def.position);
  return [{ type: 'move', move: { from: square, to: square } }];
}

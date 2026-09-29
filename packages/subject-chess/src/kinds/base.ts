import { SQUARES } from '../core/chess/types.ts';
import type { MoveInput } from '../core/chess/rules.ts';
import type { Position, Square } from '../core/chess/types.ts';

export interface MoveAction {
  readonly type: 'move';
  readonly move: MoveInput;
}

export type AnswerOutcome = { readonly kind: 'solved' | 'wrong' | 'ignored' };

export function deriveAnswerOutcome(
  before: { readonly errors: number; readonly solved: boolean },
  after: { readonly errors: number; readonly solved: boolean },
): AnswerOutcome {
  if (after.solved && !before.solved) return { kind: 'solved' };
  if (after.errors > before.errors) return { kind: 'wrong' };
  return { kind: 'ignored' };
}

/** Any square with a piece of the side to move, for a universally-illegal `move` (`from === to`); never throws for compiled content. */
export function anyKidSquare(position: Position): Square {
  const square = SQUARES.find((sq) => position.pieces[sq]?.color === position.toMove);
  if (square === undefined) {
    throw new Error('anyKidSquare: position has no piece for the side to move');
  }
  return square;
}

/** A move that is always illegal (`from === to`): exactly one error from a fresh state; every move kind's `wrongAction`. */
export function illegalTapMove(def: { readonly position: Position }): readonly MoveAction[] {
  const square = anyKidSquare(def.position);
  return [{ type: 'move', move: { from: square, to: square } }];
}

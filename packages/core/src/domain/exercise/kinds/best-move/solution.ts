import { anyKidSquare } from '../base.ts';
import type { BestMoveDef, MoveAction } from './def.ts';

/** The first authored solution SAN, played directly (`MoveInput` accepts a plain SAN string). */
export function bestMoveSolution(def: BestMoveDef): readonly MoveAction[] {
  const solutionSan = def.solutions[0];
  if (solutionSan === undefined) {
    throw new Error(`best-move "${def.id}": no solutions`);
  }
  return [{ type: 'move', move: solutionSan }];
}

/** A move that is always illegal (`from === to`), for exactly one error from a fresh state. */
export function bestMoveWrongAction(def: BestMoveDef): readonly MoveAction[] {
  const square = anyKidSquare(def.position);
  return [{ type: 'move', move: { from: square, to: square } }];
}

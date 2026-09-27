import { illegalTapMove } from '../base.ts';
import type { BestMoveDef, MoveAction } from './kind.ts';

/** The first authored solution SAN, played directly (`MoveInput` accepts a plain SAN string). */
export function bestMoveSolution(def: BestMoveDef): readonly MoveAction[] {
  const solutionSan = def.solutions[0];
  if (solutionSan === undefined) {
    throw new Error(`best-move "${def.id}": no solutions`);
  }
  return [{ type: 'move', move: solutionSan }];
}

export const bestMoveWrongAction = illegalTapMove;

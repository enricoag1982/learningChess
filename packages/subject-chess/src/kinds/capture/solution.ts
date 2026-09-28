import type { VariantRules } from '../../core/variant/rules.ts';
import { solve } from '../../core/exercise/solver.ts';
import { illegalTapMove } from '../base.ts';
import type { CaptureDef, MoveAction } from './kind.ts';

/** Shortest capture-everything line (solver), as the move-actions that play it. */
export function captureSolution(def: CaptureDef, ctx: VariantRules): readonly MoveAction[] {
  const line = solve(def.position, ctx, 'capture');
  if (line === null) {
    throw new Error(`capture "${def.id}": no solution found`);
  }
  return line.map((move) => ({ type: 'move', move: { from: move.from, to: move.to } }));
}

export const captureWrongAction = illegalTapMove;

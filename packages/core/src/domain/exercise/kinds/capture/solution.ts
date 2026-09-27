import type { VariantRules } from '../../../variant/rules.ts';
import { solve } from '../../solver.ts';
import { anyKidSquare } from '../base.ts';
import type { CaptureDef, MoveAction } from './def.ts';

/** Shortest capture-everything line (solver), as the move-actions that play it. */
export function captureSolution(def: CaptureDef, ctx: VariantRules): readonly MoveAction[] {
  const line = solve(def.position, ctx, 'capture');
  if (line === null) {
    throw new Error(`capture "${def.id}": no solution found`);
  }
  return line.map((move) => ({ type: 'move', move: { from: move.from, to: move.to } }));
}

/** A move that is always illegal (`from === to`), for exactly one error from a fresh state. */
export function captureWrongAction(def: CaptureDef): readonly MoveAction[] {
  const square = anyKidSquare(def.position);
  return [{ type: 'move', move: { from: square, to: square } }];
}

import type { VariantRules } from '../../../variant/rules.ts';
import { solve } from '../../solver.ts';
import { anyKidSquare } from '../base.ts';
import type { CollectStarsDef, MoveAction } from './kind.ts';

/** Shortest star-collecting line (solver), as the move-actions that play it. */
export function collectStarsSolution(
  def: CollectStarsDef,
  ctx: VariantRules,
): readonly MoveAction[] {
  const line = solve(def.position, ctx, 'collect-stars');
  if (line === null) {
    throw new Error(`collect-stars "${def.id}": no solution found`);
  }
  return line.map((move) => ({ type: 'move', move: { from: move.from, to: move.to } }));
}

/** A move that is always illegal (`from === to`), for exactly one error from a fresh state. */
export function collectStarsWrongAction(def: CollectStarsDef): readonly MoveAction[] {
  const square = anyKidSquare(def.position);
  return [{ type: 'move', move: { from: square, to: square } }];
}

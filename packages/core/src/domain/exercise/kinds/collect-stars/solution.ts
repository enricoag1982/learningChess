import type { VariantRules } from '../../../variant/rules.ts';
import { solve } from '../../solver.ts';
import { illegalTapMove } from '../base.ts';
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

export const collectStarsWrongAction = illegalTapMove;

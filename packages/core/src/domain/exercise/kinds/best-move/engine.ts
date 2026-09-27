import type { Position } from '../../../chess/types.ts';
import { findMoveBySan } from '../../../chess/facts/san.ts';
import type { VariantRules } from '../../../variant/rules.ts';
import type { Hint } from '../../hint.ts';
import type { BestMoveDef } from './def.ts';

/** Best-move hint: piece → target square → the move, all from the first listed solution. */
export function bestMoveHint(
  def: BestMoveDef,
  position: Position,
  rules: VariantRules,
  level: 1 | 2 | 3,
): Hint {
  const solutionSan = def.solutions[0];
  const candidates = rules.legalMoves(position, { staticOpponent: true });
  const move = solutionSan === undefined ? undefined : findMoveBySan(candidates, solutionSan);
  if (level === 1) {
    return { kind: 'squares', level: 1, squares: move === undefined ? [] : [move.from] };
  }
  if (level === 2) {
    return { kind: 'squares', level: 2, squares: move === undefined ? [] : [move.to] };
  }
  return {
    kind: 'squares',
    level: 3,
    squares: move === undefined ? [] : [move.from, move.to],
    ...(move === undefined ? {} : { move: { from: move.from, to: move.to } }),
  };
}

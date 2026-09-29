import type { Position } from '../../core/chess/types.ts';
import { findMoveBySan } from '../../core/chess/facts/san.ts';
import type { VariantRules } from '../../core/variant/rules.ts';
import type { Hint } from '../../core/exercise/hint.ts';
import { moveLadderHint } from '../../core/exercise/hint.ts';
import type { BestMoveDef } from '../../core/exercise/types.ts';

/** Best-move hint: piece → target square → the move, all from the first listed solution. */
export function bestMoveHint(
  def: BestMoveDef,
  position: Position,
  rules: VariantRules,
  level: 1 | 2 | 3,
): Hint {
  const solutionSan = def.solutions[0];
  const candidates = rules.legalMoves(position, { staticOpponent: true });
  return moveLadderHint(
    solutionSan === undefined ? undefined : findMoveBySan(candidates, solutionSan),
    level,
  );
}

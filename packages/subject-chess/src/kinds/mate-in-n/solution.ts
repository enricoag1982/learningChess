import { replaySanLine } from '../../core/chess/facts/line.ts';
import type { VariantRules } from '../../core/variant/rules.ts';
import { illegalTapMove } from '../base.ts';
import type { MateInNDef } from '../../core/exercise/types.ts';
import type { MoveAction } from '../base.ts';

/** The scripted line's kid moves (indices 0, 2, 4, …); the opponent's replies are auto-applied by `act`, never played as a kid action. */
export function mateInNSolution(def: MateInNDef, ctx: VariantRules): readonly MoveAction[] {
  const replayed = replaySanLine(def.position, def.line, ctx.chess);
  if ('failedAt' in replayed) {
    throw new Error(
      `mate-in-n "${def.id}": scripted line invalid at ply ${String(replayed.failedAt)}`,
    );
  }
  return replayed.moves
    .filter((_, index) => index % 2 === 0)
    .map((move) => ({
      type: 'move' as const,
      move: {
        from: move.from,
        to: move.to,
        ...(move.promotion === undefined ? {} : { promotion: move.promotion }),
      },
    }));
}

export const mateInNWrongAction = illegalTapMove;

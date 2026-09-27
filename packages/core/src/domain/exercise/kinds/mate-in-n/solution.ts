import { replaySanLine } from '../../../chess/facts/line.ts';
import type { VariantRules } from '../../../variant/rules.ts';
import { anyKidSquare } from '../base.ts';
import type { MateInNDef, MoveAction } from './def.ts';

/**
 * The scripted line's own kid moves, in order — every other ply (indices 0, 2, 4, …): the
 * opponent's scripted replies are auto-applied by `act` (`playMateInN`), never played as a kid
 * action themselves.
 */
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

/** A move that is always illegal (`from === to`), for exactly one error from a fresh state. */
export function mateInNWrongAction(def: MateInNDef): readonly MoveAction[] {
  const square = anyKidSquare(def.position);
  return [{ type: 'move', move: { from: square, to: square } }];
}

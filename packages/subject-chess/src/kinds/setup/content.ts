import { piecesEqual } from '../../core/chess/facts/pieces.ts';
import type { SetupDef } from '../../core/exercise/types.ts';
import type { Square } from '../../core/chess/types.ts';
import { z } from 'zod';
import {
  checkExactlyOnePosition,
  compilePosition,
  exerciseCommonFields,
} from '../../content/kinds/common.ts';
import type { ExerciseKindContent } from '@learn/platform-content/kinds/kind-content';
import type { CompileContext } from '@learn/platform-content/kinds/kind-content';

const targetSchema = z
  .object({ board: z.string().optional(), fen: z.string().optional() })
  .strict()
  .superRefine(checkExactlyOnePosition);

export const schema = z
  .object({
    ...exerciseCommonFields,
    type: z.literal('setup'),
    target: targetSchema,
  })
  .strict();

function compile(raw: z.output<typeof schema>, ctx: CompileContext): SetupDef | null {
  const target = compilePosition(raw.target, {
    where: `${ctx.where}.target.board`,
    issues: ctx.issues,
  });
  if (target === null) {
    return null;
  }
  return ctx.build({ type: 'setup' as const, target });
}

/** The start position's every piece is part of the target, the target uses no markers, and the
 * target actually differs from the start (otherwise there is nothing to place). */
function verify(exercise: SetupDef, where: string, issues: string[]): void {
  const { position, target } = exercise;
  if (target.markers.stars.length > 0 || target.markers.blocked.length > 0) {
    issues.push(`${where}: setup target must not use star or blocked markers`);
  }
  for (const [square, piece] of Object.entries(position.pieces)) {
    const targetPiece = target.pieces[square as Square];
    if (
      targetPiece === undefined ||
      targetPiece.color !== piece.color ||
      targetPiece.type !== piece.type
    ) {
      issues.push(`${where}: start piece at ${square} is not part of the target`);
    }
  }
  if (piecesEqual(position.pieces, target.pieces)) {
    issues.push(`${where}: setup target is the same as the start position`);
  }
}

export const setup: ExerciseKindContent<SetupDef, typeof schema> = {
  type: 'setup',
  schema,
  compile,
  verify,
  // Starts from an empty (or near-empty) board: no piece of the side to move is expected.
  checksStimulus: () => false,
};

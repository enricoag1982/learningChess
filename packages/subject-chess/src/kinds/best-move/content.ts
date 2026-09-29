import type { BestMoveDef } from '../../core/exercise/types.ts';
import { z } from 'zod';
import { exerciseCommonFields } from '../../content/kinds/common.ts';
import type { ExerciseKindContent } from '@learn/platform-content/kinds/kind-content';
import type { CompileContext } from '@learn/platform-content/kinds/kind-content';
import { checkBestMoveVerify, verify } from './verify.ts';

/** A `best-move` exercise's optional load-time-only check: the loader computes the exact set of
 * legal kid moves satisfying the named rule and fails the build unless `solutions` equals that set.
 * Never compiled into the runtime `BestMoveDef`. See `verify.ts` for each rule's meaning. */
const bestMoveVerifySchema = z
  .string()
  .regex(
    /^attack [a-h][1-8]$|^save [a-h][1-8]$|^take-free$|^good-trade$|^check$|^escape-king$|^escape-block$|^escape-capture$|^castle$|^en-passant$/,
  );

/** Play the right move; any SAN in `solutions` solves it. Opponent, if any, is static. */
export const schema = z
  .object({
    ...exerciseCommonFields,
    type: z.literal('best-move'),
    solutions: z.array(z.string()).min(1),
    verify: bestMoveVerifySchema.optional(),
  })
  .strict();

function compile(raw: z.output<typeof schema>, ctx: CompileContext): BestMoveDef {
  const exercise: BestMoveDef = ctx.build({ type: 'best-move', solutions: raw.solutions });
  checkBestMoveVerify(exercise, raw.verify, ctx.where, ctx.issues);
  return exercise;
}

export const bestMove: ExerciseKindContent<BestMoveDef, typeof schema> = {
  type: 'best-move',
  schema,
  compile,
  verify,
};

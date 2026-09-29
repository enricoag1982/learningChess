import type { BestMoveDef } from '../../core/exercise/types.ts';
import { z } from 'zod';
import { exerciseCommonFields } from '../../content/kinds/common.ts';
import type { ExerciseKindContent } from '@learn/platform-content/kinds/kind-content';
import type { CompileContext } from '@learn/platform-content/kinds/kind-content';
import { checkBestMoveVerify, verify } from './verify.ts';

/** Optional load-time-only check: the loader computes the exact set of legal kid moves satisfying the rule and fails the build
 * unless `solutions` equals it; never compiled (see `verify.ts`). */
const bestMoveVerifySchema = z
  .string()
  .regex(
    /^attack [a-h][1-8]$|^save [a-h][1-8]$|^take-free$|^good-trade$|^check$|^escape-king$|^escape-block$|^escape-capture$|^castle$|^en-passant$/,
  );

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

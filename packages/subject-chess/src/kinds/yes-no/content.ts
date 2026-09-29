import type { Square } from '../../core/chess/types.ts';
import type { YesNoDef } from '../../core/exercise/types.ts';
import { z } from 'zod';
import { exerciseCommonFields, squareSchema } from '../../content/kinds/common.ts';
import type { ExerciseKindContent } from '@learn/platform-content/kinds/kind-content';
import type { CompileContext } from '@learn/platform-content/kinds/kind-content';
import { checkYesNoVerify } from './verify.ts';

/** Optional load-time-only check: the loader computes the named fact on the exercise's position and fails the build if it
 * contradicts `answer`. Also `can-castle kingside|queenside`, `can-en-passant`, `insufficient-material`; never compiled. */
const yesNoVerifySchema = z
  .string()
  .regex(
    /^(?:hanging|attacked|defended) [a-h][1-8]$|^(?:in-check|checkmate|stalemate|insufficient-material)$|^can-castle (?:kingside|queenside)$|^can-en-passant$/,
  );

export const schema = z
  .object({
    ...exerciseCommonFields,
    type: z.literal('yes-no'),
    answer: z.enum(['yes', 'no']),
    focus: squareSchema.optional(),
    verify: yesNoVerifySchema.optional(),
  })
  .strict();

function compile(raw: z.output<typeof schema>, ctx: CompileContext): YesNoDef {
  const exercise: YesNoDef = ctx.build({
    type: 'yes-no',
    answer: raw.answer === 'yes',
    ...(raw.focus === undefined ? {} : { focus: raw.focus as Square }),
  });
  checkYesNoVerify(exercise, raw.verify, ctx.where, ctx.issues);
  return exercise;
}

// No semantic `verify`: the schema already guarantees a boolean answer and a valid (optional)
// focus square; the authored `verify` field itself is checked at compile time (`checkYesNoVerify`).
export const yesNo: ExerciseKindContent<YesNoDef, typeof schema> = {
  type: 'yes-no',
  schema,
  compile,
};

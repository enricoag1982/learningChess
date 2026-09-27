import type { Square, YesNoDef } from '@chess-kids/core';
import { z } from 'zod';
import { exerciseCommonFields, squareSchema } from '../common.ts';
import type { ExerciseKindContent } from '../kind-content.ts';
import type { CompileContext } from '../kind-content.ts';
import { checkYesNoVerify } from './verify.ts';

/**
 * A `yes-no` exercise's optional load-time-only check: the loader computes the named rule fact on
 * the exercise's own position and fails the build if it contradicts `answer`, so a "safe?" /
 * "in check?" answer can never be authored wrong. Never compiled into the runtime `ExerciseDef`.
 * Also supports `can-castle kingside|queenside`, `can-en-passant` and `insufficient-material`.
 */
const yesNoVerifySchema = z
  .string()
  .regex(
    /^(?:hanging|attacked|defended) [a-h][1-8]$|^(?:in-check|checkmate|stalemate|insufficient-material)$|^can-castle (?:kingside|queenside)$|^can-en-passant$/,
  );

/** Answer a yes/no question about the position; `focus`, if given, is the square in question. */
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

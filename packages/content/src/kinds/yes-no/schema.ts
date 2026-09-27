import { z } from 'zod';
import { exerciseCommonFields, squareSchema } from '../common.ts';

/**
 * A `yes-no` exercise's optional load-time-only check: the loader computes the named rule fact on
 * the exercise's own position and fails the build if it contradicts `answer`, so a "safe?" /
 * "in check?" answer can never be authored wrong. Never compiled into the runtime `ExerciseDef`.
 * M4.1 adds `can-castle kingside|queenside`, `can-en-passant` and `insufficient-material`.
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

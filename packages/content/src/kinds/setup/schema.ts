import { z } from 'zod';
import { checkExactlyOnePosition, exerciseCommonFields } from '../common.ts';

/** A setup exercise's goal position: same shape as `positionFields`, minus `toMove` (unused). */
const targetSchema = z
  .object({ board: z.string().optional(), fen: z.string().optional() })
  .strict()
  .superRefine(checkExactlyOnePosition);

/** Place pieces from a palette to match `target`; `board`/`fen` is the (often empty) start position. */
export const schema = z
  .object({
    ...exerciseCommonFields,
    type: z.literal('setup'),
    target: targetSchema,
  })
  .strict();

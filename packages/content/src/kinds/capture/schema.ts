import { z } from 'zod';
import { exerciseCommonFields } from '../common.ts';

/** Capture every opponent piece (opponent is static); `stars3`/`stars2` are move-count thresholds. */
export const schema = z
  .object({
    ...exerciseCommonFields,
    type: z.literal('capture'),
    stars3: z.number().int().positive(),
    stars2: z.number().int().positive(),
  })
  .strict();

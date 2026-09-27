import { z } from 'zod';
import { exerciseCommonFields } from '../common.ts';

/** Move a piece over every star; `stars3`/`stars2` are move-count thresholds. */
export const schema = z
  .object({
    ...exerciseCommonFields,
    type: z.literal('collect-stars'),
    stars3: z.number().int().positive(),
    stars2: z.number().int().positive(),
  })
  .strict();

import { z } from 'zod';
import { exerciseSchema } from '../../kinds/index.ts';
import { miniGameCommonFields } from '../common.ts';

/**
 * A `series` mini-game (Square Hunt, Setup Race, M3's Safe or Not? / …): a fixed sequence of
 * `rounds`, each an exercise of any type (validated the same way as a lesson's own exercises),
 * scored on total mistakes (errors + hint levels) across every round.
 */
export const schema = z
  .object({
    ...miniGameCommonFields,
    mode: z.literal('series'),
    rounds: z.array(exerciseSchema).min(1),
    errors3: z.number().int().nonnegative(),
    errors2: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.errors2 < value.errors3) {
      ctx.addIssue({
        code: 'custom',
        path: ['errors2'],
        message: '"errors2" must be >= "errors3"',
      });
    }
  });

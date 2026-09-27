import { z } from 'zod';
import { checkExactlyOnePosition, positionFields } from '../../kinds/common.ts';
import { miniGameCommonFields } from '../common.ts';

/**
 * A `static` mini-game (default `mode`, back-compat with every file authored before M2.4): `type`
 * is the win condition (`capture-all`, the default, or `collect-stars`); `goal` is the spoken-text
 * key for the goal line shown in-game — two different things that happen to share the English word
 * "goal".
 */
export const schema = z
  .object({
    ...miniGameCommonFields,
    mode: z.literal('static').optional(),
    type: z.enum(['capture-all', 'collect-stars']).optional(),
    ...positionFields,
    par: z.number().int().positive(),
    moveLimit: z.number().int().positive(),
  })
  .strict()
  .superRefine(checkExactlyOnePosition);

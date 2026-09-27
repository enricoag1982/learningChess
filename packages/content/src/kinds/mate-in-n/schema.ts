import { z } from 'zod';
import { exerciseCommonFields } from '../common.ts';

/**
 * Deliver checkmate under real chess rules (both kings, real turn alternation): `line` is the full
 * scripted sequence in SAN — kid move, opponent reply, kid move, …, final kid move (which mates).
 */
export const schema = z
  .object({
    ...exerciseCommonFields,
    type: z.literal('mate-in-n'),
    n: z.number().int().positive(),
    line: z.array(z.string()).min(1),
    /** "Don't stalemate" exercises: the loader requires >= 1 legal kid move besides the scripted
     * line that would stalemate the opponent. Load-time only. */
    trap: z.literal('stalemate').optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const expected = 2 * value.n - 1;
    if (value.line.length !== expected) {
      ctx.addIssue({
        code: 'custom',
        path: ['line'],
        message: `"line" must have exactly 2*n-1 = ${String(expected)} moves for n=${String(value.n)}`,
      });
    }
  });

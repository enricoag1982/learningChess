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
    /**
     * M3.3 "don't stalemate" exercises: the loader requires at least one legal kid move (other than
     * the scripted mating line) that would stalemate the opponent instead — a trap the exercise is
     * meant to teach avoiding. Load-time only, never compiled into the runtime `MateInNDef`.
     */
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

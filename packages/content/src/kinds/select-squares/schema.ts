import { z } from 'zod';
import { exerciseCommonFields, squareSchema } from '../common.ts';

/** Tap the correct set of squares: explicit `answer`, or `derive`d from the position. */
export const schema = z
  .object({
    ...exerciseCommonFields,
    type: z.literal('select-squares'),
    answer: z.array(squareSchema).optional(),
    derive: z.enum(['legal-moves', 'attacked-by', 'check-escapes']).optional(),
    from: squareSchema.optional(),
  })
  .strict();

/** Exactly one of `answer` or `derive` (+ `from`, when the derivation needs a source square). */
export function refine(value: z.output<typeof schema>, ctx: z.RefinementCtx): void {
  const hasAnswer = value.answer !== undefined;
  const hasDerive = value.derive !== undefined || value.from !== undefined;
  if (hasAnswer === hasDerive) {
    ctx.addIssue({
      code: 'custom',
      message: 'exactly one of "answer" or "derive" + "from" is required',
    });
    return;
  }
  if (hasAnswer && value.answer?.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['answer'], message: '"answer" must not be empty' });
  }
  if (hasDerive) {
    const needsFrom = value.derive === 'legal-moves' || value.derive === 'attacked-by';
    if (value.derive === undefined) {
      ctx.addIssue({ code: 'custom', path: ['derive'], message: '"from" requires "derive"' });
    } else if (needsFrom && value.from === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['from'],
        message: `"derive: ${value.derive}" requires "from"`,
      });
    } else if (!needsFrom && value.from !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['from'],
        message: `"derive: ${value.derive}" must not set "from"`,
      });
    }
  }
}

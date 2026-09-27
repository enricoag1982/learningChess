import { z } from 'zod';
import { exerciseCommonFields } from '../common.ts';

/** A `best-move` exercise's optional load-time-only check: the loader computes the exact set of
 * legal kid moves satisfying the named rule and fails the build unless `solutions` equals that set.
 * Never compiled into the runtime `BestMoveDef`. See `verify.ts` for each rule's meaning. */
const bestMoveVerifySchema = z
  .string()
  .regex(
    /^attack [a-h][1-8]$|^save [a-h][1-8]$|^take-free$|^good-trade$|^check$|^escape-king$|^escape-block$|^escape-capture$|^castle$|^en-passant$/,
  );

/** Play the right move; any SAN in `solutions` solves it. Opponent, if any, is static. */
export const schema = z
  .object({
    ...exerciseCommonFields,
    type: z.literal('best-move'),
    solutions: z.array(z.string()).min(1),
    verify: bestMoveVerifySchema.optional(),
  })
  .strict();

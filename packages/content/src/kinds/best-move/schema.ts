import { z } from 'zod';
import { exerciseCommonFields } from '../common.ts';

/**
 * A `best-move` exercise's optional load-time-only check (M3.2b, M3.3): the loader computes the
 * exact set of legal kid moves satisfying the named rule and fails the build unless `solutions`
 * equals that set (order-insensitive, by SAN) — `attack <sq>` (the moved piece newly attacks the
 * enemy piece on `<sq>`), `save <sq>` (the kid piece on `<sq>`, not safe now, is safe after the
 * move, on its new square if it moved), `take-free` (captures of an undefended enemy piece),
 * `good-trade` (captures worth more than the capturer, or of an undefended piece), `check` (the
 * move gives check), `escape-king` / `escape-block` / `escape-capture` (the kid's king must be in
 * check: a non-capturing king move / an interposition / a capture of the checking piece, a king
 * capture included only under `escape-capture`); `castle` (M4.1: exactly the legal `O-O`/`O-O-O`
 * moves), `en-passant` (M4.1: exactly the legal en passant captures). Never compiled into the
 * runtime `BestMoveDef`.
 */
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

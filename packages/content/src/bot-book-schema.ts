import { z } from 'zod';
import { keySchema } from './schema.ts';

/** SAN move, permissive (chess.js checks legality; this schema only excludes empty strings). */
const sanSchema = z.string().min(1);

/** One opening line: a name and its SAN moves (`domain/bot/book.ts`'s `BookLine`; the ≤ 6-ply
 * cap and per-move legality are checked in `bot-book-load.ts`, not here — this schema is shape
 * only). */
export const bookLineSchema = z
  .object({
    name: keySchema,
    moves: z.array(sanSchema).min(1),
  })
  .strict();

export type BookLineYaml = z.infer<typeof bookLineSchema>;

/** Whole `bot-book.yaml` file: a flat list of opening lines. */
export const botBookFileSchema = z
  .object({
    lines: z.array(bookLineSchema).min(1),
  })
  .strict();

export type BotBookFileYaml = z.infer<typeof botBookFileSchema>;

import { z } from 'zod';
import { keySchema } from '@learn/platform-content/schema';

const sanSchema = z.string().min(1);

/** One opening line: name + SAN moves; shape only (the ≤ 6-ply cap and legality are checked in `bot-book-load.ts`). */
export const bookLineSchema = z
  .object({
    name: keySchema,
    moves: z.array(sanSchema).min(1),
  })
  .strict();

export type BookLineYaml = z.infer<typeof bookLineSchema>;

export const botBookFileSchema = z
  .object({
    lines: z.array(bookLineSchema).min(1),
  })
  .strict();

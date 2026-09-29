import { z } from 'zod';
import { keySchema } from './schema.ts';
import type { ZodShape } from './subject.ts';

export const badgeConditionTypeSchema = z.enum([
  'mastered',
  'stars-total',
  'perfect-lessons',
  'concept-correct',
  'game-win',
  'game-event',
  'game-played',
  'streak-days',
  'warmups',
  'comeback',
]);

/** Shape-only (`badges-load.ts` checks the per-`type` params and id cross-references); `subjectFields`
 * (chess: `extra`/`event`/`mode`) are appended last. */
export function badgeConditionSchema(subjectFields: ZodShape) {
  return z
    .object({
      type: badgeConditionTypeSchema,
      thresholds: z.array(z.number().int().positive()).min(1).max(3),
      scope: z.string().optional(),
      concept: keySchema.optional(),
      inARow: z.boolean().optional(),
      noHints: z.boolean().optional(),
      opponent: z.string().optional(),
      ...subjectFields,
    })
    .strict();
}

export type BadgeConditionYaml = z.infer<ReturnType<typeof badgeConditionSchema>>;

/** id, category (rewards.md §3) and condition; name / condition text keys derive from `id` (`rewards:badges.<id>.name` / `.condition`). */
export function badgeSchema(subjectFields: ZodShape) {
  return z
    .object({
      id: keySchema,
      category: z.enum(['milestone', 'skill', 'play', 'habit']),
      condition: badgeConditionSchema(subjectFields),
    })
    .strict();
}

export type BadgeYaml = z.infer<ReturnType<typeof badgeSchema>>;

export function badgesFileSchema(subjectFields: ZodShape) {
  return z
    .object({
      badges: z.array(badgeSchema(subjectFields)).min(1),
    })
    .strict();
}

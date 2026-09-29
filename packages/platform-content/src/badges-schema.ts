import { z } from 'zod';
import { keySchema } from './schema.ts';
import type { ZodShape } from './subject.ts';

/** Every badge condition type (rewards.md §4, `domain/badges.ts`'s `BadgeConditionType`). */
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

/**
 * One badge's condition, shape-only (`badges-load.ts`'s `validateCondition` checks which extra
 * fields each `type` actually needs and cross-references ids against content). `subjectFields`
 * (chess: `extra`/`event`/`mode`) are appended last, after the platform's own optional fields.
 */
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

/** One badge: id, catalogue category (rewards.md §3), and its earning condition. Name/condition
 * text keys are derived from `id` (`rewards:badges.<id>.name` / `.condition`), not authored here. */
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

/** Whole `badges.yaml` file: a flat list of badges. */
export function badgesFileSchema(subjectFields: ZodShape) {
  return z
    .object({
      badges: z.array(badgeSchema(subjectFields)).min(1),
    })
    .strict();
}

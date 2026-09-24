import { z } from 'zod';
import { keySchema } from './schema.ts';

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
 * fields each `type` actually needs and cross-references ids against content).
 */
export const badgeConditionSchema = z
  .object({
    type: badgeConditionTypeSchema,
    thresholds: z.array(z.number().int().positive()).min(1).max(3),
    scope: z.string().optional(),
    concept: keySchema.optional(),
    inARow: z.boolean().optional(),
    noHints: z.boolean().optional(),
    opponent: z.string().optional(),
    extra: z.enum(['queen-kept']).optional(),
    event: z.enum(['promotion', 'castling']).optional(),
    mode: z.enum(['local']).optional(),
  })
  .strict();

export type BadgeConditionYaml = z.infer<typeof badgeConditionSchema>;

/** One badge: id, catalogue category (rewards.md §3), and its earning condition. Name/condition
 * text keys are derived from `id` (`rewards:badges.<id>.name` / `.condition`), not authored here. */
export const badgeSchema = z
  .object({
    id: keySchema,
    category: z.enum(['milestone', 'skill', 'play', 'habit']),
    condition: badgeConditionSchema,
  })
  .strict();

export type BadgeYaml = z.infer<typeof badgeSchema>;

/** Whole `badges.yaml` file: a flat list of badges. */
export const badgesFileSchema = z
  .object({
    badges: z.array(badgeSchema).min(1),
  })
  .strict();

export type BadgesFileYaml = z.infer<typeof badgesFileSchema>;

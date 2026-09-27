import { z } from 'zod';
import {
  checkExactlyOnePosition,
  positionFields,
  squareSchema,
  textRefSchema,
} from './kinds/common.ts';
import { exerciseSchema, type ChoiceOptionYaml, type ExerciseYaml } from './kinds/index.ts';
import { miniGameSchema, type MiniGameYaml, type WinConditionYaml } from './modes/index.ts';
import { keySchema } from './schema.ts';

export { exerciseSchema, miniGameSchema, squareSchema, textRefSchema };
export type { ChoiceOptionYaml, ExerciseYaml, MiniGameYaml, WinConditionYaml };

/**
 * A lesson's demo: position, spoken text, and its board highlight — either `legal-moves <square>`
 * (most lessons: every square that piece can reach) or `squares [<sq> …]` (World 1: an explicit
 * list, e.g. a row/diagonal or a corner; zero squares highlights nothing).
 */
export const demoSchema = z
  .object({
    ...positionFields,
    /** Locale key for the demo's spoken text; defaults to `<lesson-id>.demo` when absent. */
    text: textRefSchema.optional(),
    highlight: z.string().regex(/^legal-moves [a-h][1-8]$|^squares(?: [a-h][1-8])*$/),
  })
  .strict()
  .superRefine(checkExactlyOnePosition);

/** One lesson file (`lessons/<world>/<lesson-id>.yaml`). */
export const lessonSchema = z
  .object({
    id: keySchema,
    /** Defaults to the lesson's own folder name when absent. */
    world: keySchema.optional(),
    order: z.number().int().positive(),
    concept: keySchema,
    character: keySchema,
    /** Defaults to `<id>.title` when absent. */
    title: textRefSchema.optional(),
    /** Defaults to `<id>.story` when absent. */
    story: textRefSchema.optional(),
    demo: demoSchema,
    guided: z.array(exerciseSchema),
    exercises: z.array(exerciseSchema).min(1),
    variants: z.array(exerciseSchema).optional(),
    boss: keySchema.optional(),
  })
  .strict();

export type LessonYaml = z.infer<typeof lessonSchema>;

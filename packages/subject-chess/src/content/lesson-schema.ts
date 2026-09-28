import { chessDemoSchema } from './chess-content.ts';
import { squareSchema, textRefSchema } from './kinds/common.ts';
import { exerciseSchema, type ChoiceOptionYaml, type ExerciseYaml } from './kinds/index.ts';
import { miniGameSchema, type MiniGameYaml, type WinConditionYaml } from './modes/index.ts';
import { keySchema } from '@learn/platform-content/schema';
import { z } from 'zod';

export { exerciseSchema, miniGameSchema, squareSchema, textRefSchema };
export type { ChoiceOptionYaml, ExerciseYaml, MiniGameYaml, WinConditionYaml };

/** A lesson's demo: the subject's own schema (chess: position, spoken text, board highlight). */
export const demoSchema = chessDemoSchema;

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

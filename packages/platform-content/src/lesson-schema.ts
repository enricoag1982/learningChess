// A subject's lesson / mini-game YAML schemas, built from its own registries (kinds, modes, demo,
// stimulus): the platform owns the file shapes, the subject only supplies the parts that vary.
import { z } from 'zod';
import { keySchema, textRefSchema } from './schema.ts';
import type { StimulusContent, SubjectContent } from './subject.ts';

function nonEmpty<T>(items: readonly T[]): [T, ...T[]] {
  const [first, ...rest] = items;
  if (first === undefined) {
    throw new Error('a subject needs at least one exercise kind');
  }
  return [first, ...rest];
}

/** One exercise (`guided` / `exercises` entry or a `series` round) discriminated by `type`: kind schemas, then stimulus and
 * kind cross-field checks. */
export function createExerciseSchema(
  kinds: SubjectContent['kinds'],
  stimulus?: Pick<StimulusContent, 'refine'>,
) {
  return z
    .discriminatedUnion('type', nonEmpty(Object.values(kinds).map((kind) => kind.schema)))
    .superRefine((raw, ctx) => {
      stimulus?.refine?.(raw, ctx);
      kinds[raw.type]?.refine?.(raw, ctx);
    });
}

/** The lesson (`lessons/<world>/<lesson-id>.yaml`) and mini-game (`minigames/<id>.yaml`, one union
 * member per mode) file schemas of `subject`. */
export function createLessonSchemas(subject: SubjectContent) {
  const exerciseSchema = createExerciseSchema(subject.kinds, subject.stimulus);
  const lessonSchema = z
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
      demo: subject.demo.schema,
      guided: z.array(exerciseSchema),
      exercises: z.array(exerciseSchema).min(1),
      variants: z.array(exerciseSchema).optional(),
      boss: keySchema.optional(),
    })
    .strict();
  const miniGameSchema = z.union(Object.values(subject.modes).map((mode) => mode.schema));
  return { exerciseSchema, lessonSchema, miniGameSchema };
}

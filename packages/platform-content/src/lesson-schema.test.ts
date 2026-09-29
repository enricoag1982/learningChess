import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { createExerciseSchema, createLessonSchemas } from './lesson-schema.ts';
import {
  fixtureKinds,
  fixtureSubject,
  validExercise,
  validLesson,
  validMiniGame,
} from './testing/fixture-subject.ts';

describe('createLessonSchemas', () => {
  const { exerciseSchema, lessonSchema, miniGameSchema } = createLessonSchemas(fixtureSubject);

  it('parses a lesson made of the subject kinds and demo', () => {
    expect(lessonSchema.safeParse(validLesson()).success).toBe(true);
  });

  it("takes the demo's shape from the subject", () => {
    const result = lessonSchema.safeParse(validLesson({ demo: { text: 'demo-demo' } }));

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['demo', 'label']);
  });

  it('is strict about lesson keys', () => {
    expect(lessonSchema.safeParse(validLesson({ notAField: 1 })).success).toBe(false);
  });

  it('needs at least one scored exercise', () => {
    expect(lessonSchema.safeParse(validLesson({ exercises: [] })).success).toBe(false);
  });

  it('discriminates exercises by their `type`', () => {
    expect(exerciseSchema.safeParse({ id: 'r-01', type: 'read' }).success).toBe(true);
    expect(exerciseSchema.safeParse(validExercise({ correct: undefined })).success).toBe(false);
    expect(exerciseSchema.safeParse(validExercise({ type: 'no-such-kind' })).success).toBe(false);
  });

  it('accepts a mini-game of any mode, `static` when `mode` is absent', () => {
    const rounds = { id: 'mg2', concept: 'c1', unlockAfter: 'demo-lesson', mode: 'rounds' };

    expect(miniGameSchema.safeParse(validMiniGame()).success).toBe(true);
    expect(miniGameSchema.safeParse({ ...rounds, rounds: [validExercise()] }).success).toBe(true);
    expect(miniGameSchema.safeParse({ ...rounds, mode: 'no-such-mode' }).success).toBe(false);
  });
});

describe('createExerciseSchema', () => {
  it("runs the stimulus' cross-field check before the kind's own", () => {
    const kinds = {
      answer: {
        ...fixtureKinds.answer,
        refine(_raw: unknown, ctx: z.RefinementCtx) {
          ctx.addIssue({ code: 'custom', message: 'kind' });
        },
      },
    };
    const schema = createExerciseSchema(kinds, {
      refine(_raw, ctx) {
        ctx.addIssue({ code: 'custom', message: 'stimulus' });
      },
    });

    const result = schema.safeParse(validExercise());

    expect(result.error?.issues.map((issue) => issue.message)).toEqual(['stimulus', 'kind']);
  });

  it('needs at least one kind', () => {
    expect(() => createExerciseSchema({})).toThrow('at least one exercise kind');
  });
});

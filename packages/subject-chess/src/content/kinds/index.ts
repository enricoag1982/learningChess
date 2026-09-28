/**
 * The exercise-kind content registry — the only place exercise-type dispatch happens in
 * `packages/content` for schemas, compiling and semantic verification.
 */
import type { DefOf, ExerciseType } from '../../chess.ts';
import type { z } from 'zod';
import { bestMove } from '../../kinds/best-move/content.ts';
import { capture } from '../../kinds/capture/content.ts';
import { choice } from '../../kinds/choice/content.ts';
import { collectStars } from '../../kinds/collect-stars/content.ts';
import { checkExactlyOnePosition } from './common.ts';
import type { ExerciseKindContent } from '@learn/platform-content/kinds/kind-content';
import { createExerciseSchema } from '@learn/platform-content/lesson-schema';
import { mateInN } from '../../kinds/mate-in-n/content.ts';
import { selectSquares } from '../../kinds/select-squares/content.ts';
import { setup } from '../../kinds/setup/content.ts';
import { yesNo } from '../../kinds/yes-no/content.ts';

/** Every exercise type's content, by `type` — today's `exerciseSchema` union member order. */
export const EXERCISE_KIND_CONTENT = {
  'collect-stars': collectStars,
  capture,
  'select-squares': selectSquares,
  'yes-no': yesNo,
  choice,
  'best-move': bestMove,
  setup,
  'mate-in-n': mateInN,
} as const satisfies { readonly [T in ExerciseType]: ExerciseKindContent<DefOf<T>, z.ZodType> };

/** One exercise (`guided` or `exercises` entry, a `series` round), discriminated by `type`. */
export const exerciseSchema = createExerciseSchema(EXERCISE_KIND_CONTENT, {
  refine: checkExactlyOnePosition,
});

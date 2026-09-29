/** The exercise-kind content registry: the only place exercise-type dispatch happens for schemas, compiling and semantic verification. */
import type { DefOf, ExerciseType } from '../../kinds/index.ts';
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

export const exerciseSchema = createExerciseSchema(EXERCISE_KIND_CONTENT, {
  refine: checkExactlyOnePosition,
});

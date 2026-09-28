/**
 * The exercise-kind content registry — the only place exercise-type dispatch happens in
 * `packages/content` for schemas, compiling and semantic verification.
 */
import type { DefOf, ExerciseDef, ExerciseType } from '../../chess.ts';
import { z } from 'zod';
import { bestMove } from '../../kinds/best-move/content.ts';
import { capture } from '../../kinds/capture/content.ts';
import { choice } from '../../kinds/choice/content.ts';
import { collectStars } from '../../kinds/collect-stars/content.ts';
import { checkExactlyOnePosition } from './common.ts';
import type { ExerciseKindContent } from '@learn/platform-content/kinds/kind-content';
import { mateInN } from '../../kinds/mate-in-n/content.ts';
import { selectSquares } from '../../kinds/select-squares/content.ts';
import { setup } from '../../kinds/setup/content.ts';
import { yesNo } from '../../kinds/yes-no/content.ts';

export type { ChoiceOptionYaml } from '../../kinds/choice/content.ts';
export type { CompileContext } from '@learn/platform-content/kinds/kind-content';

/** Any exercise kind's content, widened from its own precise type. */
export type AnyExerciseKindContent = ExerciseKindContent<ExerciseDef, z.ZodType>;

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

/** The content behaviour implementing `type`'s exercise kind. */
export function contentKindOf(type: ExerciseType): AnyExerciseKindContent {
  return EXERCISE_KIND_CONTENT[type];
}

/** One exercise (`guided` or `exercises` entry), discriminated by `type`. */
export const exerciseSchema = z
  .discriminatedUnion('type', [
    collectStars.schema,
    capture.schema,
    selectSquares.schema,
    yesNo.schema,
    choice.schema,
    bestMove.schema,
    setup.schema,
    mateInN.schema,
  ])
  .superRefine((raw, ctx) => {
    checkExactlyOnePosition(raw, ctx);
    contentKindOf(raw.type).refine?.(raw, ctx);
  });

export type ExerciseYaml = z.infer<typeof exerciseSchema>;

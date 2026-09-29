// The exercise-kind registry: the only place exercise-type dispatch happens.
import type { AnswerOutcome } from '@learn/platform-core/domain/exercise/answer';
import type { AnswerChoiceAction } from '@learn/platform-core/domain/exercise/kinds/choice/def';
import type { MathExerciseDef, MathKind, MathState } from '../core/types.ts';
import { mathChoiceKind } from './choice/kind.ts';
import type { NumberEntryAction, NumberEntryOutcome } from './number-entry/kind.ts';
import { numberEntryKind } from './number-entry/kind.ts';

export type ExerciseType = MathExerciseDef['type'];
export type DefOf<T extends ExerciseType> = Extract<MathExerciseDef, { readonly type: T }>;

export type MathAction = AnswerChoiceAction | NumberEntryAction;
export type MathOutcome = AnswerOutcome | NumberEntryOutcome;

export const MATH_KINDS = {
  choice: mathChoiceKind,
  'number-entry': numberEntryKind,
} as const satisfies { readonly [T in ExerciseType]: MathKind<DefOf<T>, MathAction, MathOutcome> };

export type AnyMathKind = MathKind<MathExerciseDef, MathAction, MathOutcome>;

export function kindOf(def: MathExerciseDef): AnyMathKind {
  return MATH_KINDS[def.type];
}

export function startExercise(def: MathExerciseDef): MathState {
  return kindOf(def).init(def);
}

// Every exercise kind's content-test-only `solution` / `wrongAction`, kept out of `MATH_KINDS`
// (and the app bundle): imported only by `/testing` and, through it, content tests.
import type { ExerciseSolution } from '@learn/platform-core/domain/exercise/kind';
import type { AnswerChoiceAction } from '@learn/platform-core/domain/exercise/kinds/choice/def';
import {
  choiceSolution,
  choiceWrongAction,
} from '@learn/platform-core/domain/exercise/kinds/choice/solution';
import type { MathChoiceDef, NumberEntryDef } from '../core/types.ts';
import type { DefOf, ExerciseType, MathAction } from './index.ts';
import type { NumberEntryAction } from './number-entry/kind.ts';
import { numberEntrySolution, numberEntryWrongAction } from './number-entry/solution.ts';

type MathSolution<
  D extends { readonly type: string; readonly id: string; readonly textKey: string },
  A extends MathAction,
> = ExerciseSolution<D, A, null>;

// Typed for the math defs, so the platform's `ChoiceDefBase` functions widen into `AnyMathSolution`.
const choiceSolutions: MathSolution<MathChoiceDef, AnswerChoiceAction> = {
  solution: choiceSolution,
  wrongAction: choiceWrongAction,
};

const numberEntrySolutions: MathSolution<NumberEntryDef, NumberEntryAction> = {
  solution: numberEntrySolution,
  wrongAction: numberEntryWrongAction,
};

export const MATH_SOLUTIONS = {
  choice: choiceSolutions,
  'number-entry': numberEntrySolutions,
} as const satisfies { readonly [T in ExerciseType]: MathSolution<DefOf<T>, MathAction> };

export type AnyMathSolution = MathSolution<DefOf<ExerciseType>, MathAction>;

export function solutionOf(def: { readonly type: ExerciseType }): AnyMathSolution {
  return MATH_SOLUTIONS[def.type];
}

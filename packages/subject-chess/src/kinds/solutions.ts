// Every exercise kind's content-test-only `solution`/`wrongAction`, kept out of `EXERCISE_KINDS`
// (and the app bundle): imported only by `/testing` and, through it, content tests.
import type { VariantRules } from '../core/variant/rules.ts';
import type { ExerciseSolution } from '@learn/platform-core/domain/exercise/kind';
import type { AnswerChoiceAction } from '@learn/platform-core/domain/exercise/kinds/choice/def';
import {
  choiceSolution,
  choiceWrongAction,
} from '@learn/platform-core/domain/exercise/kinds/choice/solution';
import type { ChoiceDef } from '../core/exercise/types.ts';
import { bestMoveSolution, bestMoveWrongAction } from './best-move/solution.ts';
import { captureSolution, captureWrongAction } from './capture/solution.ts';
import { collectStarsSolution, collectStarsWrongAction } from './collect-stars/solution.ts';
import type { DefOf, ExerciseAction, ExerciseType } from './index.ts';
import { mateInNSolution, mateInNWrongAction } from './mate-in-n/solution.ts';
import { selectSquaresSolution, selectSquaresWrongAction } from './select-squares/solution.ts';
import { setupSolution, setupWrongAction } from './setup/solution.ts';
import { yesNoSolution, yesNoWrongAction } from './yes-no/solution.ts';

type ChessSolution<
  D extends { readonly type: string; readonly id: string; readonly textKey: string },
  A extends ExerciseAction,
> = ExerciseSolution<D, A, VariantRules>;

// Typed for `ChoiceDef`, so the platform's `ChoiceDefBase` functions widen into `AnyExerciseSolution`.
const choiceSolutions: ChessSolution<ChoiceDef, AnswerChoiceAction> = {
  solution: choiceSolution,
  wrongAction: choiceWrongAction,
};

export const EXERCISE_SOLUTIONS = {
  'collect-stars': { solution: collectStarsSolution, wrongAction: collectStarsWrongAction },
  capture: { solution: captureSolution, wrongAction: captureWrongAction },
  'select-squares': { solution: selectSquaresSolution, wrongAction: selectSquaresWrongAction },
  'yes-no': { solution: yesNoSolution, wrongAction: yesNoWrongAction },
  choice: choiceSolutions,
  'best-move': { solution: bestMoveSolution, wrongAction: bestMoveWrongAction },
  setup: { solution: setupSolution, wrongAction: setupWrongAction },
  'mate-in-n': { solution: mateInNSolution, wrongAction: mateInNWrongAction },
} as const satisfies { readonly [T in ExerciseType]: ChessSolution<DefOf<T>, ExerciseAction> };

export type AnyExerciseSolution = ChessSolution<DefOf<ExerciseType>, ExerciseAction>;

export function solutionOf(def: { readonly type: ExerciseType }): AnyExerciseSolution {
  return EXERCISE_SOLUTIONS[def.type];
}

// Every exercise kind's content-test-only `solution`/`wrongAction`, kept out of `EXERCISE_KINDS`
// (and the app bundle): imported only by `/testing` and, through it, content tests.
import type { VariantRules } from '../../variant/rules.ts';
import type { ExerciseSolution } from '../kind.ts';
import { bestMoveSolution, bestMoveWrongAction } from './best-move/solution.ts';
import { captureSolution, captureWrongAction } from './capture/solution.ts';
import { choiceSolution, choiceTextKeys, choiceWrongAction } from './choice/solution.ts';
import { collectStarsSolution, collectStarsWrongAction } from './collect-stars/solution.ts';
import type { DefOf, ExerciseAction, ExerciseType } from './index.ts';
import { mateInNSolution, mateInNWrongAction } from './mate-in-n/solution.ts';
import { selectSquaresSolution, selectSquaresWrongAction } from './select-squares/solution.ts';
import { setupSolution, setupWrongAction } from './setup/solution.ts';
import { yesNoSolution, yesNoWrongAction } from './yes-no/solution.ts';

/** One exercise kind's `ExerciseSolution`, specialised to this domain's `VariantRules` context. */
type ChessSolution<
  D extends { readonly type: string; readonly id: string; readonly textKey: string },
  A extends ExerciseAction,
> = ExerciseSolution<D, A, VariantRules>;

/** Every exercise type's `solution` / `wrongAction`, by `type`. */
export const EXERCISE_SOLUTIONS = {
  'collect-stars': { solution: collectStarsSolution, wrongAction: collectStarsWrongAction },
  capture: { solution: captureSolution, wrongAction: captureWrongAction },
  'select-squares': { solution: selectSquaresSolution, wrongAction: selectSquaresWrongAction },
  'yes-no': { solution: yesNoSolution, wrongAction: yesNoWrongAction },
  choice: { solution: choiceSolution, wrongAction: choiceWrongAction, textKeys: choiceTextKeys },
  'best-move': { solution: bestMoveSolution, wrongAction: bestMoveWrongAction },
  setup: { solution: setupSolution, wrongAction: setupWrongAction },
  'mate-in-n': { solution: mateInNSolution, wrongAction: mateInNWrongAction },
} as const satisfies { readonly [T in ExerciseType]: ChessSolution<DefOf<T>, ExerciseAction> };

/** Any exercise kind's solution, widened from its own precise type. */
export type AnyExerciseSolution = ChessSolution<DefOf<ExerciseType>, ExerciseAction>;

/** The `solution`/`wrongAction` pair for `def`'s exercise type. */
export function solutionOf(def: { readonly type: ExerciseType }): AnyExerciseSolution {
  return EXERCISE_SOLUTIONS[def.type];
}

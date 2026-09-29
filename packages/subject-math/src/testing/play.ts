// Plays a def with its own kind's `solution()` / `wrongAction()`: proves the engine accepts the authored answer end to end.
import type { MathExerciseDef, MathState } from '../core/types.ts';
import { kindOf } from '../kinds/index.ts';
import type { MathAction } from '../kinds/index.ts';
import { solutionOf } from '../kinds/solutions.ts';

function play(
  def: MathExerciseDef,
  actions: readonly MathAction[],
  from: MathState = kindOf(def).init(def),
): MathState {
  const kind = kindOf(def);
  return actions.reduce((state, action) => kind.act(state, action, null).state, from);
}

/** Plays `def`'s `solution()` from a fresh state to a solved end. */
export function playSolution(def: MathExerciseDef): MathState {
  return play(def, solutionOf(def).solution(def, null));
}

/** Plays `def`'s `wrongAction()`, then its `solution()`: a wrong try costs exactly 1 error and never blocks solving. */
export function playWrongThenSolve(def: MathExerciseDef): MathState {
  const solution = solutionOf(def);
  const afterWrong = play(def, solution.wrongAction?.(def, null) ?? []);
  return play(def, solution.solution(def, null), afterWrong);
}

/** Stars earned so far; `0` until solved. */
export function starsFor(state: MathState): 0 | 1 | 2 | 3 {
  return state.solved ? kindOf(state.def).stars(state) : 0;
}

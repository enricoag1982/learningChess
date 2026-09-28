/**
 * Plays any `ExerciseDef` using its own kind's `solution()` / `wrongAction()` — the content build
 * (or the caller) already proved the authored answer / solutions / target / line is correct; this
 * only proves the engine accepts it end to end. Shared by every `packages/content` playthrough test
 * (World 1, 3, 4, 5) and by the content package's own kind-solution test.
 */
import { chessJsRules } from '../core/chess/chessjs-rules.ts';
import type { ExerciseState } from '../core/exercise/state.ts';
import { kindOf } from '../kinds/index.ts';
import { solutionOf } from '../kinds/solutions.ts';
import type { ExerciseDef } from '../core/exercise/types.ts';
import { createVariantRules } from '../core/variant/rules.ts';
import type { VariantRules } from '../core/variant/rules.ts';

const defaultRules = createVariantRules(chessJsRules);

/** Plays `def`'s own kind's `solution()` from a fresh state to a solved end. */
export function playSolution(def: ExerciseDef, rules: VariantRules = defaultRules): ExerciseState {
  const kind = kindOf(def);
  return solutionOf(def)
    .solution(def, rules)
    .reduce((state, action) => kind.act(state, action, rules).state, kind.init(def));
}

/**
 * Plays `def`'s `wrongAction()` (if the kind has one), then its `solution()` — proves a wrong try
 * costs exactly 1 error and never blocks solving. No-op past the wrong try if the kind has none.
 */
export function playWrongThenSolve(
  def: ExerciseDef,
  rules: VariantRules = defaultRules,
): ExerciseState {
  const kind = kindOf(def);
  const solution = solutionOf(def);
  const wrong = solution.wrongAction?.(def, rules) ?? [];
  const afterWrong = wrong.reduce(
    (state, action) => kind.act(state, action, rules).state,
    kind.init(def),
  );
  return solution
    .solution(def, rules)
    .reduce((state, action) => kind.act(state, action, rules).state, afterWrong);
}

/**
 * Plays `def` to a solved (or thrown) end, using `rules` (default: standard variant rules over
 * `chessJsRules`) — a fold over its own kind's `solution()`.
 */
export function playExerciseToCompletion(
  def: ExerciseDef,
  rules: VariantRules = defaultRules,
): ExerciseState {
  return playSolution(def, rules);
}

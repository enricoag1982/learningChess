import type { Hint } from '../core/exercise/hint.ts';
import type { ExerciseState } from '../core/exercise/state.ts';
import type { VariantRules } from '../core/variant/rules.ts';
import { kindOf } from '../kinds/index.ts';

/** Advances the hint ladder by one level (capped at 3) and returns the hint for that level. */
export function requestHint(
  state: ExerciseState,
  rules: VariantRules,
): { readonly state: ExerciseState; readonly hint: Hint } {
  const level = (state.hintLevel < 3 ? state.hintLevel + 1 : 3) as 1 | 2 | 3;
  return kindOf(state.def).hint(state, level, rules);
}

/** Stars earned so far; `0` until solved. */
export function starsFor(state: ExerciseState): 0 | 1 | 2 | 3 {
  if (!state.solved) {
    return 0;
  }
  return kindOf(state.def).stars(state);
}

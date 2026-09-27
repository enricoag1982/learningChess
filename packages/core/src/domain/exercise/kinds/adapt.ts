// Bridges the still-general `engine.ts` functions (broad `ExerciseState`, no public API change) to
// a specific kind's narrower `ExerciseStateOf<D>`. `def` is never reassigned, so narrowing is safe.
import { requestHint, starsFor } from '../engine.ts';
import type { ExerciseState } from '../engine.ts';
import type { Hint } from '../hint.ts';
import type { VariantRules } from '../../variant/rules.ts';
import type { ExerciseStateOf } from '../state.ts';
import type { ExerciseDef } from '../types.ts';

/** The one narrowing point every helper below funnels through. */
function narrow<D extends ExerciseDef>(state: ExerciseState): ExerciseStateOf<D> {
  return state as ExerciseStateOf<D>;
}

/** `state` widened to the general `ExerciseState` a shared engine function expects — always safe. */
export function widen<D extends ExerciseDef>(state: ExerciseStateOf<D>): ExerciseState {
  return state;
}

/** Narrows a shared engine function's `{state, outcome}` result back to `D`. */
export function narrowStep<D extends ExerciseDef, O>(step: {
  readonly state: ExerciseState;
  readonly outcome: O;
}): { readonly state: ExerciseStateOf<D>; readonly outcome: O } {
  return { state: narrow<D>(step.state), outcome: step.outcome };
}

/** Narrows a shared engine function's own resulting `ExerciseState` back to `D`. */
export function narrowState<D extends ExerciseDef>(state: ExerciseState): ExerciseStateOf<D> {
  return narrow<D>(state);
}

/** `requestHint`, narrowed to a specific kind's `D`. */
export function delegateHint<D extends ExerciseDef>(
  state: ExerciseStateOf<D>,
  ctx: VariantRules,
): { readonly state: ExerciseStateOf<D>; readonly hint: Hint } {
  const result = requestHint(widen(state), ctx);
  return { state: narrow<D>(result.state), hint: result.hint };
}

/** `starsFor`, narrowed to `1 | 2 | 3`: every kind's `stars()` is only ever called once `solved`. */
export function delegateStars<D extends ExerciseDef>(state: ExerciseStateOf<D>): 1 | 2 | 3 {
  return starsFor(widen(state)) as 1 | 2 | 3;
}

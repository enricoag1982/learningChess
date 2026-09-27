/**
 * Bridges the still-general `engine.ts` functions (kept accepting/returning the broad
 * `ExerciseState` — no public API/behaviour change) to a specific kind's narrower
 * `ExerciseStateOf<D>`. Every one of these functions returns its input `state` with only
 * `position` / `history` / `moves` / `selected` / `errors` / `hintLevel` / `solved` / `wrongOptions`
 * changed — `def` itself is never reassigned — so narrowing the result back to the caller's own
 * `D` is safe. Centralised here instead of one cast per kind file; `kinds/<type>/engine.ts` (4a-f)
 * removes the need as each moved function becomes single-type and generic on its own.
 */
import { requestHint, starsFor } from '../engine.ts';
import type { ExerciseState, Hint } from '../engine.ts';
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

/** `requestHint`, narrowed to a specific kind's `D`; the bumped `level` it computes matches the caller's own. */
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

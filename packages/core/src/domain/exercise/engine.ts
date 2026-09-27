import type { Move, MoveInput } from '../chess/rules.ts';
import type { Square } from '../chess/types.ts';
import type { VariantRules } from '../variant/rules.ts';
import type { Hint } from './hint.ts';
import type { Step } from './kind.ts';
import { assertKind, kindOf } from './kinds/index.ts';
import type { MoveOutcome } from './kinds/static-move.ts';
import type { ExerciseStateOf } from './state.ts';
import type { ExerciseDef } from './types.ts';

/** Immutable exercise progress; public shape unchanged (`def`'s own type is `ExerciseDef` here). */
export type ExerciseState = ExerciseStateOf<ExerciseDef>;

/** Starts a fresh exercise at its authored position. */
export function startExercise(def: ExerciseDef): ExerciseState {
  return kindOf(def).init(def);
}

/** Legal kid moves right now (collect-stars / capture / best-move / mate-in-n only; `[]` otherwise or once solved). */
export function exerciseMoves(state: ExerciseState, rules: VariantRules, from?: Square): Move[] {
  const { input } = kindOf(state.def);
  if (state.solved || (input !== 'static-move' && input !== 'real-move')) {
    return [];
  }
  return rules.legalMoves(state.position, { staticOpponent: true }, from);
}

/** Plays a kid move for a collect-stars / capture / best-move exercise. */
export function playMove(
  state: ExerciseState,
  rules: VariantRules,
  move: MoveInput,
): { readonly state: ExerciseState; readonly outcome: MoveOutcome } {
  assertKind(state.def, 'static-move', 'playMove');
  // `input === 'static-move'` (just asserted) means this is always a collect-stars / capture /
  // best-move kind, whose `act` always takes a `{type: 'move', move}` action and returns a
  // `MoveOutcome` — a fact `AnyExerciseKind`'s widened signature does not itself capture.
  return kindOf(state.def).act(state, { type: 'move', move }, rules) as Step<
    ExerciseState,
    MoveOutcome
  >;
}

export {
  toggleSquare,
  selectSquaresAnswer,
  submitSelection,
} from './kinds/select-squares/engine.ts';
export { answerYesNo } from './kinds/yes-no/engine.ts';
export { answerChoice } from './kinds/choice/engine.ts';

export { placePiece, setupPalette } from './kinds/setup/engine.ts';

export { undo } from './kinds/static-move.ts';

export { playMateInN } from './kinds/mate-in-n/engine.ts';

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

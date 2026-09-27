import type { Move } from '../chess/rules.ts';
import type { Square } from '../chess/types.ts';
import type { VariantRules } from '../variant/rules.ts';
import type { Hint } from './hint.ts';
import { bestMoveHint } from './kinds/best-move/engine.ts';
import { choiceHint } from './kinds/choice/engine.ts';
import { mateInNHint } from './kinds/mate-in-n/engine.ts';
import { selectSquaresHint } from './kinds/select-squares/engine.ts';
import { setupHint, setupStars } from './kinds/setup/engine.ts';
import { moveCountStars, moveHint } from './kinds/static-move.ts';
import { yesNoHint } from './kinds/yes-no/engine.ts';
import type { ExerciseStateOf } from './state.ts';
import { errorHintStars } from './stars.ts';
import type { ExerciseDef } from './types.ts';

/** Immutable exercise progress; public shape unchanged (`def`'s own type is `ExerciseDef` here). */
export type ExerciseState = ExerciseStateOf<ExerciseDef>;

/** Starts a fresh exercise at its authored position. */
export function startExercise(def: ExerciseDef): ExerciseState {
  return {
    def,
    position: def.position,
    history: [],
    moves: 0,
    selected: [],
    errors: 0,
    hintLevel: 0,
    solved: false,
    wrongOptions: [],
  };
}

const NON_MOVE_TYPES = new Set<ExerciseDef['type']>([
  'select-squares',
  'yes-no',
  'choice',
  'setup',
]);

/** Legal kid moves right now (collect-stars / capture / best-move / mate-in-n only; `[]` otherwise or once solved). */
export function exerciseMoves(state: ExerciseState, rules: VariantRules, from?: Square): Move[] {
  if (state.solved || NON_MOVE_TYPES.has(state.def.type)) {
    return [];
  }
  return rules.legalMoves(state.position, { staticOpponent: true }, from);
}

export { playMove } from './kinds/static-move.ts';

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
  const bumped: ExerciseState = { ...state, hintLevel: level };

  if (bumped.def.type === 'select-squares') {
    return { state: bumped, hint: selectSquaresHint(state, bumped.def, rules, level) };
  }
  if (bumped.def.type === 'best-move') {
    return { state: bumped, hint: bestMoveHint(bumped.def, bumped.position, rules, level) };
  }
  if (bumped.def.type === 'yes-no') {
    return { state: bumped, hint: yesNoHint(bumped.def, level) };
  }
  if (bumped.def.type === 'choice') {
    return choiceHint(bumped, bumped.def, level);
  }
  if (bumped.def.type === 'setup') {
    return setupHint(bumped, bumped.def, level);
  }
  if (bumped.def.type === 'mate-in-n') {
    return { state: bumped, hint: mateInNHint(state, bumped.def, rules, level) };
  }
  return { state: bumped, hint: moveHint(state, rules, level) };
}

/** Stars earned so far; `0` until solved. */
export function starsFor(state: ExerciseState): 0 | 1 | 2 | 3 {
  if (!state.solved) {
    return 0;
  }
  if (
    state.def.type === 'select-squares' ||
    state.def.type === 'yes-no' ||
    state.def.type === 'choice' ||
    state.def.type === 'best-move' ||
    state.def.type === 'mate-in-n'
  ) {
    return errorHintStars(state.hintLevel, state.errors);
  }
  if (state.def.type === 'setup') {
    return setupStars(state.hintLevel, state.errors);
  }
  return moveCountStars(state.moves, state.def.stars3, state.def.stars2, state.hintLevel);
}

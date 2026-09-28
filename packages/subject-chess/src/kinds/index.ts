// The exercise-kind registry — the only place exercise-type dispatch happens in `packages/core`.
import type { Move } from '../core/chess/rules.ts';
import type { Square } from '../core/chess/types.ts';
import type { VariantRules } from '../core/variant/rules.ts';
import type { Hint } from '../core/exercise/hint.ts';
import type { ExerciseKind } from '@learn/platform-core/domain/exercise/kind';
import type { ExerciseState, ExerciseStateOf } from '../core/exercise/state.ts';
import type { ExerciseDef } from '../core/exercise/types.ts';
import type { MoveAction } from './base.ts';
import { bestMoveKind } from './best-move/kind.ts';
import { captureKind } from './capture/kind.ts';
import type { AnswerChoiceAction } from './choice/kind.ts';
import { choiceKind } from './choice/kind.ts';
import { collectStarsKind } from './collect-stars/kind.ts';
import { mateInNKind } from './mate-in-n/kind.ts';
import type { SelectSquaresAction } from './select-squares/kind.ts';
import { selectSquaresKind } from './select-squares/kind.ts';
import type { PlaceAction } from './setup/kind.ts';
import { setupKind } from './setup/kind.ts';
import type { UndoAction } from './static-move.ts';
import type { AnswerYesNoAction } from './yes-no/kind.ts';
import { yesNoKind } from './yes-no/kind.ts';

export type { ExerciseDef } from '../core/exercise/types.ts';
export type ExerciseType = ExerciseDef['type'];
export type DefOf<T extends ExerciseType> = Extract<ExerciseDef, { readonly type: T }>;

/** Every action an exercise kind's `act` accepts, across every exercise type. */
export type ExerciseAction =
  | MoveAction
  | UndoAction
  | SelectSquaresAction
  | AnswerYesNoAction
  | AnswerChoiceAction
  | PlaceAction;

/** One chess exercise kind: `ExerciseKind` specialised to this domain's `Hint` / `VariantRules`. */
export type ChessKind<D extends ExerciseDef, A extends ExerciseAction, O> = ExerciseKind<
  D,
  ExerciseStateOf<D>,
  A,
  O,
  Hint,
  VariantRules
>;

/** Every exercise type's kind, by `type`. */
export const EXERCISE_KINDS = {
  'collect-stars': collectStarsKind,
  capture: captureKind,
  'select-squares': selectSquaresKind,
  'yes-no': yesNoKind,
  choice: choiceKind,
  'best-move': bestMoveKind,
  setup: setupKind,
  'mate-in-n': mateInNKind,
} as const satisfies { readonly [T in ExerciseType]: ChessKind<DefOf<T>, ExerciseAction, unknown> };

export type ActionOf<T extends ExerciseType> = Parameters<(typeof EXERCISE_KINDS)[T]['act']>[1];
export type OutcomeOf<T extends ExerciseType> = ReturnType<
  (typeof EXERCISE_KINDS)[T]['act']
>['outcome'];

/** Any exercise kind, widened from its own precise type — the shape every dispatch site works with. */
export type AnyExerciseKind = ChessKind<ExerciseDef, ExerciseAction, OutcomeOf<ExerciseType>>;

/** The kind implementing `def`'s exercise type. */
export function kindOf(def: ExerciseDef): AnyExerciseKind {
  return EXERCISE_KINDS[def.type];
}

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

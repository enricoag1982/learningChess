// The exercise-kind registry: the only place exercise-type dispatch happens.
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

export type ExerciseType = ExerciseDef['type'];
export type DefOf<T extends ExerciseType> = Extract<ExerciseDef, { readonly type: T }>;

export type ExerciseAction =
  | MoveAction
  | UndoAction
  | SelectSquaresAction
  | AnswerYesNoAction
  | AnswerChoiceAction
  | PlaceAction;

export type ChessKind<D extends ExerciseDef, A extends ExerciseAction, O> = ExerciseKind<
  D,
  ExerciseStateOf<D>,
  A,
  O,
  Hint,
  VariantRules
>;

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

export type AnyExerciseKind = ChessKind<ExerciseDef, ExerciseAction, OutcomeOf<ExerciseType>>;

export function kindOf(def: ExerciseDef): AnyExerciseKind {
  return EXERCISE_KINDS[def.type];
}

export function startExercise(def: ExerciseDef): ExerciseState {
  return kindOf(def).init(def);
}

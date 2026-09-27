/**
 * The exercise-kind registry — the only place exercise-type dispatch happens in `packages/core`.
 * `engine.ts`'s legacy per-type functions stay the public API; they (and everything else) go
 * through `kindOf`/`EXERCISE_KINDS` instead of their own `if`/`switch` on `def.type`.
 */
import type { VariantRules } from '../../variant/rules.ts';
import type { Hint } from '../engine.ts';
import type { ExerciseKind } from '../kind.ts';
import type { ExerciseStateOf } from '../state.ts';
import type { ExerciseDef } from '../types.ts';
import type { MoveAction } from './base.ts';
import { bestMoveKind } from './best-move/kind.ts';
import { captureKind } from './capture/kind.ts';
import type { AnswerChoiceAction } from './choice/def.ts';
import { choiceKind } from './choice/kind.ts';
import { collectStarsKind } from './collect-stars/kind.ts';
import { mateInNKind } from './mate-in-n/kind.ts';
import type { SelectSquaresAction } from './select-squares/def.ts';
import { selectSquaresKind } from './select-squares/kind.ts';
import type { PlaceAction } from './setup/def.ts';
import { setupKind } from './setup/kind.ts';
import type { AnswerYesNoAction } from './yes-no/def.ts';
import { yesNoKind } from './yes-no/kind.ts';

export type { ExerciseDef } from '../types.ts';
export type ExerciseType = ExerciseDef['type'];
export type DefOf<T extends ExerciseType> = Extract<ExerciseDef, { readonly type: T }>;

/** Every action an exercise kind's `act` accepts, across every exercise type. */
export type ExerciseAction =
  MoveAction | SelectSquaresAction | AnswerYesNoAction | AnswerChoiceAction | PlaceAction;

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

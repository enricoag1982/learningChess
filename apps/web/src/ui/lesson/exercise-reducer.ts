import type {
  ExerciseDef,
  ExerciseState,
  Hint,
  MoveInput,
  Square,
  VariantRules,
} from '@chess-kids/core';
import {
  playMove,
  requestHint,
  startExercise,
  submitSelection,
  toggleSquare,
  undo,
} from '@chess-kids/core';

/** What the Owl bubble should say right now; resolved to text by the component (i18n lives there). */
export type ExerciseFeedback =
  | { readonly kind: 'instruction' }
  | { readonly kind: 'tap-first' }
  | { readonly kind: 'illegal' }
  | { readonly kind: 'select-wrong' }
  | { readonly kind: 'select-missing' }
  | { readonly kind: 'hint'; readonly level: 1 | 2 | 3 }
  | { readonly kind: 'solved' };

export interface ExerciseUIState {
  readonly core: ExerciseState;
  /** Current hint highlight, if any (cleared by a move/toggle/submit/undo). */
  readonly hint: Hint | null;
  readonly feedback: ExerciseFeedback;
  /** Squares wrongly selected in the last submission (select-squares only); orange, never red. */
  readonly wrongSquares: readonly Square[];
  /** The last played kid move, for the board's slide animation (collect-stars / capture only). */
  readonly lastMove?: { readonly from: Square; readonly to: Square };
}

export type ExerciseAction =
  | { readonly type: 'move'; readonly move: MoveInput }
  | { readonly type: 'tap-first' }
  | { readonly type: 'toggle'; readonly square: Square }
  | { readonly type: 'submit' }
  | { readonly type: 'hint' }
  /** Guided tries pre-show hint level 1 on mount; unlike 'hint', this leaves feedback untouched. */
  | { readonly type: 'auto-hint' }
  | { readonly type: 'undo' };

/** Fresh reducer state for a newly-started exercise (guided or scored). */
export function initExerciseState(def: ExerciseDef): ExerciseUIState {
  return {
    core: startExercise(def),
    hint: null,
    feedback: { kind: 'instruction' },
    wrongSquares: [],
  };
}

/** Builds the reducer bound to `rules` (stable for the app's lifetime; never changes mid-exercise). */
export function createExerciseReducer(
  rules: VariantRules,
): (state: ExerciseUIState, action: ExerciseAction) => ExerciseUIState {
  return function exerciseReducer(state, action) {
    switch (action.type) {
      case 'move': {
        const { state: core, outcome } = playMove(state.core, rules, action.move);
        if (outcome.kind === 'illegal') {
          return { ...state, core, hint: null, feedback: { kind: 'illegal' }, wrongSquares: [] };
        }
        return {
          ...state,
          core,
          hint: null,
          feedback: outcome.kind === 'solved' ? { kind: 'solved' } : { kind: 'instruction' },
          wrongSquares: [],
          lastMove: { from: outcome.move.from, to: outcome.move.to },
        };
      }
      case 'tap-first':
        return { ...state, feedback: { kind: 'tap-first' } };
      case 'toggle':
        return {
          ...state,
          core: toggleSquare(state.core, action.square),
          feedback: { kind: 'instruction' },
          wrongSquares: [],
        };
      case 'submit': {
        const { state: core, result } = submitSelection(state.core, rules);
        if (result.correct) {
          return { ...state, core, hint: null, feedback: { kind: 'solved' }, wrongSquares: [] };
        }
        const onlyMissing = result.wrong.length === 0 && result.missing > 0;
        return {
          ...state,
          core,
          feedback: { kind: onlyMissing ? 'select-missing' : 'select-wrong' },
          wrongSquares: onlyMissing ? [] : result.wrong,
        };
      }
      case 'hint': {
        const { state: core, hint } = requestHint(state.core, rules);
        return {
          ...state,
          core,
          hint,
          feedback: { kind: 'hint', level: hint.level },
          wrongSquares: [],
        };
      }
      case 'auto-hint': {
        const { state: core, hint } = requestHint(state.core, rules);
        return { ...state, core, hint };
      }
      case 'undo':
        return {
          ...state,
          core: undo(state.core),
          hint: null,
          feedback: { kind: 'instruction' },
          wrongSquares: [],
          lastMove: undefined,
        };
    }
  };
}

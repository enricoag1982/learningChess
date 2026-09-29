import type { Square } from '../../core/chess/types.ts';
import { errorHintStars } from '@learn/platform-core/domain/exercise/stars';
import type { ChessKind } from '../index.ts';
import { initState } from '../../core/exercise/state.ts';
import type { SelectSquaresDef } from '../../core/exercise/types.ts';
import { selectSquaresHint, submitSelection, toggleSquare } from './engine.ts';

export interface SelectionResult {
  readonly correct: boolean;
  readonly missing: number;
  /** Answer squares not selected (shown as "still missing" after a wrong check). */
  readonly missingSquares: readonly Square[];
  readonly wrong: readonly Square[];
}

export interface ToggleAction {
  readonly type: 'toggle';
  readonly square: Square;
}

export interface SubmitAction {
  readonly type: 'submit';
}

export type SelectSquaresAction = ToggleAction | SubmitAction;

export type SelectOutcome =
  { readonly kind: 'toggled' } | { readonly kind: 'checked'; readonly result: SelectionResult };

export const selectSquaresKind: ChessKind<SelectSquaresDef, SelectSquaresAction, SelectOutcome> = {
  type: 'select-squares',
  input: 'select',

  init(def) {
    return initState(def);
  },

  act(state, action, ctx) {
    if (action.type === 'toggle') {
      return { state: toggleSquare(state, action.square), outcome: { kind: 'toggled' } };
    }
    const submitted = submitSelection(state, ctx);
    return { state: submitted.state, outcome: { kind: 'checked', result: submitted.result } };
  },

  hint(state, level, ctx) {
    const bumped = { ...state, hintLevel: level };
    return { state: bumped, hint: selectSquaresHint(bumped, bumped.def, ctx, level) };
  },

  stars(state) {
    return errorHintStars(state.hintLevel, state.errors);
  },
};

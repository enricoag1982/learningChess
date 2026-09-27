import type { Square } from '../../../chess/types.ts';
import { errorHintStars } from '../../stars.ts';
import { narrowState, widen } from '../adapt.ts';
import type { ChessKind } from '../index.ts';
import { initState } from '../../state.ts';
import type { SelectSquaresDef } from '../../types.ts';
import { selectSquaresHint, submitSelection, toggleSquare } from './engine.ts';

export type { SelectSquaresDef } from '../../types.ts';

/** Result of a select-squares submission. */
export interface SelectionResult {
  readonly correct: boolean;
  /** Count of answer squares not selected. */
  readonly missing: number;
  /** Answer squares not selected (shown as "still missing" after a wrong check). */
  readonly missingSquares: readonly Square[];
  /** Selected squares that are not part of the answer. */
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

/** Result of a select-squares action. */
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
      return {
        state: narrowState(toggleSquare(widen(state), action.square)),
        outcome: { kind: 'toggled' },
      };
    }
    const submitted = submitSelection(widen(state), ctx);
    return {
      state: narrowState(submitted.state),
      outcome: { kind: 'checked', result: submitted.result },
    };
  },

  hint(state, level, ctx) {
    const bumped = { ...state, hintLevel: level };
    return { state: bumped, hint: selectSquaresHint(widen(bumped), bumped.def, ctx, level) };
  },

  stars(state) {
    return errorHintStars(state.hintLevel, state.errors);
  },
};

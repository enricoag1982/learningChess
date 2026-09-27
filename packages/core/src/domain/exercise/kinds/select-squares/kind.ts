import { errorHintStars } from '../../stars.ts';
import { narrowState, widen } from '../adapt.ts';
import type { ChessKind } from '../index.ts';
import { initState } from '../../state.ts';
import type { SelectOutcome, SelectSquaresAction, SelectSquaresDef } from './def.ts';
import { selectSquaresHint, submitSelection, toggleSquare } from './engine.ts';

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

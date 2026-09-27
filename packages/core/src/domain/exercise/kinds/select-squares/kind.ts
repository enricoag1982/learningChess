import { startExercise, submitSelection, toggleSquare } from '../../engine.ts';
import { delegateHint, delegateStars, narrowState, widen } from '../adapt.ts';
import type { ChessKind } from '../index.ts';
import type { SelectOutcome, SelectSquaresAction, SelectSquaresDef } from './def.ts';
import { selectSquaresSolution, selectSquaresWrongAction } from './solution.ts';

export const selectSquaresKind: ChessKind<SelectSquaresDef, SelectSquaresAction, SelectOutcome> = {
  type: 'select-squares',
  input: 'select',

  init(def) {
    return narrowState(startExercise(def));
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
    return delegateHint(state, ctx);
  },

  stars(state) {
    return delegateStars(state);
  },

  solution(def, ctx) {
    return selectSquaresSolution(def, ctx);
  },

  wrongAction() {
    return selectSquaresWrongAction();
  },
};

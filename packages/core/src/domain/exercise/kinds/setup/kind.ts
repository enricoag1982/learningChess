import { narrowState, narrowStep, widen } from '../adapt.ts';
import type { ChessKind } from '../index.ts';
import { initState } from '../../state.ts';
import type { PlaceAction, PlaceOutcome, SetupDef } from './def.ts';
import { placePiece, setupHint, setupStars } from './engine.ts';

export const setupKind: ChessKind<SetupDef, PlaceAction, PlaceOutcome> = {
  type: 'setup',
  input: 'place',

  init(def) {
    return initState(def);
  },

  act(state, action) {
    return narrowStep(placePiece(widen(state), action.square, action.piece));
  },

  hint(state, level) {
    const bumped = { ...state, hintLevel: level };
    const result = setupHint(widen(bumped), bumped.def, level);
    return { state: narrowState(result.state), hint: result.hint };
  },

  stars(state) {
    return setupStars(state.hintLevel, state.errors);
  },
};

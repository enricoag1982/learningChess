import { startExercise } from '../../engine.ts';
import { narrowState, narrowStep, widen } from '../adapt.ts';
import type { ChessKind } from '../index.ts';
import type { PlaceAction, PlaceOutcome, SetupDef } from './def.ts';
import { placePiece, setupHint, setupStars } from './engine.ts';
import { setupSolution, setupWrongAction } from './solution.ts';

export const setupKind: ChessKind<SetupDef, PlaceAction, PlaceOutcome> = {
  type: 'setup',
  input: 'place',

  init(def) {
    return narrowState(startExercise(def));
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

  solution(def) {
    return setupSolution(def);
  },

  wrongAction(def) {
    return setupWrongAction(def);
  },
};

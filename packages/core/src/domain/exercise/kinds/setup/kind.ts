import { placePiece, startExercise } from '../../engine.ts';
import { delegateHint, delegateStars, narrowState, narrowStep, widen } from '../adapt.ts';
import type { ChessKind } from '../index.ts';
import type { PlaceAction, PlaceOutcome, SetupDef } from './def.ts';
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

  hint(state, level, ctx) {
    return delegateHint(state, ctx);
  },

  stars(state) {
    return delegateStars(state);
  },

  solution(def) {
    return setupSolution(def);
  },

  wrongAction(def) {
    return setupWrongAction(def);
  },
};

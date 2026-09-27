import { startExercise } from '../../engine.ts';
import { narrowState, narrowStep, widen } from '../adapt.ts';
import type { ChessKind } from '../index.ts';
import { moveCountStars, moveHint, playMove } from '../static-move.ts';
import type { CaptureDef, MoveAction, MoveOutcome } from './def.ts';
import { captureSolution, captureWrongAction } from './solution.ts';

export const captureKind: ChessKind<CaptureDef, MoveAction, MoveOutcome> = {
  type: 'capture',
  input: 'static-move',

  init(def) {
    return narrowState(startExercise(def));
  },

  act(state, action, ctx) {
    return narrowStep(playMove(widen(state), ctx, action.move));
  },

  hint(state, level, ctx) {
    const bumped = { ...state, hintLevel: level };
    return { state: bumped, hint: moveHint(widen(bumped), ctx, level) };
  },

  stars(state) {
    return moveCountStars(state.moves, state.def.stars3, state.def.stars2, state.hintLevel);
  },

  solution(def, ctx) {
    return captureSolution(def, ctx);
  },

  wrongAction(def) {
    return captureWrongAction(def);
  },
};

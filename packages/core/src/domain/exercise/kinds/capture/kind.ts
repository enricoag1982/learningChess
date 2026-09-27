import { playMove, startExercise } from '../../engine.ts';
import { delegateHint, delegateStars, narrowState, narrowStep, widen } from '../adapt.ts';
import type { ChessKind } from '../index.ts';
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
    return delegateHint(state, ctx);
  },

  stars(state) {
    return delegateStars(state);
  },

  solution(def, ctx) {
    return captureSolution(def, ctx);
  },

  wrongAction(def) {
    return captureWrongAction(def);
  },
};

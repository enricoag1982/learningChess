import { playMove, startExercise } from '../../engine.ts';
import { delegateHint, delegateStars, narrowState, narrowStep, widen } from '../adapt.ts';
import type { ChessKind } from '../index.ts';
import type { BestMoveDef, MoveAction, MoveOutcome } from './def.ts';
import { bestMoveSolution, bestMoveWrongAction } from './solution.ts';

export const bestMoveKind: ChessKind<BestMoveDef, MoveAction, MoveOutcome> = {
  type: 'best-move',
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

  solution(def) {
    return bestMoveSolution(def);
  },

  wrongAction(def) {
    return bestMoveWrongAction(def);
  },
};

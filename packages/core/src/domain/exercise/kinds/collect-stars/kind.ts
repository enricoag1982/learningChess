import { playMove, startExercise } from '../../engine.ts';
import { delegateHint, delegateStars, narrowState, narrowStep, widen } from '../adapt.ts';
import type { ChessKind } from '../index.ts';
import type { CollectStarsDef, MoveAction, MoveOutcome } from './def.ts';
import { collectStarsSolution, collectStarsWrongAction } from './solution.ts';

export const collectStarsKind: ChessKind<CollectStarsDef, MoveAction, MoveOutcome> = {
  type: 'collect-stars',
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
    return collectStarsSolution(def, ctx);
  },

  wrongAction(def) {
    return collectStarsWrongAction(def);
  },
};

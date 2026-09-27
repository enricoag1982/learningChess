import { playMateInN, startExercise } from '../../engine.ts';
import { delegateHint, delegateStars, narrowState, narrowStep, widen } from '../adapt.ts';
import type { ChessKind } from '../index.ts';
import type { MateInNDef, MateInNOutcome, MoveAction } from './def.ts';
import { mateInNSolution, mateInNWrongAction } from './solution.ts';

export const mateInNKind: ChessKind<MateInNDef, MoveAction, MateInNOutcome> = {
  type: 'mate-in-n',
  input: 'real-move',

  init(def) {
    return narrowState(startExercise(def));
  },

  act(state, action, ctx) {
    return narrowStep(playMateInN(widen(state), ctx.chess, action.move));
  },

  hint(state, level, ctx) {
    return delegateHint(state, ctx);
  },

  stars(state) {
    return delegateStars(state);
  },

  solution(def, ctx) {
    return mateInNSolution(def, ctx);
  },

  wrongAction(def) {
    return mateInNWrongAction(def);
  },
};

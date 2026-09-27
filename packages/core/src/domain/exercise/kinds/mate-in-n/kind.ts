import { startExercise } from '../../engine.ts';
import { errorHintStars } from '../../stars.ts';
import { narrowState, narrowStep, widen } from '../adapt.ts';
import type { ChessKind } from '../index.ts';
import type { MateInNDef, MateInNOutcome, MoveAction } from './def.ts';
import { mateInNHint, playMateInN } from './engine.ts';
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
    const bumped = { ...state, hintLevel: level };
    return { state: bumped, hint: mateInNHint(widen(state), bumped.def, ctx, level) };
  },

  stars(state) {
    return errorHintStars(state.hintLevel, state.errors);
  },

  solution(def, ctx) {
    return mateInNSolution(def, ctx);
  },

  wrongAction(def) {
    return mateInNWrongAction(def);
  },
};

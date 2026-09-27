import { errorHintStars } from '../../stars.ts';
import { narrowStep, widen } from '../adapt.ts';
import type { ChessKind } from '../index.ts';
import { initState } from '../../state.ts';
import type { MateInNDef, MateInNOutcome, MoveAction } from './def.ts';
import { mateInNHint, playMateInN } from './engine.ts';

export const mateInNKind: ChessKind<MateInNDef, MoveAction, MateInNOutcome> = {
  type: 'mate-in-n',
  input: 'real-move',

  init(def) {
    return initState(def);
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
};

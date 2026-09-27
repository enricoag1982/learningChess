import { errorHintStars } from '../../stars.ts';
import { narrowStep, widen } from '../adapt.ts';
import type { ChessKind } from '../index.ts';
import { playMove } from '../static-move.ts';
import { initState } from '../../state.ts';
import type { MoveAction } from '../base.ts';
import type { BestMoveDef } from '../../types.ts';
import type { MoveOutcome } from '../static-move.ts';
import { bestMoveHint } from './engine.ts';

export type { BestMoveDef } from '../../types.ts';
export type { MoveOutcome } from '../static-move.ts';
export type { MoveAction } from '../base.ts';

export const bestMoveKind: ChessKind<BestMoveDef, MoveAction, MoveOutcome> = {
  type: 'best-move',
  input: 'static-move',

  init(def) {
    return initState(def);
  },

  act(state, action, ctx) {
    return narrowStep(playMove(widen(state), ctx, action.move));
  },

  hint(state, level, ctx) {
    const bumped = { ...state, hintLevel: level };
    return { state: bumped, hint: bestMoveHint(bumped.def, bumped.position, ctx, level) };
  },

  stars(state) {
    return errorHintStars(state.hintLevel, state.errors);
  },
};

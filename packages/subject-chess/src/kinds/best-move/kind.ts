import { errorHintStars } from '@learn/platform-core/domain/exercise/stars';
import type { ChessKind } from '../index.ts';
import { playMove } from '../static-move.ts';
import { initState } from '../../core/exercise/state.ts';
import type { MoveAction } from '../base.ts';
import type { BestMoveDef } from '../../core/exercise/types.ts';
import type { MoveOutcome } from '../static-move.ts';
import { bestMoveHint } from './engine.ts';

export const bestMoveKind: ChessKind<BestMoveDef, MoveAction, MoveOutcome> = {
  type: 'best-move',
  input: 'static-move',

  init(def) {
    return initState(def);
  },

  act(state, action, ctx) {
    return playMove(state, ctx, action.move);
  },

  hint(state, level, ctx) {
    const bumped = { ...state, hintLevel: level };
    return { state: bumped, hint: bestMoveHint(bumped.def, bumped.position, ctx, level) };
  },

  stars(state) {
    return errorHintStars(state.hintLevel, state.errors);
  },
};

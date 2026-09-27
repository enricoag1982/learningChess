import { narrowState, narrowStep, widen } from '../adapt.ts';
import type { ChessKind } from '../index.ts';
import { moveCountStars, moveHint, playMove, undo } from '../static-move.ts';
import { initState } from '../../state.ts';
import type { MoveAction } from '../base.ts';
import type { CaptureDef } from '../../types.ts';
import type { MoveOutcome, UndoAction, UndoOutcome } from '../static-move.ts';

export type { CaptureDef } from '../../types.ts';
export type { MoveOutcome } from '../static-move.ts';
export type { MoveAction } from '../base.ts';

export const captureKind: ChessKind<
  CaptureDef,
  MoveAction | UndoAction,
  MoveOutcome | UndoOutcome
> = {
  type: 'capture',
  input: 'static-move',

  init(def) {
    return initState(def);
  },

  act(state, action, ctx) {
    if (action.type === 'undo') {
      return { state: narrowState(undo(widen(state))), outcome: { kind: 'undone' } };
    }
    return narrowStep(playMove(widen(state), ctx, action.move));
  },

  hint(state, level, ctx) {
    const bumped = { ...state, hintLevel: level };
    return { state: bumped, hint: moveHint(widen(bumped), ctx, level) };
  },

  stars(state) {
    return moveCountStars(state.moves, state.def.stars3, state.def.stars2, state.hintLevel);
  },
};

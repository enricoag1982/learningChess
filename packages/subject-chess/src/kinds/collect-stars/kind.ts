import type { ChessKind } from '../index.ts';
import { moveCountStars, moveHint, playMove, undo } from '../static-move.ts';
import { initState } from '../../core/exercise/state.ts';
import type { MoveAction } from '../base.ts';
import type { CollectStarsDef } from '../../core/exercise/types.ts';
import type { MoveOutcome, UndoAction, UndoOutcome } from '../static-move.ts';

export const collectStarsKind: ChessKind<
  CollectStarsDef,
  MoveAction | UndoAction,
  MoveOutcome | UndoOutcome
> = {
  type: 'collect-stars',
  input: 'static-move',

  init(def) {
    return initState(def);
  },

  act(state, action, ctx) {
    if (action.type === 'undo') {
      return { state: undo(state), outcome: { kind: 'undone' } };
    }
    return playMove(state, ctx, action.move);
  },

  hint(state, level, ctx) {
    const bumped = { ...state, hintLevel: level };
    return { state: bumped, hint: moveHint(bumped, ctx, level) };
  },

  stars(state) {
    return moveCountStars(state.moves, state.def.stars3, state.def.stars2, state.hintLevel);
  },
};

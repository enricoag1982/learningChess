import type { Move } from '../../core/chess/rules.ts';
import { errorHintStars } from '@learn/platform-core/domain/exercise/stars';
import type { ChessKind } from '../index.ts';
import { initState } from '../../core/exercise/state.ts';
import type { MoveAction } from '../base.ts';
import type { MateInNDef } from '../../core/exercise/types.ts';
import { mateInNHint, playMateInN } from './engine.ts';

export type MateInNOutcome =
  | { readonly kind: 'illegal' }
  /** A legal move that neither mates nor matches the scripted line for this ply. Position unchanged. */
  | { readonly kind: 'wrong'; readonly move: Move }
  /** The scripted kid move was played and its scripted opponent reply was applied too. */
  | { readonly kind: 'moved'; readonly move: Move; readonly reply: Move }
  /** Delivered checkmate — any mating move, not only the scripted one. */
  | { readonly kind: 'solved'; readonly move: Move };

export const mateInNKind: ChessKind<MateInNDef, MoveAction, MateInNOutcome> = {
  type: 'mate-in-n',
  input: 'real-move',

  init(def) {
    return initState(def);
  },

  act(state, action, ctx) {
    return playMateInN(state, ctx.chess, action.move);
  },

  hint(state, level, ctx) {
    const bumped = { ...state, hintLevel: level };
    return { state: bumped, hint: mateInNHint(state, bumped.def, ctx, level) };
  },

  stars(state) {
    return errorHintStars(state.hintLevel, state.errors);
  },
};

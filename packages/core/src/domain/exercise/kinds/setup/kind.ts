import type { Color, Piece, PieceType, Square } from '../../../chess/types.ts';
import type { ChessKind } from '../index.ts';
import { initState } from '../../state.ts';
import type { SetupDef } from '../../types.ts';
import { placePiece, setupHint, setupStars } from './engine.ts';

export type { SetupDef } from '../../types.ts';

export interface PlaceAction {
  readonly type: 'place';
  readonly square: Square;
  readonly piece: Piece;
}

/** Result of a `setup` placement attempt. */
export interface PlaceOutcome {
  readonly kind: 'placed' | 'wrong' | 'solved';
  readonly square: Square;
  readonly piece: Piece;
}

/** One remaining piece in a `setup` exercise's palette. */
export interface PalettePiece {
  readonly color: Color;
  readonly type: PieceType;
  readonly count: number;
}

export const setupKind: ChessKind<SetupDef, PlaceAction, PlaceOutcome> = {
  type: 'setup',
  input: 'place',

  init(def) {
    return initState(def);
  },

  act(state, action) {
    return placePiece(state, action.square, action.piece);
  },

  hint(state, level) {
    const bumped = { ...state, hintLevel: level };
    const result = setupHint(bumped, bumped.def, level);
    return { state: result.state, hint: result.hint };
  },

  stars(state) {
    return setupStars(state.hintLevel, state.errors);
  },
};

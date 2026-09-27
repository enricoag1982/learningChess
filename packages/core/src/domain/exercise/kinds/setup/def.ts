import type { Color, Piece, PieceType, Square } from '../../../chess/types.ts';

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

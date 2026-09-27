import type { Piece, Square } from '../../../chess/types.ts';
import type { PlaceOutcome } from '../../engine.ts';

export type { SetupDef } from '../../types.ts';
export type { PlaceOutcome };

export interface PlaceAction {
  readonly type: 'place';
  readonly square: Square;
  readonly piece: Piece;
}

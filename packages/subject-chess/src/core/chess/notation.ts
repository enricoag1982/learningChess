import type { Piece, Square } from './types.ts';
import { SQUARES } from './types.ts';

/** FEN / diagram letter → piece (upper case = white). */
export const PIECE_BY_LETTER: Readonly<Record<string, Piece>> = {
  K: { color: 'w', type: 'k' },
  Q: { color: 'w', type: 'q' },
  R: { color: 'w', type: 'r' },
  B: { color: 'w', type: 'b' },
  N: { color: 'w', type: 'n' },
  P: { color: 'w', type: 'p' },
  k: { color: 'b', type: 'k' },
  q: { color: 'b', type: 'q' },
  r: { color: 'b', type: 'r' },
  b: { color: 'b', type: 'b' },
  n: { color: 'b', type: 'n' },
  p: { color: 'b', type: 'p' },
};

/** FEN / diagram letter of a piece. */
export function pieceLetter(piece: Piece): string {
  return piece.color === 'w' ? piece.type.toUpperCase() : piece.type;
}

/** Square at 0-based row (0 = rank 8) and column (0 = file a). */
export function squareAt(row: number, col: number): Square {
  const square = SQUARES[row * 8 + col];
  if (square === undefined) {
    throw new RangeError(`no square at row ${String(row)}, column ${String(col)}`);
  }
  return square;
}

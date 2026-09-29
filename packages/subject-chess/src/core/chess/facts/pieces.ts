import { SQUARES } from '../types.ts';
import type { Color, Position, Square } from '../types.ts';

export function piecesEqual(a: Position['pieces'], b: Position['pieces']): boolean {
  const aEntries = Object.entries(a);
  const bEntries = Object.entries(b);
  if (aEntries.length !== bEntries.length) {
    return false;
  }
  return aEntries.every(([square, piece]) => {
    const other = b[square as Square];
    return other !== undefined && other.color === piece.color && other.type === piece.type;
  });
}

export function hasKing(position: Position, color: Color): boolean {
  return Object.values(position.pieces).some(
    (piece) => piece.type === 'k' && piece.color === color,
  );
}

export function hasPieceOf(position: Position, color: Color): boolean {
  return Object.values(position.pieces).some((piece) => piece.color === color);
}

export function kingSquare(position: Position, color: Color): Square | undefined {
  return SQUARES.find((square) => {
    const piece = position.pieces[square];
    return piece !== undefined && piece.type === 'k' && piece.color === color;
  });
}

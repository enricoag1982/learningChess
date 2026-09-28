import { CHARACTER_PIECES, type PieceType } from '@learn/subject-chess';

/** Piece type for a lesson character, or `null` for one that doesn't stand for a single piece (Owl: World 1 is about the board itself, not one piece). */
export function characterPieceOrNull(character: string): PieceType | null {
  return CHARACTER_PIECES[character] ?? null;
}

/** Piece type for a lesson character; defaults to rook where none is mapped. */
export function characterPiece(character: string): PieceType {
  return characterPieceOrNull(character) ?? 'r';
}

/** Reverse of `CHARACTER_PIECES`: the animal character a given piece type is taught as
 * (docs/app-structure.md §8), for the board's "animal badge" piece look. */
const PIECE_CHARACTER: Readonly<Record<PieceType, string>> = {
  r: 'rhino',
  b: 'elephant',
  q: 'lioness',
  k: 'lion',
  n: 'horse',
  p: 'caterpillar',
};

/** The animal character a piece type is taught as. */
export function characterForPiece(type: PieceType): string {
  return PIECE_CHARACTER[type];
}

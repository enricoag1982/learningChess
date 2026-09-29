import { CHARACTER_PIECES } from '../../../core/chess-core.ts';
import type { PieceType } from '../../../core/chess/types.ts';

/** Piece type for a lesson character, or `null` for one that is not a single piece (Owl: World 1 is about the board). */
export function characterPieceOrNull(character: string): PieceType | null {
  return CHARACTER_PIECES[character] ?? null;
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

export function characterForPiece(type: PieceType): string {
  return PIECE_CHARACTER[type];
}

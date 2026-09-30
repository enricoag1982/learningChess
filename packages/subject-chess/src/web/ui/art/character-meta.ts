import { CHARACTER_PIECES } from '../../../core/chess-core.ts';
import type { PieceType } from '../../../core/chess/types.ts';

/** Piece type for a lesson character, or `null` for one that is not a single piece (Owl: World 1 is about the board). */
export function characterPieceOrNull(character: string): PieceType | null {
  return CHARACTER_PIECES[character] ?? null;
}

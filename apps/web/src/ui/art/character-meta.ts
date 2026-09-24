import type { PieceType } from '@chess-kids/core';

/** Maps a lesson's `character` id (docs/app-structure.md §8) to the piece it stands for. */
const CHARACTER_PIECE: Readonly<Record<string, PieceType>> = {
  rhino: 'r',
  elephant: 'b',
  lioness: 'q',
  lion: 'k',
  horse: 'n',
  caterpillar: 'p',
};

/** Piece type for a lesson character; defaults to rook (M1 only ships the Rook lesson). */
export function characterPiece(character: string): PieceType {
  return CHARACTER_PIECE[character] ?? 'r';
}

/** Pastel badge colour per character, echoing its habitat in the sketches. */
const CHARACTER_COLOR: Readonly<Record<string, string>> = {
  rhino: '#DCE3D9',
  elephant: '#DCE3EA',
  lioness: '#FBE3D2',
  lion: '#FBEFD3',
  horse: '#F1E4C8',
  caterpillar: '#DCEFE3',
};

/** Background colour for a character's round badge/avatar. */
export function characterColor(character: string): string {
  return CHARACTER_COLOR[character] ?? '#E9DFF3';
}

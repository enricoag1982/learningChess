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

/** Piece type for a lesson character, or `null` for one that doesn't stand for a single piece (Owl: World 1 is about the board itself, not one piece). */
export function characterPieceOrNull(character: string): PieceType | null {
  return CHARACTER_PIECE[character] ?? null;
}

/** Piece type for a lesson character; defaults to rook where none is mapped. */
export function characterPiece(character: string): PieceType {
  return characterPieceOrNull(character) ?? 'r';
}

/** Reverse of `CHARACTER_PIECE`: the animal character a given piece type is taught as
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

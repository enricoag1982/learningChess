/** White or black. */
export type Color = 'w' | 'b';

/** Piece kind, FEN letters lower-cased. */
export type PieceType = 'k' | 'q' | 'r' | 'b' | 'n' | 'p';

export type File = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h';
export type Rank = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';
export type Square = `${File}${Rank}`;

export interface Piece {
  readonly color: Color;
  readonly type: PieceType;
}

/** Non-standard squares used by lessons and mini-games. */
export interface Markers {
  readonly stars: readonly Square[];
  readonly blocked: readonly Square[];
}

/** Plain, JSON-serialisable position. No move clocks: game-level draws come from move history. */
export interface Position {
  readonly pieces: Readonly<Partial<Record<Square, Piece>>>;
  readonly markers: Markers;
  readonly toMove: Color;
  /** FEN castling field: subset of `KQkq` in that order, or `-`. */
  readonly castling: string;
  readonly enPassant: Square | null;
}

const FILES: readonly File[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS: readonly Rank[] = ['8', '7', '6', '5', '4', '3', '2', '1'];

/** All 64 squares in board reading order: a8, b8 … h8, a7 … h1. */
export const SQUARES: readonly Square[] = RANKS.flatMap((rank) =>
  FILES.map((file) => `${file}${rank}` as const),
);

const FILE_SET: ReadonlySet<string> = new Set(FILES);
const RANK_SET: ReadonlySet<string> = new Set(RANKS);

/** True when `value` is a valid algebraic square (e.g. `e4`). */
export function isSquare(value: string): value is Square {
  return value.length === 2 && FILE_SET.has(value[0] ?? '') && RANK_SET.has(value[1] ?? '');
}

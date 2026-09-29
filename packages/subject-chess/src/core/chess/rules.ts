import type { Color, Piece, PieceType, Position, Square } from './types.ts';

export interface Move {
  readonly from: Square;
  readonly to: Square;
  readonly san: string;
  readonly color: Color;
  readonly piece: PieceType;
  readonly captured?: PieceType;
  readonly promotion?: PieceType;
}

/** SAN string (e.g. `Nf3`, `e8=Q`) or from/to squares. */
export type MoveInput =
  string | { readonly from: Square; readonly to: Square; readonly promotion?: PieceType };

export interface PositionStatus {
  readonly check: boolean;
  readonly checkmate: boolean;
  readonly stalemate: boolean;
  readonly insufficientMaterial: boolean;
}

/** Thrown for a `Position` that cannot represent a legal chess position (e.g. two white kings). */
export class InvalidPositionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPositionError';
  }
}

/** One board, built once from a `Position` and mutated in place via `play`/`undo` — rebuilding a
 * fresh chess.js instance per node is too slow for engines (bots, perft) walking thousands of them. */
export interface SearchBoard {
  moves(): Move[];
  play(move: Move): void;
  undo(): void;
  turn(): Color;
  inCheck(): boolean;
  pieces(): Partial<Record<Square, Piece>>;
  /** Current position (markers carried over unchanged from the board this was built from). */
  position(): Position;
  /** Cheap Zobrist-style hash, O(1) per `play` / `undo`, for keying a transposition table without a FEN; not cryptographic
   * (collisions astronomically unlikely, as in every engine's TT). */
  hash(): bigint;
}

/** Standard chess rules; variant rules (blocked squares, custom wins) live in a separate layer. */
export interface ChessRules {
  legalMoves(position: Position, from?: Square): Move[];
  /** New position (markers kept) and the played move, or `null` if illegal. */
  play(
    position: Position,
    move: MoveInput,
  ): { readonly position: Position; readonly move: Move } | null;
  status(position: Position): PositionStatus;
  attackers(position: Position, square: Square, by: Color): Square[];
  searchBoard(position: Position): SearchBoard;
}

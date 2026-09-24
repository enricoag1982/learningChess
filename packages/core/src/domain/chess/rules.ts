import type { Color, Piece, PieceType, Position, Square } from './types.ts';

/** A played or candidate move. */
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

/**
 * One board, built once from a `Position` and mutated in place via `play`/`undo`. For engines
 * (bots, perft) that walk thousands of positions per move: rebuilding a fresh chess.js instance
 * from FEN for every node is too slow, so this reuses a single instance instead. Same kingless
 * handling as `ChessRules` (a missing king skips validation); walls and the static-opponent
 * variant are lesson-only and have no place here.
 */
export interface SearchBoard {
  /** Legal moves for the side to move. */
  moves(): Move[];
  /** Plays a move obtained from `moves()` (or an equivalent legal move) in place. */
  play(move: Move): void;
  /** Undoes the last move played. */
  undo(): void;
  turn(): Color;
  inCheck(): boolean;
  isCheckmate(): boolean;
  isStalemate(): boolean;
  /** Occupied squares only. */
  pieces(): Partial<Record<Square, Piece>>;
  /** Current position (markers carried over unchanged from the board this was built from). */
  position(): Position;
  /**
   * Cheap Zobrist-style hash of the current position (pieces, side to move, castling rights, en
   * passant square) — O(1) per `play`/`undo`, so a search can key a transposition table by it
   * without ever building a FEN. Not a cryptographic hash; collisions are astronomically unlikely
   * but not impossible, same trade-off every chess engine's TT makes.
   */
  hash(): bigint;
}

/** Standard chess rules. Variant rules (blocked squares, custom wins) live in a separate layer (M1). */
export interface ChessRules {
  /** Legal moves for the side to move, optionally only from one square. */
  legalMoves(position: Position, from?: Square): Move[];
  /** New position (markers kept) and the played move, or `null` if illegal. */
  play(
    position: Position,
    move: MoveInput,
  ): { readonly position: Position; readonly move: Move } | null;
  status(position: Position): PositionStatus;
  /** Squares of `by` pieces attacking `square`. */
  attackers(position: Position, square: Square, by: Color): Square[];
  /** One reusable board for fast search (bots, perft); see `SearchBoard`. */
  searchBoard(position: Position): SearchBoard;
}

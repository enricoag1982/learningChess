import type { Color, PieceType, Position, Square } from './types.ts';

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
}

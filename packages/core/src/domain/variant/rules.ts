import type { ChessRules, Move, MoveInput } from '../chess/rules.ts';
import type { Piece, Position, Square } from '../chess/types.ts';

/** Lesson-variant behaviour layered on top of standard chess rules. */
export interface VariantOptions {
  /** Opponent never moves: after each kid move the turn returns to the kid (en passant cleared). */
  readonly staticOpponent: boolean;
}

/** Standard chess rules plus lesson variants (walls, static opponent), driven by `VariantOptions`. */
export interface VariantRules {
  /** Legal moves for the side to move, optionally only from one square. Never crosses or lands on a wall. */
  legalMoves(position: Position, options: VariantOptions, from?: Square): Move[];
  /** New position (markers kept) and the played move, or `null` if illegal. */
  play(
    position: Position,
    options: VariantOptions,
    move: MoveInput,
  ): { readonly position: Position; readonly move: Move } | null;
}

/**
 * Occupies every blocked square with a wall piece of the side to move: sliding pieces cannot land
 * on or pass through it, a knight cannot land on it either, but a knight's jump is otherwise
 * unaffected (knight moves never depend on the squares in between).
 */
function wrapWalls(position: Position): Position {
  const { blocked } = position.markers;
  if (blocked.length === 0) {
    return position;
  }
  const wall: Piece = { color: position.toMove, type: 'n' };
  const pieces: Partial<Record<Square, Piece>> = { ...position.pieces };
  for (const square of blocked) {
    pieces[square] = wall;
  }
  return { ...position, pieces };
}

/** Removes wall pieces so the returned position only ever holds real pieces. Markers stay as-is. */
function stripWalls(position: Position): Position {
  const { blocked } = position.markers;
  if (blocked.length === 0) {
    return position;
  }
  const pieces: Partial<Record<Square, Piece>> = { ...position.pieces };
  for (const square of blocked) {
    Reflect.deleteProperty(pieces, square);
  }
  return { ...position, pieces };
}

/** Builds `VariantRules` on top of a `ChessRules` adapter. */
export function createVariantRules(rules: ChessRules): VariantRules {
  return {
    legalMoves(position, options, from) {
      const moves = rules.legalMoves(wrapWalls(position), from);
      // Drop moves attributed to a wall piece; real pieces never start on a blocked square.
      return moves.filter((move) => !position.markers.blocked.includes(move.from));
    },

    play(position, options, move) {
      const played = rules.play(wrapWalls(position), move);
      if (played === null || position.markers.blocked.includes(played.move.from)) {
        return null;
      }
      const stripped = stripWalls(played.position);
      const result = options.staticOpponent
        ? { ...stripped, toMove: position.toMove, enPassant: null }
        : stripped;
      return { position: result, move: played.move };
    },
  };
}

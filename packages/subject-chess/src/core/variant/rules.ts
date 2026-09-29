import type { ChessRules, Move, MoveInput } from '../chess/rules.ts';
import type { Color, Piece, Position, Square } from '../chess/types.ts';

export interface VariantOptions {
  /** Opponent never moves: after each kid move the turn returns to the kid (en passant cleared). */
  readonly staticOpponent: boolean;
}

export interface VariantRules {
  /** Legal moves for the side to move, optionally only from one square. Never crosses or lands on a wall. */
  legalMoves(position: Position, options: VariantOptions, from?: Square): Move[];
  play(
    position: Position,
    options: VariantOptions,
    move: MoveInput,
  ): { readonly position: Position; readonly move: Move } | null;
  attackers(position: Position, square: Square, by: Color): Square[];
  /** The real chess rules this variant is built on. `mate-in-n` plays under real turn alternation
   * (never walls/static-opponent), so it uses this directly. */
  readonly chess: ChessRules;
}

/** Occupies every blocked square with a wall piece: sliding pieces cannot land on or pass through
 * it; a knight cannot land on it either, but its jump is otherwise unaffected. */
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

export function createVariantRules(rules: ChessRules): VariantRules {
  return {
    chess: rules,

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

    attackers(position, square, by) {
      return rules.attackers(wrapWalls(position), square, by);
    },
  };
}

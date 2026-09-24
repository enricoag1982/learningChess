import type { ChessRules } from '../chess/rules.ts';
import { SQUARES } from '../chess/types.ts';
import type { Color, Position, Square } from '../chess/types.ts';

function opponentOf(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

/** Square holding the `color` king, if any. */
export function kingSquare(position: Position, color: Color): Square | undefined {
  return SQUARES.find((square) => {
    const piece = position.pieces[square];
    return piece !== undefined && piece.type === 'k' && piece.color === color;
  });
}

/**
 * True when `square` is attacked by the opposing side: the occupant's own opponent if `square`
 * holds a piece, else the side not to move (an empty square's "danger" is from the mover's
 * opponent's point of view).
 */
export function isAttacked(position: Position, square: Square, rules: ChessRules): boolean {
  const occupant = position.pieces[square];
  const by = opponentOf(occupant ? occupant.color : position.toMove);
  return rules.attackers(position, square, by).length > 0;
}

/** True when the piece on `square` is defended by another piece of its own colour. `false` if empty. */
export function isDefended(position: Position, square: Square, rules: ChessRules): boolean {
  const occupant = position.pieces[square];
  if (occupant === undefined) return false;
  return rules.attackers(position, square, occupant.color).length > 0;
}

/** True when the piece on `square` is attacked and not defended by its own side. `false` if empty. */
export function isHanging(position: Position, square: Square, rules: ChessRules): boolean {
  const occupant = position.pieces[square];
  if (occupant === undefined) return false;
  return isAttacked(position, square, rules) && !isDefended(position, square, rules);
}

/** True when the side to move is in check. */
export function isInCheck(position: Position, rules: ChessRules): boolean {
  return rules.status(position).check;
}

/** True when the side to move is checkmated. */
export function isCheckmate(position: Position, rules: ChessRules): boolean {
  return rules.status(position).checkmate;
}

/** True when the side to move is stalemated. */
export function isStalemate(position: Position, rules: ChessRules): boolean {
  return rules.status(position).stalemate;
}

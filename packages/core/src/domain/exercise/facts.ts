import type { ChessRules } from '../chess/rules.ts';
import { SQUARES } from '../chess/types.ts';
import type { Color, PieceType, Position, Square } from '../chess/types.ts';

function opponentOf(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

/** Standard piece values (`docs/curriculum.md` World 3 "Piece values"): P1 N3 B3 R5 Q9, king unused. */
const PIECE_VALUE: Readonly<Record<PieceType, number>> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Standard value of a piece type (P1 N3 B3 R5 Q9); `k` has no trade value, reported as `0`. */
export function pieceValue(type: PieceType): number {
  return PIECE_VALUE[type];
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

/**
 * True when the piece on `square` is safe: not attacked by a lower-value enemy piece, and either
 * not attacked at all or defended by its own side. Stricter than `!isHanging`: a piece defended
 * only by lower-value pieces than the attacker is still "safe" there, but one an enemy pawn (say)
 * attacks is never safe even when defended — trading it away would still be a bad trade for its
 * owner (`docs/curriculum.md` World 3 "Safe or not?" / "Trades"). `false` if empty.
 */
export function isSafe(position: Position, square: Square, rules: ChessRules): boolean {
  const occupant = position.pieces[square];
  if (occupant === undefined) return false;
  const attackerSquares = rules.attackers(position, square, opponentOf(occupant.color));
  const lowerValueAttacker = attackerSquares.some((attackerSquare) => {
    const attacker = position.pieces[attackerSquare];
    return attacker !== undefined && pieceValue(attacker.type) < pieceValue(occupant.type);
  });
  if (lowerValueAttacker) return false;
  return attackerSquares.length === 0 || isDefended(position, square, rules);
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

/** True when the position is a dead draw by material (chess.js's own insufficient-material rule). */
export function isInsufficientMaterial(position: Position, rules: ChessRules): boolean {
  return rules.status(position).insufficientMaterial;
}

/** Strips a trailing check/mate mark, matching the SAN comparison used elsewhere (`lesson-load.ts`). */
function stripCheckMark(san: string): string {
  return san.replace(/[+#]+$/, '');
}

/** True when the side to move can castle `side` right now (a legal `O-O` / `O-O-O` move exists). */
export function canCastle(
  position: Position,
  side: 'kingside' | 'queenside',
  rules: ChessRules,
): boolean {
  const target = side === 'kingside' ? 'O-O' : 'O-O-O';
  return rules.legalMoves(position).some((move) => stripCheckMark(move.san) === target);
}

/**
 * True when the side to move has at least one legal en passant capture right now. A pawn move
 * landing on the position's own en passant square is always an en passant capture (that square is
 * otherwise empty — no ordinary pawn move, capture or not, can end there): chess.js only ever
 * generates such a move when the capture is actually legal.
 */
export function canEnPassant(position: Position, rules: ChessRules): boolean {
  if (position.enPassant === null) return false;
  return rules
    .legalMoves(position)
    .some(
      (move) => move.piece === 'p' && move.captured !== undefined && move.to === position.enPassant,
    );
}

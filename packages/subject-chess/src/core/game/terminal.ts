import type { Move } from '../chess/rules.ts';
import type { Color, Piece, PieceType, Square } from '../chess/types.ts';
import type { GameResult, GameRulesDef } from './types.ts';

export interface GameBoardView {
  readonly toMove: Color;
  readonly pieces: Readonly<Partial<Record<Square, Piece>>>;
  readonly legalMoveCount: number;
  readonly inCheck: boolean;
}

function other(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

function countNonKingPieces(pieces: GameBoardView['pieces'], color: Color): number {
  return Object.values(pieces).filter((piece) => piece.color === color && piece.type !== 'k')
    .length;
}

function hasPieceType(pieces: GameBoardView['pieces'], color: Color, type: PieceType): boolean {
  return Object.values(pieces).some((piece) => piece.color === color && piece.type === type);
}

function occupiesAny(
  pieces: GameBoardView['pieces'],
  color: Color,
  squares: readonly Square[],
): boolean {
  return squares.some((square) => pieces[square]?.color === color);
}

/** A side wins the instant its promote/capture-all/capture/reach condition is met — unlike
 * checkmate, these do not wait for a legal-move count or move-limit check. */
function instantWin(
  def: GameRulesDef,
  view: GameBoardView,
  lastMove: Move | undefined,
): { readonly color: Color; readonly reason: string } | null {
  for (const color of ['w', 'b'] as const) {
    for (const condition of def.win[color]) {
      if (condition.kind === 'capture-all' && countNonKingPieces(view.pieces, other(color)) === 0) {
        return { color, reason: 'capture-all' };
      }
      if (
        condition.kind === 'capture' &&
        !hasPieceType(view.pieces, other(color), condition.piece)
      ) {
        return { color, reason: `capture-${condition.piece}` };
      }
      if (condition.kind === 'reach' && occupiesAny(view.pieces, color, condition.squares)) {
        return { color, reason: 'reach' };
      }
      if (
        condition.kind === 'promote' &&
        lastMove?.color === color &&
        lastMove.promotion !== undefined
      ) {
        return { color, reason: 'promote' };
      }
    }
  }
  return null;
}

/** Per-position result: the four "instant" win conditions above, plus checkmate/stalemate/
 * no-legal-moves. Does not know move counts or repetition — `gameResult` layers those on top. */
export function evaluateTerminal(
  def: GameRulesDef,
  view: GameBoardView,
  lastMove: Move | undefined,
): GameResult {
  const instant = instantWin(def, view, lastMove);
  if (instant !== null) {
    return { kind: 'win', winner: instant.color, reason: instant.reason };
  }

  if (view.legalMoveCount === 0) {
    const opponent = other(view.toMove);
    if (def.checkRules) {
      return view.inCheck
        ? { kind: 'win', winner: opponent, reason: 'checkmate' }
        : { kind: 'draw', reason: 'stalemate' };
    }
    return def.noMoves === 'lose'
      ? { kind: 'win', winner: opponent, reason: 'no-moves' }
      : { kind: 'draw', reason: 'no-moves' };
  }

  return { kind: 'ongoing' };
}

import type { Move, SearchBoard } from '../chess/rules.ts';
import type { Color, PieceType, Square } from '../chess/types.ts';
import type { GameBoardView } from '../game/index.ts';
import { evaluateTerminal } from '../game/index.ts';
import type { GameRulesDef, WinCondition } from '../game/index.ts';

/** Piece values in pawns; kings score 0 (checkmate is already covered by the terminal score). */
export const PIECE_VALUE: Readonly<Record<PieceType, number>> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

const CENTER_SQUARES: ReadonlySet<string> = new Set(['d4', 'd5', 'e4', 'e5']);

/** Score above which the search stops looking for a better move; keeps mates further away worse. */
export const WIN_SCORE = 1000;

function backRank(color: Color): string {
  return color === 'w' ? '1' : '8';
}

/** Ranks advanced from the piece's own starting rank (0 for a pawn still on it). */
function pawnAdvance(square: Square, color: Color): number {
  const rank = Number(square[1]);
  return color === 'w' ? rank - 2 : 7 - rank;
}

/**
 * A def needs the (more costly) piece map to test its win conditions only when it declares one of
 * `capture-all` / `capture` / `reach`; checkmate / stalemate / no-moves only need the legal-move
 * count and check flag, and `promote` only needs the last move. Precomputing this once per search
 * lets internal (non-leaf) nodes skip building the piece map entirely for plain chess.
 */
export function needsPiecesForTerminal(def: GameRulesDef): boolean {
  const kinds: ReadonlySet<WinCondition['kind']> = new Set(['capture-all', 'capture', 'reach']);
  return [...def.win.w, ...def.win.b].some((condition) => kinds.has(condition.kind));
}

const NO_PIECES: GameBoardView['pieces'] = {};

/** Builds the view `evaluateTerminal` needs, skipping the piece map when the def does not use it. */
export function boardView(
  board: SearchBoard,
  moves: readonly Move[],
  needsPieces: boolean,
): GameBoardView {
  return {
    toMove: board.turn(),
    pieces: needsPieces ? board.pieces() : NO_PIECES,
    legalMoveCount: moves.length,
    inCheck: board.inCheck(),
  };
}

/**
 * Terminal score from the perspective of `view.toMove`, or `null` when the game is still ongoing.
 * A win scores `WIN_SCORE` minus plies from the root, so a faster win/loss always outranks a
 * slower one of the same kind.
 */
export function terminalScore(
  def: GameRulesDef,
  view: GameBoardView,
  plyFromRoot: number,
  lastMove: Move | undefined,
): number | null {
  const result = evaluateTerminal(def, view, lastMove);
  if (result.kind === 'win') {
    const score = WIN_SCORE - plyFromRoot;
    return result.winner === view.toMove ? score : -score;
  }
  if (result.kind === 'draw') {
    return 0;
  }
  return null;
}

/** Material + small positional bonuses, from the perspective of `view.toMove`. */
export function staticEval(view: GameBoardView, def: GameRulesDef): number {
  let score = 0;
  for (const [squareKey, piece] of Object.entries(view.pieces)) {
    const square = squareKey as Square;
    const sign = piece.color === view.toMove ? 1 : -1;
    score += sign * PIECE_VALUE[piece.type];
    if (piece.type === 'k') {
      continue;
    }
    if (CENTER_SQUARES.has(square)) {
      score += sign * (def.kings ? 0.1 : 0.15);
    }
    if ((piece.type === 'n' || piece.type === 'b') && square[1] !== backRank(piece.color)) {
      score += sign * 0.1;
    }
    if (piece.type === 'p') {
      score += sign * pawnAdvance(square, piece.color) * (def.kings ? 0.02 : 0.05);
    }
  }
  if (def.kings && view.inCheck) {
    score -= 0.5;
  }
  return score;
}

/**
 * Value of the position after `lastMove`, from the perspective of `board.turn()`. Terminal results
 * (via `evaluateTerminal`, the same rules `gameResult` uses) always beat a material score. Always
 * builds the full piece map: used for a one-off "resulting position" value (shallow mode), not in
 * the search's per-node hot loop (see `needsPiecesForTerminal` for that).
 */
export function evaluateBoard(
  board: SearchBoard,
  def: GameRulesDef,
  plyFromRoot: number,
  lastMove: Move | undefined,
  moves: readonly Move[] = board.moves(),
): number {
  const view = boardView(board, moves, true);
  return terminalScore(def, view, plyFromRoot, lastMove) ?? staticEval(view, def);
}

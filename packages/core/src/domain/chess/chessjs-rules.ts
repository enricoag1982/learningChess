// The only module allowed to import chess.js (enforced by eslint.config.js); everything else
// depends on `ChessRules` instead.
import { Chess } from 'chess.js';
import type { Move as ChessJsMove } from 'chess.js';

import { parseFen, toFen } from './fen.ts';
import type { ChessRules, Move, MoveInput } from './rules.ts';
import { InvalidPositionError } from './rules.ts';
import type { Color, Position } from './types.ts';

function hasKing(position: Position, color: Color): boolean {
  return Object.values(position.pieces).some(
    (piece) => piece.type === 'k' && piece.color === color,
  );
}

/**
 * Builds a chess.js instance from a `Position`. Lessons and mini-games may omit either or both
 * kings (lone rook, Pawn Wars, …): those load with `skipValidation` so chess.js accepts them.
 * A position with both kings still goes through chess.js's own FEN validation, so e.g. two white
 * kings is rejected.
 */
function buildChess(position: Position): Chess {
  const fen = toFen(position);
  const missingKing = !hasKing(position, 'w') || !hasKing(position, 'b');
  try {
    return new Chess(fen, { skipValidation: missingKing });
  } catch (error) {
    throw new InvalidPositionError(error instanceof Error ? error.message : String(error));
  }
}

function fromChessJsMove(move: ChessJsMove): Move {
  return {
    from: move.from,
    to: move.to,
    san: move.san,
    color: move.color,
    piece: move.piece,
    ...(move.captured !== undefined ? { captured: move.captured } : {}),
    ...(move.promotion !== undefined ? { promotion: move.promotion } : {}),
  };
}

function toChessJsMove(move: MoveInput): string | { from: string; to: string; promotion?: string } {
  if (typeof move === 'string') {
    return move;
  }
  // chess.js requires an exact promotion match for promotion moves and ignores the field
  // otherwise, so defaulting it here is safe for non-promotion from/to moves too.
  return { from: move.from, to: move.to, promotion: move.promotion ?? 'q' };
}

/** `ChessRules` backed by chess.js. */
export const chessJsRules: ChessRules = {
  legalMoves(position, from) {
    const chess = buildChess(position);
    return chess.moves({ square: from, verbose: true }).map(fromChessJsMove);
  },

  play(position, move) {
    const chess = buildChess(position);
    let played: ChessJsMove;
    try {
      played = chess.move(toChessJsMove(move));
    } catch {
      // chess.js throws on illegal input; that maps to "no move played" here.
      return null;
    }
    const after = parseFen(chess.fen());
    return {
      position: {
        pieces: after.pieces,
        markers: position.markers,
        toMove: after.toMove,
        castling: after.castling,
        enPassant: after.enPassant,
      },
      move: fromChessJsMove(played),
    };
  },

  // Reports chess.js semantics directly. A kingless side that has run out of moves is reported
  // as `stalemate: true` by chess.js; deciding what that means for a mini-game (e.g. a lone rook
  // that has boxed in a lone king) is the variant layer's job (M1), not this adapter's.
  status(position) {
    const chess = buildChess(position);
    return {
      check: chess.inCheck(),
      checkmate: chess.isCheckmate(),
      stalemate: chess.isStalemate(),
      insufficientMaterial: chess.isInsufficientMaterial(),
    };
  },

  attackers(position, square, by) {
    const chess = buildChess(position);
    return chess.attackers(square, by);
  },
};

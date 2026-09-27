// The only module allowed to import chess.js (enforced by eslint.config.js); everything else
// depends on `ChessRules` instead.
import { Chess } from 'chess.js';
import type { Move as ChessJsMove } from 'chess.js';

import { parseFen, toFen } from './fen.ts';
import type { ChessRules, Move, MoveInput, SearchBoard } from './rules.ts';
import { InvalidPositionError } from './rules.ts';
import type { Color, Piece, PieceType, Position, Square } from './types.ts';

function hasKing(position: Position, color: Color): boolean {
  return Object.values(position.pieces).some(
    (piece) => piece.type === 'k' && piece.color === color,
  );
}

/** Builds a chess.js instance from a `Position`. Lessons/mini-games may omit either or both kings
 * (lone rook, Pawn Wars, …): those load with `skipValidation`; a position with both kings still
 * goes through chess.js's own FEN validation (rejects e.g. two white kings). */
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

/** chess.js's private, pre-SAN move shape (0x88 indices). The public `moves()`/`move()` wrap this
 * with full SAN + a checkmate check per move — far too slow per search node (~40x this shape's
 * cost) — so `SearchBoard` reaches into these internals; a chess.js upgrade that renames them
 * fails loudly here (the cast stops matching) rather than silently miscomputing. */
interface InternalMove {
  readonly color: Color;
  readonly from: number;
  readonly to: number;
  readonly piece: PieceType;
  readonly captured?: PieceType;
  readonly promotion?: PieceType;
}

interface FastChess {
  _moves(options: { legal: true }): InternalMove[];
  _makeMove(move: InternalMove): void;
  _undoMove(): void;
  /** chess.js's own incremental Zobrist hash, XOR-updated in `_makeMove`/`_undoMove` — O(1) to
   * read, no recomputation. Same internals trade-off as above; only `hash()` reads this. */
  readonly _hash: bigint;
}

// A separate view of the same instance, not intersected with `Chess`: TypeScript collapses an
// intersection of a class with a redeclared private member (even a same-shaped one) to `never`.
function fast(chess: Chess): FastChess {
  return chess as unknown as FastChess;
}

/** 0x88 index → algebraic square (inverse of chess.js's private `Ox88` table). */
function squareOf(index: number): Square {
  const file = index & 0xf;
  const rank = 8 - (index >> 4);
  return `${String.fromCharCode(97 + file)}${String(rank)}` as Square;
}

/** `SearchBoard`'s move, from the fast internal shape. `san` is a cheap long-algebraic placeholder,
 * not real chess notation: every move returned to a caller comes from `ChessRules` instead. */
function toSearchMove(move: InternalMove): Move {
  const from = squareOf(move.from);
  const to = squareOf(move.to);
  const promotionSuffix = move.promotion === undefined ? '' : `=${move.promotion.toUpperCase()}`;
  return {
    from,
    to,
    san: `${from}${to}${promotionSuffix}`,
    color: move.color,
    piece: move.piece,
    ...(move.captured === undefined ? {} : { captured: move.captured }),
    ...(move.promotion === undefined ? {} : { promotion: move.promotion }),
  };
}

function internalMoveMatches(internal: InternalMove, move: Move): boolean {
  return (
    squareOf(internal.from) === move.from &&
    squareOf(internal.to) === move.to &&
    (internal.promotion ?? null) === (move.promotion ?? null)
  );
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

  // Reports chess.js semantics directly. A kingless side out of moves reports `stalemate: true`;
  // what that means for a mini-game (e.g. a boxed-in lone king) is the variant layer's job.
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

  searchBoard(position) {
    const chess = buildChess(position);
    const fastChess = fast(chess);
    const { markers } = position;
    // Moves this board generated map back to their internal shape, so playing one (the common
    // search case) skips a second `_moves` scan; a move from elsewhere falls back to that scan.
    const internalByMove = new Map<Move, InternalMove>();

    function pieces(): Partial<Record<Square, Piece>> {
      const result: Partial<Record<Square, Piece>> = {};
      for (const row of chess.board()) {
        for (const cell of row) {
          if (cell !== null) {
            result[cell.square] = { color: cell.color, type: cell.type };
          }
        }
      }
      return result;
    }

    const board: SearchBoard = {
      moves() {
        return fastChess._moves({ legal: true }).map((internal) => {
          const move = toSearchMove(internal);
          internalByMove.set(move, internal);
          return move;
        });
      },
      play(move) {
        const internal =
          internalByMove.get(move) ??
          fastChess
            ._moves({ legal: true })
            .find((candidate) => internalMoveMatches(candidate, move));
        if (internal === undefined) {
          throw new Error(`searchBoard: no legal move ${move.from}-${move.to}`);
        }
        fastChess._makeMove(internal);
      },
      undo() {
        fastChess._undoMove();
      },
      turn() {
        return chess.turn();
      },
      inCheck() {
        return chess.inCheck();
      },
      isCheckmate() {
        return chess.isCheckmate();
      },
      isStalemate() {
        return chess.isStalemate();
      },
      pieces,
      hash() {
        return fastChess._hash;
      },
      position() {
        const parsed = parseFen(chess.fen());
        return {
          pieces: pieces(),
          markers,
          toMove: parsed.toMove,
          castling: parsed.castling,
          enPassant: parsed.enPassant,
        };
      },
    };
    return board;
  },
};

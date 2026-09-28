export type { Color, PieceType, File, Rank, Square, Piece, Markers, Position } from './types.ts';
export { SQUARES, isSquare } from './types.ts';

export { parseDiagram, toDiagram, DiagramError } from './diagram.ts';

export { parseFen, toFen, FenError } from './fen.ts';

export { PIECE_BY_LETTER } from './notation.ts';

export type { Move, MoveInput, PositionStatus, ChessRules, SearchBoard } from './rules.ts';
export { InvalidPositionError } from './rules.ts';

export { chessJsRules } from './chessjs-rules.ts';

export type { Goal } from './facts/goals.ts';
export { enemyCount } from './facts/goals.ts';
export { piecesEqual, hasKing, hasPieceOf, kingSquare } from './facts/pieces.ts';
export { normalizeSan, sameSan, findMoveBySan, givesCheck } from './facts/san.ts';
export { castlingMoves, enPassantMoves, doubleStepBefore } from './facts/special-moves.ts';
export type { ReplayedLine, FailedReplay, ReplayResult } from './facts/line.ts';
export { replaySanLine } from './facts/line.ts';
export {
  pieceValue,
  isAttacked,
  isDefended,
  isHanging,
  isSafe,
  isInCheck,
  isCheckmate,
  isStalemate,
  isInsufficientMaterial,
  canCastle,
  canEnPassant,
} from './facts/position.ts';

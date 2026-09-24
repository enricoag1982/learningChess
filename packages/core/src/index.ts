export type * from './domain/profile.ts';
export type { ProfileRepository, Clock, Random, FeatureFlags } from './app/ports.ts';
export { v1FeatureFlags } from './app/ports.ts';

export type {
  Color,
  PieceType,
  File,
  Rank,
  Square,
  Piece,
  Markers,
  Position,
  Move,
  MoveInput,
  PositionStatus,
  ChessRules,
} from './domain/chess/index.ts';
export {
  SQUARES,
  isSquare,
  parseDiagram,
  toDiagram,
  DiagramError,
  parseFen,
  toFen,
  FenError,
  InvalidPositionError,
  chessJsRules,
} from './domain/chess/index.ts';

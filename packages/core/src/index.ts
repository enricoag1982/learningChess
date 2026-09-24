export type * from './domain/profile.ts';
export type {
  DemoHighlight,
  LessonDemo,
  Lesson,
  MiniGame,
  CompiledContent,
} from './domain/lesson.ts';
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

export type { VariantOptions, VariantRules } from './domain/variant/index.ts';
export { createVariantRules } from './domain/variant/index.ts';

export type {
  CollectStarsDef,
  CaptureDef,
  SelectSquaresDef,
  ExerciseDef,
  ExerciseState,
  MoveOutcome,
  SelectionResult,
  Hint,
  SolverMove,
  StaticCaptureGameDef,
  GameState,
  GameOutcome,
} from './domain/exercise/index.ts';
export {
  startExercise,
  exerciseMoves,
  playMove,
  toggleSquare,
  submitSelection,
  undo,
  requestHint,
  starsFor,
  solve,
  optimalMoves,
  startStaticCaptureGame,
  playGameMove,
  gameResult,
  gameStars,
} from './domain/exercise/index.ts';

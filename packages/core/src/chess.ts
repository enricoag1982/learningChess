// Chess-bound exports (`@chess-kids/core/chess`): the subject-chess half of the package, kept out
// of `./index.ts` so platform code cannot reach it. m8.17 moves this file's contents into the
// `subject-chess` package unchanged; see docs/refactor-v4.md §R4.
export type { LocalPlayer } from './app/friend-play.ts';
export { friendGameOptions, friendGamesPlayed, recordLocalMatch } from './app/friend-play.ts';

export type { ComputerLevelCondition, ComputerLevelStatus } from './app/games.ts';
export {
  recordGame,
  loadGameRecords,
  computerLevelStatus,
  suggestedLevel,
  updateSuggestedLevel,
  versusGameRecordResult,
} from './app/games.ts';

export type { BotPlayer } from './app/bot-player.ts';

// Chess's `SubjectCore` + `AppConfig` (design-r4.md §2, C4).
export { chessCore, CHESS_APP_CONFIG, CHESS_CHARACTERS } from './chess-core.ts';

export type {
  Color,
  PieceType,
  File,
  Rank,
  Square,
  Piece,
  Position,
  Move,
  MoveInput,
} from './domain/chess/index.ts';
export {
  SQUARES,
  parseDiagram,
  DiagramError,
  parseFen,
  toFen,
  FenError,
  chessJsRules,
  PIECE_BY_LETTER,
} from './domain/chess/index.ts';

// Chess facts: pure predicates/derivations shared by the exercise engine, solver and content build.
export type { Goal, ReplayedLine, FailedReplay, ReplayResult } from './domain/chess/index.ts';
export {
  enemyCount,
  piecesEqual,
  hasKing,
  hasPieceOf,
  normalizeSan,
  sameSan,
  findMoveBySan,
  givesCheck,
  castlingMoves,
  enPassantMoves,
  doubleStepBefore,
  replaySanLine,
} from './domain/chess/index.ts';

export type { VariantRules } from './domain/variant/index.ts';
export { createVariantRules } from './domain/variant/index.ts';

export type {
  CollectStarsDef,
  CaptureDef,
  SelectSquaresDef,
  YesNoDef,
  ChoiceOption,
  ChoiceDef,
  BestMoveDef,
  SetupDef,
  MateInNDef,
  ExerciseDef,
  ExerciseState,
  PalettePiece,
  Hint,
  GameState,
  VersusState,
  StaticGoalSource,
  ExerciseFeedback,
  ExerciseNoteKind,
  ExerciseNoteCtx,
  ExerciseNote,
  Resolve,
  ModeType,
  MiniGameState,
  MoveOutcome,
  UndoAction,
  UndoOutcome,
} from './domain/exercise/index.ts';
export {
  EXERCISE_NOTES,
  exerciseNote,
  isEasierOfferNote,
  MINI_GAME_MODES,
  modeOf,
} from './domain/exercise/index.ts';

// Exercise-kind registry: the only exercise-type dispatch (`domain/exercise/kinds/index.ts`).
export type {
  ExerciseStateOf,
  ExerciseType,
  DefOf,
  ExerciseAction,
  ChessKind,
  ActionOf,
  OutcomeOf,
  AnyExerciseKind,
  MoveAction,
  AnswerOutcome,
  ToggleAction,
  SubmitAction,
  SelectSquaresAction,
  SelectOutcome,
  AnswerYesNoAction,
  AnswerChoiceAction,
  PlaceAction,
} from './domain/exercise/index.ts';
export { EXERCISE_KINDS, kindOf } from './domain/exercise/index.ts';

export {
  staticGoalExercise,
  startExercise,
  selectSquaresAnswer,
  setupPalette,
  requestHint,
  starsFor,
  solve,
  optimalMoves,
  kingSquare,
  isAttacked,
  isDefended,
  isHanging,
  isSafe,
  pieceValue,
  isInCheck,
  isCheckmate,
  isStalemate,
  isInsufficientMaterial,
  canCastle,
  canEnPassant,
  startStaticCaptureGame,
  playGameMove,
  gameResult,
  gameStars,
  startVersus,
  versusPosition,
  versusEndReason,
  versusGameState,
  isKidTurn,
  kidMoveCount,
  playVersusMove,
  canTakeBack,
  takeBackVersusMove,
  versusStars,
} from './domain/exercise/index.ts';

// Variant game rules and the computer opponent. Namespaced: both reuse names already taken by the
// static-capture mini-game API above (`GameState`, `playGameMove`, `gameResult`).
export * as game from './domain/game/index.ts';
export * as bot from './domain/bot/index.ts';

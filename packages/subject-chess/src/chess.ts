// Chess-bound exports (`@chess-kids/core/chess`): the subject-chess half of the package, kept out
// of `./index.ts` so platform code cannot reach it (docs/refactor-v4.md §R4).
export type { LocalPlayer } from './core/app/friend-play.ts';
export { friendGameOptions, friendGamesPlayed, recordLocalMatch } from './core/app/friend-play.ts';

export type { ComputerLevelCondition, ComputerLevelStatus } from './core/app/games.ts';
export {
  recordGame,
  computerLevelStatus,
  suggestedLevel,
  updateSuggestedLevel,
  versusGameRecordResult,
} from './core/app/games.ts';

export type { BotPlayer } from './core/app/bot-player.ts';

// Chess's `SubjectCore` + `AppConfig`.
export {
  chessCore,
  CHESS_APP_CONFIG,
  CHESS_CHARACTERS,
  CHARACTER_PIECES,
  DEFAULT_PROFILE_SETTINGS,
} from './core/chess-core.ts';

// Chess's own settings-slot fields (`domain/profile-settings.ts`'s `ProfileSettings` carries them
// via module augmentation, loaded transitively through `chess-core.ts` above).
export type { ComputerLevelSetting, PieceStyleSetting } from './core/chess/settings.ts';

// Chess's concrete lesson/mini-game content shapes — the platform's own `Lesson`/`MiniGame`
// (`./index.ts`) at chess's exercise def / demo instantiation.
export type {
  DemoHighlight,
  LessonDemo,
  Lesson,
  StaticMiniGame,
  SeriesMiniGame,
  VersusMiniGame,
  MiniGame,
  CompiledContent,
} from './core/chess/lesson.ts';

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
} from './core/chess/index.ts';
export {
  SQUARES,
  parseDiagram,
  DiagramError,
  parseFen,
  toFen,
  FenError,
  chessJsRules,
  PIECE_BY_LETTER,
} from './core/chess/index.ts';

// Chess facts: pure predicates/derivations shared by the exercise engine, solver and content build.
export type { Goal, ReplayedLine, FailedReplay, ReplayResult } from './core/chess/index.ts';
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
} from './core/chess/index.ts';

export type { VariantRules } from './core/variant/index.ts';
export { createVariantRules } from './core/variant/index.ts';

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
} from './core/exercise/index.ts';
export {
  EXERCISE_NOTES,
  exerciseNote,
  isEasierOfferNote,
  MINI_GAME_MODES,
  modeOf,
} from './core/exercise/index.ts';

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
} from './core/exercise/index.ts';
export { EXERCISE_KINDS, kindOf } from './core/exercise/index.ts';

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
} from './core/exercise/index.ts';

// Variant game rules and the computer opponent. Namespaced: both reuse names already taken by the
// static-capture mini-game API above (`GameState`, `playGameMove`, `gameResult`).
export * as game from './core/game/index.ts';
export * as bot from './core/bot/index.ts';

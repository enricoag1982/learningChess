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
} from './types.ts';

export type { ExerciseState, ExerciseStateOf } from './state.ts';
export type { MoveOutcome, UndoAction, UndoOutcome } from './kinds/static-move.ts';
export type { MateInNOutcome } from './kinds/mate-in-n/kind.ts';
export type { Hint } from './hint.ts';
export type {
  ExerciseFeedback,
  ExerciseNoteKind,
  ExerciseNoteCtx,
  ExerciseNote,
  Resolve,
} from './notes.ts';
export { EXERCISE_NOTES, exerciseNote, isEasierOfferNote } from './notes.ts';
export type { SelectionResult } from './kinds/select-squares/kind.ts';
export type { PlaceOutcome, PalettePiece } from './kinds/setup/kind.ts';
export { selectSquaresAnswer } from './kinds/select-squares/engine.ts';
export { setupPalette } from './kinds/setup/engine.ts';

export type { SolverMove } from './solver.ts';
export { solve, optimalMoves } from './solver.ts';

// Exercise-kind registry (`kinds/index.ts`): the only exercise-type dispatch.
export type { ExerciseProgress, ExerciseKind, Step, TextKeyRef, KindInput } from './kind.ts';
export type {
  ExerciseType,
  DefOf,
  ExerciseAction,
  ChessKind,
  ActionOf,
  OutcomeOf,
  AnyExerciseKind,
} from './kinds/index.ts';
export { EXERCISE_KINDS, kindOf, startExercise, requestHint, starsFor } from './kinds/index.ts';
export type { MoveAction, AnswerOutcome } from './kinds/base.ts';
export type {
  ToggleAction,
  SubmitAction,
  SelectSquaresAction,
  SelectOutcome,
} from './kinds/select-squares/kind.ts';
export type { AnswerYesNoAction } from './kinds/yes-no/kind.ts';
export type { AnswerChoiceAction } from './kinds/choice/kind.ts';
export type { PlaceAction } from './kinds/setup/kind.ts';

export { kingSquare } from '../chess/facts/pieces.ts';
export {
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
} from '../chess/facts/position.ts';

export type { StaticGoalSource } from './modes/static/def.ts';
export { staticGoalExercise } from './modes/static/def.ts';

export type {
  StaticCaptureGameDef,
  MiniGameGoal,
  GameState,
  GameOutcome,
} from './modes/static/def.ts';
export {
  startStaticCaptureGame,
  playGameMove,
  gameResult,
  gameStars,
} from './modes/static/engine.ts';

export type { SeriesGameDef, SeriesGameState } from './modes/series/def.ts';
export {
  startSeries,
  currentRound,
  completeRound,
  seriesResult,
  seriesStars,
} from './modes/series/engine.ts';

export type {
  VersusGameDef,
  VersusState,
  VersusStatus,
  VersusMoveOutcome,
} from './modes/versus/def.ts';
export {
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
} from './modes/versus/engine.ts';

// Mini-game-mode registry: the only mode-type dispatch (`modes/index.ts`).
export type { ModeType, MiniGameState } from './modes/index.ts';
export { MINI_GAME_MODES, modeOf } from './modes/index.ts';

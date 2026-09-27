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

export type { ExerciseState } from './engine.ts';
export type { MoveOutcome } from './kinds/static-move.ts';
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
export {
  startExercise,
  exerciseMoves,
  playMove,
  toggleSquare,
  submitSelection,
  selectSquaresAnswer,
  answerYesNo,
  answerChoice,
  placePiece,
  setupPalette,
  undo,
  requestHint,
  starsFor,
  playMateInN,
} from './engine.ts';

export type { SolverMove } from './solver.ts';
export { solve, optimalMoves } from './solver.ts';

// Exercise-kind registry (`kinds/index.ts`): the only exercise-type dispatch. `ExerciseKind` /
// `ExerciseStateOf` (`kind.ts` / `state.ts`) are subject-free and move to `platform-core` in R4.
export type { ExerciseProgress, ExerciseKind, Step, TextKeyRef, KindInput } from './kind.ts';
export type { ExerciseStateOf } from './state.ts';
export type {
  ExerciseType,
  DefOf,
  ExerciseAction,
  ChessKind,
  ActionOf,
  OutcomeOf,
  AnyExerciseKind,
} from './kinds/index.ts';
export { EXERCISE_KINDS, kindOf } from './kinds/index.ts';
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

export type { StaticCaptureGameDef, MiniGameGoal, GameState, GameOutcome } from './minigame.ts';
export { startStaticCaptureGame, playGameMove, gameResult, gameStars } from './minigame.ts';

export type { SeriesGameDef, SeriesGameState } from './minigame.ts';
export { startSeries, currentRound, completeRound, seriesResult, seriesStars } from './minigame.ts';

export type { VersusGameDef, VersusState, VersusStatus, VersusMoveOutcome } from './versus.ts';
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
} from './versus.ts';

export type { BossResultSummary } from './boss-result.ts';
export { summarizeBossResult, isBossResultWin } from './boss-result.ts';

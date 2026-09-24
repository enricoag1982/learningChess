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

export type {
  ExerciseState,
  MoveOutcome,
  SelectionResult,
  PlaceOutcome,
  PalettePiece,
  Hint,
  MateInNOutcome,
} from './engine.ts';
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

export {
  kingSquare,
  isAttacked,
  isDefended,
  isHanging,
  isInCheck,
  isCheckmate,
  isStalemate,
} from './facts.ts';

export type { StaticCaptureGameDef, MiniGameGoal, GameState, GameOutcome } from './minigame.ts';
export { startStaticCaptureGame, playGameMove, gameResult, gameStars } from './minigame.ts';

export type { SeriesGameDef, SeriesGameState } from './minigame.ts';
export { startSeries, currentRound, completeRound, seriesResult, seriesStars } from './minigame.ts';

export type { VersusGameDef, VersusState, VersusStatus, VersusMoveOutcome } from './versus.ts';
export {
  startVersus,
  versusPosition,
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

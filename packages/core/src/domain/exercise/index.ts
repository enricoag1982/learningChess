export type {
  CollectStarsDef,
  CaptureDef,
  SelectSquaresDef,
  YesNoDef,
  ChoiceOption,
  ChoiceDef,
  BestMoveDef,
  SetupDef,
  ExerciseDef,
} from './types.ts';

export type {
  ExerciseState,
  MoveOutcome,
  SelectionResult,
  PlaceOutcome,
  PalettePiece,
  Hint,
} from './engine.ts';
export {
  startExercise,
  exerciseMoves,
  playMove,
  toggleSquare,
  submitSelection,
  answerYesNo,
  answerChoice,
  placePiece,
  setupPalette,
  undo,
  requestHint,
  starsFor,
} from './engine.ts';

export type { SolverMove } from './solver.ts';
export { solve, optimalMoves } from './solver.ts';

export type { StaticCaptureGameDef, GameState, GameOutcome } from './minigame.ts';
export { startStaticCaptureGame, playGameMove, gameResult, gameStars } from './minigame.ts';

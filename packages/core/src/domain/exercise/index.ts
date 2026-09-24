export type { CollectStarsDef, CaptureDef, SelectSquaresDef, ExerciseDef } from './types.ts';

export type { ExerciseState, MoveOutcome, SelectionResult, Hint } from './engine.ts';
export {
  startExercise,
  exerciseMoves,
  playMove,
  toggleSquare,
  submitSelection,
  undo,
  requestHint,
  starsFor,
} from './engine.ts';

export type { SolverMove } from './solver.ts';
export { solve, optimalMoves } from './solver.ts';

export type { StaticCaptureGameDef, GameState, GameOutcome } from './minigame.ts';
export { startStaticCaptureGame, playGameMove, gameResult, gameStars } from './minigame.ts';

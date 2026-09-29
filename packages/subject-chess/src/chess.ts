export * as bot from './core/bot/index.ts';
export * as game from './core/game/index.ts';
export type { CompiledContent, Lesson, MiniGame } from './core/chess/lesson.ts';
export type {
  ExerciseDef,
  CollectStarsDef,
  SelectSquaresDef,
  MateInNDef,
  YesNoDef,
  BestMoveDef,
  ChoiceDef,
  SetupDef,
} from './core/exercise/types.ts';
export { SQUARES } from './core/chess/types.ts';
export type { ExerciseAction } from './kinds/index.ts';
export type { Position, Square, PieceType } from './core/chess/types.ts';
export type { VariantRules } from './core/variant/rules.ts';
export { chessJsRules } from './core/chess/chessjs-rules.ts';
export { createVariantRules } from './core/variant/rules.ts';
export { kindOf, startExercise } from './kinds/index.ts';
export { selectSquaresAnswer } from './kinds/select-squares/engine.ts';
export { toFen } from './core/chess/fen.ts';
export { DEFAULT_PROFILE_SETTINGS, CHESS_APP_CONFIG, chessCore } from './core/chess-core.ts';
export { findMoveBySan } from './core/chess/facts/san.ts';
export { parseDiagram } from './core/chess/diagram.ts';
export type { ComputerLevelCondition, ComputerLevelStatus } from './core/app/games.ts';
export {
  recordGame,
  computerLevelStatus,
  suggestedLevel,
  updateSuggestedLevel,
  versusGameRecordResult,
} from './core/app/games.ts';
export type { LocalPlayer } from './core/app/friend-play.ts';
export { friendGameOptions, recordLocalMatch } from './core/app/friend-play.ts';
export { parseFen } from './core/chess/fen.ts';
export { versusGameState } from './modes/versus/engine.ts';

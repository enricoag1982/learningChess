export type { WinCondition, GameRulesDef, GameResult, GameState } from './types.ts';

export type { GameBoardView } from './terminal.ts';
export { evaluateTerminal } from './terminal.ts';

export { startGame, legalGameMoves, playGameMove, gameResult } from './rules.ts';

export type { LocalMatchState, LocalMoveOutcome } from './local-match.ts';
export {
  startLocalMatch,
  localMatchPosition,
  localMatchGameState,
  localMatchResult,
  playLocalMove,
  canTakeBack,
  takeBack,
} from './local-match.ts';

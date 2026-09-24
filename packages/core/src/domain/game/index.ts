export type { WinCondition, GameRulesDef, GameResult, GameState } from './types.ts';

export type { GameBoardView } from './terminal.ts';
export { evaluateTerminal } from './terminal.ts';

export { startGame, legalGameMoves, playGameMove, gameResult } from './rules.ts';

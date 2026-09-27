/**
 * Legacy facade: `versus` mini-game logic now lives in `modes/versus/` (`modes/index.ts` is the
 * only mode-type dispatch); re-exported here under the same names/signatures for every existing
 * caller.
 */
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

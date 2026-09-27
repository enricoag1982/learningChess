/**
 * Legacy facade: `static` and `series` mini-game logic now lives in `modes/static/` and
 * `modes/series/` (`modes/index.ts` is the only mode-type dispatch); re-exported here under the
 * same names/signatures for every existing caller.
 */
export type {
  MiniGameGoal,
  StaticCaptureGameDef,
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

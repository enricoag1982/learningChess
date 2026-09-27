/**
 * The mini-game-mode registry — the only place mode-type dispatch happens in `packages/core`.
 * `boss-result.ts`'s legacy functions go through `modeOf`/`MINI_GAME_MODES` instead of their own
 * `if` chain on `state.mode`.
 */
import type { MiniGameMode } from '../mode.ts';
import type { GameState, StaticCaptureGameDef } from './static/def.ts';
import { staticMode } from './static/mode.ts';
import type { SeriesGameDef, SeriesGameState } from './series/def.ts';
import { seriesMode } from './series/mode.ts';
import type { VersusGameDef, VersusState } from './versus/def.ts';
import { versusMode } from './versus/mode.ts';

/** Every boss/mini-game state, whichever mode played it. */
export type MiniGameState = GameState | SeriesGameState | VersusState;
export type ModeType = MiniGameState['mode'];

/** Every mode's implementation, by `mode`. Only 3 modes exist (no per-mode action union to key off,
 * unlike exercise kinds — modes' own actions stay named functions), so this is spelled out rather
 * than derived through a generic `ChessMode<T>` helper. */
export const MINI_GAME_MODES = {
  static: staticMode,
  series: seriesMode,
  versus: versusMode,
} as const satisfies {
  readonly static: MiniGameMode<StaticCaptureGameDef, GameState>;
  readonly series: MiniGameMode<SeriesGameDef, SeriesGameState>;
  readonly versus: MiniGameMode<VersusGameDef, VersusState>;
};

/** Any mini-game mode, widened from its own precise type. */
export type AnyMiniGameMode = MiniGameMode<
  StaticCaptureGameDef | SeriesGameDef | VersusGameDef,
  MiniGameState
>;

/** The mode implementing `state`'s mini-game mode. */
export function modeOf(state: MiniGameState): AnyMiniGameMode {
  return MINI_GAME_MODES[state.mode];
}

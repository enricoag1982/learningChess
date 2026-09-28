// The mini-game-mode registry — the only place mode-type dispatch happens. `boss-result.ts`'s
// legacy functions go through `modeOf`/`MINI_GAME_MODES` instead of their own `if` chain.
import type { MiniGameMode } from '@learn/platform-core/domain/exercise/mode';
import type { ExerciseDef } from '../core/exercise/types.ts';
import type { GameState, StaticCaptureGameDef } from './static/def.ts';
import { staticMode } from './static/mode.ts';
import type {
  SeriesGameDef,
  SeriesGameState,
} from '@learn/platform-core/domain/exercise/modes/series/def';
import { createSeriesMode } from '@learn/platform-core/domain/exercise/modes/series/mode';
import { EXERCISE_KINDS } from '../kinds/index.ts';
import type { VersusGameDef, VersusState } from './versus/def.ts';
import { versusMode } from './versus/mode.ts';

/** Every boss/mini-game state, whichever mode played it. */
export type MiniGameState = GameState | SeriesGameState<ExerciseDef> | VersusState;
export type ModeType = MiniGameState['mode'];

/** Every mode's implementation, by `mode`. Only 3 exist, so this is spelled out rather than derived
 * through a generic helper. `series` is `createSeriesMode` over this package's own chess kinds —
 * the same factory `createSubjectRuntime` uses for any other subject. */
export const MINI_GAME_MODES = {
  static: staticMode,
  series: createSeriesMode<ExerciseDef>(EXERCISE_KINDS),
  versus: versusMode,
} as const satisfies {
  readonly static: MiniGameMode<StaticCaptureGameDef, GameState>;
  readonly series: MiniGameMode<SeriesGameDef<ExerciseDef>, SeriesGameState<ExerciseDef>>;
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

// The mini-game-mode content registry — the only place mode dispatch happens in `packages/content`
// for schemas, compiling and semantic verification.
import type { MiniGame } from '@chess-kids/core/chess';
import { z } from 'zod';
import { makeMiniGameCompileContext } from './mode-content.ts';
import type { MiniGameModeContent } from './mode-content.ts';
import { seriesMode } from './series/content.ts';
import { staticMode } from './static/content.ts';
import { versusMode } from './versus/content.ts';

export type { WinConditionYaml } from './versus/schema.ts';
export type {
  MiniGameCompileContext,
  MiniGameModeContent,
  ModeVerifyContext,
} from './mode-content.ts';
export { makeMiniGameCompileContext };

/** Any mini-game mode's content, widened from its own precise type. */
export type AnyMiniGameModeContent = MiniGameModeContent<MiniGame, z.ZodType>;

/** Every mode's content, by `mode`. Only 3 modes exist, so this is spelled out rather than derived
 * through a generic helper. */
export const MINI_GAME_MODE_CONTENT = {
  static: staticMode,
  series: seriesMode,
  versus: versusMode,
} as const satisfies {
  readonly static: MiniGameModeContent<Extract<MiniGame, { readonly mode: 'static' }>, z.ZodType>;
  readonly series: MiniGameModeContent<Extract<MiniGame, { readonly mode: 'series' }>, z.ZodType>;
  readonly versus: MiniGameModeContent<Extract<MiniGame, { readonly mode: 'versus' }>, z.ZodType>;
};

/** The content behaviour implementing `mode`'s mini-game mode. */
export function modeContentOf(mode: MiniGame['mode']): AnyMiniGameModeContent {
  return MINI_GAME_MODE_CONTENT[mode];
}

/** One mini-game file (`minigames/<id>.yaml`): `static`, `series`, or `versus` (`mode`, default `static`). */
export const miniGameSchema = z.union([staticMode.schema, seriesMode.schema, versusMode.schema]);

export type MiniGameYaml = z.infer<typeof miniGameSchema>;

/** The authored `mode` a mini-game YAML document is, `static` being the unmarked default. */
export function rawModeOf(data: MiniGameYaml): MiniGame['mode'] {
  return data.mode ?? 'static';
}

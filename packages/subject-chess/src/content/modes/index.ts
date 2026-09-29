// The mini-game-mode content registry — the only place mode dispatch happens in `packages/content`
// for schemas, compiling and semantic verification.
import type { MiniGame } from '../../core/chess/lesson.ts';
import { z } from 'zod';
import type {
  MiniGameModeContent,
  MiniGameSchema,
} from '@learn/platform-content/modes/mode-content';
import { seriesMode } from './series/content.ts';
import { staticMode } from '../../modes/static/content.ts';
import { versusMode } from '../../modes/versus/content.ts';

type ChessSeriesMode = MiniGameModeContent<
  Extract<MiniGame, { readonly mode: 'series' }>,
  MiniGameSchema
>;

/** Every mode's content, by `mode`. Only 3 modes exist, so this is spelled out rather than derived
 * through a generic helper. `series` compiles its rounds through the generic kind registry (any
 * exercise def), so its own content is widened here to chess's own concrete round type. */
export const MINI_GAME_MODE_CONTENT = {
  static: staticMode,
  // Single trust boundary from the generic round type to chess's own concrete rounds.
  series: seriesMode as unknown as ChessSeriesMode,
  versus: versusMode,
} as const satisfies {
  readonly static: MiniGameModeContent<Extract<MiniGame, { readonly mode: 'static' }>, z.ZodType>;
  readonly series: ChessSeriesMode;
  readonly versus: MiniGameModeContent<Extract<MiniGame, { readonly mode: 'versus' }>, z.ZodType>;
};

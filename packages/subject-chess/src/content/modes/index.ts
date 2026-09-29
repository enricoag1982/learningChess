// The mini-game-mode content registry: the only place mode dispatch happens for schemas, compiling and verification.
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

/** Every mode's content by `mode`; only 3 exist, so spelled out. `series` compiles rounds through the generic kind registry, so
 * it is widened here to chess's concrete round type. */
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

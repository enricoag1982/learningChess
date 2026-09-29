// The mini-game-mode e2e-driver registry: the only place mode dispatch happens for e2e. `Page` is type-only; this file (and
// each mode's `e2e.ts`) is never reachable from app code, only Playwright specs (eslint.config.js).
import type { Page } from '@playwright/test';
import type { ExerciseDef } from '../../core/exercise/types.ts';
import type { ModeType } from '../../modes/index.ts';
import { seriesE2E } from '../../modes/series/e2e.ts';
import { staticE2E } from '../../modes/static/e2e.ts';
import { versusE2E } from '../../modes/versus/e2e.ts';
import type { GameOf } from './ui-registry.ts';

/** One mini-game mode's e2e driver: plays `game` to its end (result panel showing, before its own
 * "Next" tap — `e2e/kit/exercises.ts`'s `completeBoss` does that once, for every mode). */
export interface ModeE2E<M extends ModeType> {
  play(
    page: Page,
    game: GameOf<M>,
    ctx: {
      readonly text: (key: string) => string;
      /** Solves one exercise definition's core interaction (a `static` boss's goal or one `series` round): the kit's `solveExercise`,
       * passed in so a mode's `e2e.ts` never imports the kit (app → registries → kit, one way). */
      solve(page: Page, def: ExerciseDef): Promise<void>;
    },
  ): Promise<void>;
}

export const MINI_GAME_MODE_E2E = {
  static: staticE2E,
  series: seriesE2E,
  versus: versusE2E,
} satisfies { readonly [M in ModeType]: ModeE2E<M> };

/** `mode`'s driver, widened (same cast as `kindE2EOf`; `play`'s `game` is contravariant in `M`). */
export function modeE2EOf(mode: ModeType): ModeE2E<ModeType> {
  return MINI_GAME_MODE_E2E[mode] as ModeE2E<ModeType>;
}

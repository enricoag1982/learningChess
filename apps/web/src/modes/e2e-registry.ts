// The mini-game-mode e2e-driver registry — the only place mode dispatch happens for e2e.
// `Page` is a type-only import: this file (and every mode's own `e2e.ts`) is never reachable from
// app code, only from Playwright specs (`e2e/kit/exercises.ts`), enforced by eslint.config.js.
import type { Page } from '@playwright/test';
import type { ExerciseDef, ModeType } from '@chess-kids/core/chess';
import { seriesE2E } from './series/e2e.ts';
import { staticE2E } from './static/e2e.ts';
import { versusE2E } from './versus/e2e.ts';
import type { GameOf } from './mode-ui.ts';

/** One mini-game mode's e2e driver: plays `game` to its end (result panel showing, before its own
 * "Next" tap — `e2e/kit/exercises.ts`'s `completeBoss` does that once, for every mode). */
export interface ModeE2E<M extends ModeType> {
  play(
    page: Page,
    game: GameOf<M>,
    ctx: {
      readonly text: (key: string) => string;
      /** Solves one exercise definition's core interaction (a `static` boss's own goal, or one
       * `series` round) — `e2e/kit/exercises.ts`'s own `solveExercise`, passed in rather than
       * imported, so a mode's `e2e.ts` never imports the kit (app → registries → kit, one way). */
      solve(page: Page, def: ExerciseDef): Promise<void>;
    },
  ): Promise<void>;
}

/** Every mini-game mode's e2e driver, by `mode`. */
export const MINI_GAME_MODE_E2E = {
  static: staticE2E,
  series: seriesE2E,
  versus: versusE2E,
} satisfies { readonly [M in ModeType]: ModeE2E<M> };

/** `mode`'s own e2e driver, widened — same narrow/widen cast `kinds/e2e-registry.ts`'s
 * `kindE2EOf` uses, for the same reason (`play`'s `game` is contravariant in `M`). */
export function modeE2EOf(mode: ModeType): ModeE2E<ModeType> {
  return MINI_GAME_MODE_E2E[mode] as ModeE2E<ModeType>;
}

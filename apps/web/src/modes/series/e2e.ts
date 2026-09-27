import type { ModeE2E } from '../e2e-registry.ts';

/** A `series` boss plays like a normal exercise, round by round, tapping Next between them. */
export const seriesE2E: ModeE2E<'series'> = {
  async play(page, game, ctx) {
    for (const round of game.rounds) {
      await ctx.solve(page, round);
      await page.getByRole('button', { name: /^Next/ }).click();
    }
  },
};

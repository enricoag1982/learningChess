import { staticGoalExercise } from './def.ts';
import type { ModeE2E } from '../../web/modes/e2e-registry.ts';

/** A `static` boss solves like the `capture`/`collect-stars` exercise its goal reduces to
 * (`staticGoalExercise` — same helper the core engine itself uses). */
export const staticE2E: ModeE2E<'static'> = {
  async play(page, game, ctx) {
    await ctx.solve(
      page,
      staticGoalExercise({
        id: game.id,
        concept: game.concept,
        textKey: game.id,
        position: game.position,
        goal: game.goal,
        par: game.par,
      }),
    );
  },
};

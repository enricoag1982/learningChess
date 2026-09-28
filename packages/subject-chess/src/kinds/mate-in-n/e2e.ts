import { performMove } from '../../web/kinds/e2e-actions.ts';
import type { KindE2E } from '../../web/kinds/e2e-registry.ts';

/** The scripted opponent reply (if any) is already folded into the core `outcome`/next position —
 * the runner's `data-fen` wait absorbs its ~600ms reveal delay (`kinds/session.ts`), replacing the
 * old fixed-length wait. */
export const mateInNE2E: KindE2E<'mate-in-n'> = {
  async perform(page, action, { before, rules }) {
    await performMove(page, action.move, before, rules);
  },
};

import { performMove } from '../../web/kinds/e2e-actions.ts';
import type { KindE2E } from '../../web/kinds/e2e-registry.ts';

export const bestMoveE2E: KindE2E<'best-move'> = {
  async perform(page, action, { before, rules }) {
    await performMove(page, action.move, before, rules);
  },
};

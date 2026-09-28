import { performMove } from '../e2e-actions.ts';
import type { KindE2E } from '../e2e-registry.ts';

export const bestMoveE2E: KindE2E<'best-move'> = {
  async perform(page, action, { before, rules }) {
    await performMove(page, action.move, before, rules);
  },
};

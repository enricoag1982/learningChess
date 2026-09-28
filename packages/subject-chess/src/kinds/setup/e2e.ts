import { clickSquare } from '../../web/kinds/e2e-actions.ts';
import type { KindE2E } from '../../web/kinds/e2e-registry.ts';

export const setupE2E: KindE2E<'setup'> = {
  async perform(page, action, { text }) {
    const color = text(`board.color.${action.piece.color}`);
    const pieceName = text(`board.piece.${action.piece.type}`);
    await page.getByRole('button', { name: new RegExp(`^${color} ${pieceName},`) }).click();
    await clickSquare(page, action.square);
  },
};

import { clickSquare } from '../e2e-actions.ts';
import type { KindE2E } from '../e2e-registry.ts';

export const selectSquaresE2E: KindE2E<'select-squares'> = {
  async perform(page, action) {
    if (action.type === 'toggle') {
      await clickSquare(page, action.square);
      return;
    }
    await page.getByRole('button', { name: /Check/ }).click();
  },
};

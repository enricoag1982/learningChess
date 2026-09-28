import type { Page } from '@playwright/test';
import { performMove } from '../e2e-actions.ts';
import type { KindE2E } from '../e2e-registry.ts';

export const captureE2E: KindE2E<'capture'> = {
  async perform(page: Page, action, { before, rules }) {
    if (action.type === 'undo') {
      await page.getByRole('button', { name: /Undo/ }).click();
      return;
    }
    await performMove(page, action.move, before, rules);
  },
};

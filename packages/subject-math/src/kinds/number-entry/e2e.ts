import type { NumberEntryDef } from '../../core/types.ts';
import type { KindE2E } from '../../web/kinds/e2e-registry.ts';
import type { NumberEntryAction, NumberEntryOutcome } from './kind.ts';

export const numberEntryE2E: KindE2E<NumberEntryDef, NumberEntryAction, NumberEntryOutcome> = {
  async perform(page, action, { text }) {
    switch (action.type) {
      case 'enter-digit':
        await page.getByRole('button', { name: String(action.digit), exact: true }).click();
        return;
      case 'erase-digit':
        await page.getByRole('button', { name: text('math.erase'), exact: true }).click();
        return;
      case 'submit-number':
        await page.getByRole('button', { name: text('exercise.check'), exact: true }).click();
        return;
    }
  },
};

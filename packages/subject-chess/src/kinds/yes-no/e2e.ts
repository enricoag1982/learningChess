import type { KindE2E } from '../../web/kinds/e2e-registry.ts';

export const yesNoE2E: KindE2E<'yes-no'> = {
  async perform(page, action, { text }) {
    const label = action.value ? text('exercise.yes') : text('exercise.no');
    await page.getByRole('button', { name: label, exact: true }).click();
  },
};

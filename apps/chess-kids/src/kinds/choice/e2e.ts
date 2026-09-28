import type { KindE2E } from '../e2e-registry.ts';

export const choiceE2E: KindE2E<'choice'> = {
  async perform(page, action, { def, text }) {
    const option = def.options.find((entry) => entry.id === action.optionId);
    if (!option) throw new Error(`choice "${def.id}": no option "${action.optionId}"`);
    if (option.textKey !== undefined) {
      await page.getByRole('button', { name: text(option.textKey), exact: true }).click();
      return;
    }
    if (!option.piece) throw new Error(`choice "${def.id}" option has neither text nor piece`);
    const color = text(`board.color.${option.piece.color}`);
    const piece = text(`board.piece.${option.piece.type}`);
    await page.getByRole('button', { name: `${color} ${piece}`, exact: true }).click();
  },
};

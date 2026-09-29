import type { AnswerOutcome } from '@learn/platform-core/domain/exercise/answer';
import type { AnswerChoiceAction } from '@learn/platform-core/domain/exercise/kinds/choice/def';
import type { MathChoiceDef } from '../../core/types.ts';
import type { KindE2E } from '../../web/kinds/e2e-registry.ts';

export const choiceE2E: KindE2E<MathChoiceDef, AnswerChoiceAction, AnswerOutcome> = {
  async perform(page, action, { def, text }) {
    const option = def.options.find((entry) => entry.id === action.optionId);
    if (!option) throw new Error(`choice "${def.id}": no option "${action.optionId}"`);
    if (option.textKey !== undefined) {
      await page.getByRole('button', { name: text(option.textKey), exact: true }).click();
      return;
    }
    if (option.value === undefined) {
      throw new Error(`choice "${def.id}" option has neither text nor value`);
    }
    await page.getByRole('button', { name: String(option.value), exact: true }).click();
  },
};

import type { ChoiceLook } from '@learn/platform-web/kinds/choice/ChoiceOptions.tsx';
import type { MathChoiceOption } from '../../core/types.ts';

/** An option with a `value` shows it as a big numeral and, with no text, is named by that number for screen readers. */
export const MATH_CHOICE_LOOK: ChoiceLook<MathChoiceOption> = {
  visual: ({ value }) =>
    value !== undefined && <span className="font-display text-4xl font-bold">{value}</span>,
  label: ({ value }) => (value === undefined ? undefined : String(value)),
};

import type { ExerciseKindUI, PlayAreaProps } from '@learn/platform-web/kinds/kind-ui.ts';
import type { MathState, NumberEntryDef } from '../../core/types.ts';
import type { NumberEntryAction, NumberEntryOutcome } from './kind.ts';
import { PlayArea } from './PlayArea.tsx';

/** `wrongValue`: the last wrong answer, shown struck through until the next digit. */
export interface NumberEntryExtra {
  readonly wrongValue?: number;
}

export type NumberEntryPlayAreaProps = PlayAreaProps<
  NumberEntryDef,
  MathState<NumberEntryDef>,
  NumberEntryAction,
  NumberEntryExtra
>;

export const numberEntryUi: ExerciseKindUI<
  NumberEntryDef,
  MathState<NumberEntryDef>,
  NumberEntryAction,
  NumberEntryOutcome,
  NumberEntryExtra
> = {
  type: 'number-entry',

  initUi: () => ({}),

  clearWrongUi: () => ({ wrongValue: undefined }),

  toUi(outcome) {
    if (outcome.kind === 'wrong') {
      return { feedback: { kind: 'wrong-answer' }, hint: null, wrongValue: outcome.value };
    }
    if (outcome.kind === 'solved') {
      return { feedback: { kind: 'solved' }, hint: null, wrongValue: undefined };
    }
    // 'typed', or 'ignored' (Delete on an empty entry, a third digit): the struck-through value goes.
    return { feedback: { kind: 'instruction' }, wrongValue: undefined };
  },

  PlayArea,
};

import type { ActionOf, DefOf, ExerciseStateOf, OutcomeOf } from '../../chess.ts';
import type { ExerciseKindUI } from '@learn/platform-web/kinds/kind-ui.ts';
import type { WrongSquaresExtra } from '../../web/kinds/move-ui.ts';
import { baseInitUi } from '../../web/kinds/move-ui.ts';
import { PlayArea } from './PlayArea.tsx';

export interface YesNoExtra extends WrongSquaresExtra {
  /** The value last picked wrong, if any — that button turns orange and disables. */
  readonly wrongAnswer?: boolean;
}

export const yesNoUi: ExerciseKindUI<
  DefOf<'yes-no'>,
  ExerciseStateOf<DefOf<'yes-no'>>,
  ActionOf<'yes-no'>,
  OutcomeOf<'yes-no'>,
  YesNoExtra
> = {
  type: 'yes-no',

  initUi: baseInitUi,

  clearWrongUi: () => ({ wrongSquares: [] }),

  toUi(outcome, action) {
    if (outcome.kind === 'wrong') {
      return {
        feedback: { kind: 'wrong-answer' },
        hint: null,
        wrongSquares: [],
        wrongAnswer: action.value,
      };
    }
    // 'solved' or 'ignored' (already solved: the buttons are hidden by then, unreachable in the UI).
    return { feedback: { kind: 'solved' }, hint: null, wrongSquares: [], wrongAnswer: undefined };
  },

  PlayArea,
};

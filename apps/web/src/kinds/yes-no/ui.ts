import type { ExerciseKindUI } from '../kind-ui.ts';
import { PlayArea } from './PlayArea.tsx';

export const yesNoUi: ExerciseKindUI<'yes-no'> = {
  type: 'yes-no',

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

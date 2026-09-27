import type { ExerciseKindUI } from '../kind-ui.ts';
import { moveToUi } from '../move-ui.ts';
import { PlayArea } from './PlayArea.tsx';

export const captureUi: ExerciseKindUI<'capture'> = {
  type: 'capture',

  toUi(outcome) {
    if (outcome.kind === 'undone') {
      return {
        feedback: { kind: 'instruction' },
        hint: null,
        wrongSquares: [],
        wrongMove: undefined,
        lastMove: undefined,
      };
    }
    return moveToUi(outcome);
  },

  PlayArea,
};

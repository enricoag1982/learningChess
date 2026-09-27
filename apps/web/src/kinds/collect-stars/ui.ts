import type { ExerciseKindUI } from '../kind-ui.ts';
import { moveToUi } from '../move-ui.ts';
import { PlayArea } from './PlayArea.tsx';

export const collectStarsUi: ExerciseKindUI<'collect-stars'> = {
  type: 'collect-stars',

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

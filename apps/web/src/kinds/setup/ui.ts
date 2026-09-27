import type { ExerciseKindUI } from '../kind-ui.ts';
import { PlayArea } from './PlayArea.tsx';

export const setupUi: ExerciseKindUI<'setup'> = {
  type: 'setup',

  toUi(outcome) {
    const wrong = outcome.kind === 'wrong';
    return {
      feedback:
        outcome.kind === 'solved'
          ? { kind: 'solved' }
          : wrong
            ? { kind: 'wrong-placement' }
            : { kind: 'instruction' },
      hint: null,
      wrongSquares: wrong ? [outcome.square] : [],
    };
  },

  PlayArea,
};

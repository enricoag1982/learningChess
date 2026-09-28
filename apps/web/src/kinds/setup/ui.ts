import type { ActionOf, DefOf, ExerciseStateOf, OutcomeOf } from '@chess-kids/core/chess';
import type { ExerciseKindUI } from '../kind-ui.ts';
import type { WrongSquaresExtra } from '../move-ui.ts';
import { baseInitUi } from '../move-ui.ts';
import { PlayArea } from './PlayArea.tsx';

export const setupUi: ExerciseKindUI<
  DefOf<'setup'>,
  ExerciseStateOf<DefOf<'setup'>>,
  ActionOf<'setup'>,
  OutcomeOf<'setup'>,
  WrongSquaresExtra
> = {
  type: 'setup',

  initUi: baseInitUi,

  clearWrongUi: () => ({ wrongSquares: [] }),

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

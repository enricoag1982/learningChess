import type { ActionOf, DefOf, ExerciseStateOf, OutcomeOf } from '@learn/subject-chess';
import type { ExerciseKindUI } from '../kind-ui.ts';
import type { MoveExtra } from '../move-ui.ts';
import { baseInitUi, moveToUi } from '../move-ui.ts';
import { PlayArea } from './PlayArea.tsx';

export const collectStarsUi: ExerciseKindUI<
  DefOf<'collect-stars'>,
  ExerciseStateOf<DefOf<'collect-stars'>>,
  ActionOf<'collect-stars'>,
  OutcomeOf<'collect-stars'>,
  MoveExtra
> = {
  type: 'collect-stars',

  initUi: baseInitUi,

  clearWrongUi: () => ({ wrongSquares: [] }),

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

import type { ActionOf, DefOf, ExerciseStateOf, OutcomeOf } from '@chess-kids/core/chess';
import type { ExerciseKindUI } from '../kind-ui.ts';
import type { MoveExtra } from '../move-ui.ts';
import { baseInitUi, moveToUi } from '../move-ui.ts';
import { PlayArea } from './PlayArea.tsx';

export const captureUi: ExerciseKindUI<
  DefOf<'capture'>,
  ExerciseStateOf<DefOf<'capture'>>,
  ActionOf<'capture'>,
  OutcomeOf<'capture'>,
  MoveExtra
> = {
  type: 'capture',

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

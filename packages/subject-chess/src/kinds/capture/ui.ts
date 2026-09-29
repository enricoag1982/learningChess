import type { ActionOf, DefOf, OutcomeOf } from '../index.ts';
import type { ExerciseStateOf } from '../../core/exercise/state.ts';
import type { ExerciseKindUI } from '@learn/platform-web/kinds/kind-ui.ts';
import type { MoveExtra } from '../../web/kinds/move-ui.ts';
import { baseInitUi, moveToUi } from '../../web/kinds/move-ui.ts';
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

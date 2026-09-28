import type { ActionOf, DefOf, ExerciseStateOf, OutcomeOf } from '@learn/subject-chess';
import type { ExerciseKindUI } from '../kind-ui.ts';
import type { WrongSquaresExtra } from '../move-ui.ts';
import { baseInitUi } from '../move-ui.ts';
import { PlayArea } from './PlayArea.tsx';

export const choiceUi: ExerciseKindUI<
  DefOf<'choice'>,
  ExerciseStateOf<DefOf<'choice'>>,
  ActionOf<'choice'>,
  OutcomeOf<'choice'>,
  WrongSquaresExtra
> = {
  type: 'choice',

  initUi: baseInitUi,

  clearWrongUi: () => ({ wrongSquares: [] }),

  toUi(outcome) {
    if (outcome.kind === 'wrong') {
      return { feedback: { kind: 'wrong-answer' }, hint: null, wrongSquares: [] };
    }
    // 'solved' or 'ignored' (already solved: the tiles are hidden by then, unreachable in the UI).
    return { feedback: { kind: 'solved' }, hint: null, wrongSquares: [] };
  },

  PlayArea,
};

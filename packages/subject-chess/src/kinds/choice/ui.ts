import type { ActionOf, DefOf, ExerciseStateOf, OutcomeOf } from '../../chess.ts';
import type { ExerciseKindUI } from '@learn/platform-web/kinds/kind-ui.ts';
import type { WrongSquaresExtra } from '../../web/kinds/move-ui.ts';
import { baseInitUi } from '../../web/kinds/move-ui.ts';
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

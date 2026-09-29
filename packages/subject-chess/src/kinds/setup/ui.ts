import type { WrongSquaresExtra, ChessKindUI } from '../../web/kinds/move-ui.ts';
import { baseInitUi } from '../../web/kinds/move-ui.ts';
import { PlayArea } from './PlayArea.tsx';

export const setupUi: ChessKindUI<'setup', WrongSquaresExtra> = {
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

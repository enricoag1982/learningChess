import type { WrongSquaresExtra, ChessKindUI } from '../../web/kinds/move-ui.ts';
import { baseInitUi } from '../../web/kinds/move-ui.ts';
import { PlayArea } from './PlayArea.tsx';

export const choiceUi: ChessKindUI<'choice', WrongSquaresExtra> = {
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

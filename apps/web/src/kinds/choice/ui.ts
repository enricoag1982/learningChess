import type { ExerciseKindUI } from '../kind-ui.ts';
import { PlayArea } from './PlayArea.tsx';

export const choiceUi: ExerciseKindUI<'choice'> = {
  type: 'choice',

  toUi(outcome) {
    if (outcome.kind === 'wrong') {
      return { feedback: { kind: 'wrong-answer' }, hint: null, wrongSquares: [] };
    }
    // 'solved' or 'ignored' (already solved: the tiles are hidden by then, unreachable in the UI).
    return { feedback: { kind: 'solved' }, hint: null, wrongSquares: [] };
  },

  PlayArea,
};

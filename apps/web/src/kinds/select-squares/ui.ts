import type { ExerciseKindUI } from '../kind-ui.ts';
import { PlayArea } from './PlayArea.tsx';

export const selectSquaresUi: ExerciseKindUI<'select-squares'> = {
  type: 'select-squares',

  toUi(outcome) {
    if (outcome.kind === 'toggled') {
      // Markers from the last check stay until the next one; the play area hides each one as soon
      // as the kid fixes that square (wrong one untapped, missed one tapped).
      return { feedback: { kind: 'instruction' } };
    }
    const { result } = outcome;
    if (result.correct) {
      return { feedback: { kind: 'solved' }, hint: null, wrongSquares: [], missedSquares: [] };
    }
    const kind =
      result.wrong.length === 0
        ? 'select-missing'
        : result.missing === 0
          ? 'select-wrong'
          : 'select-both';
    return { feedback: { kind }, wrongSquares: result.wrong, missedSquares: result.missingSquares };
  },

  PlayArea,
};

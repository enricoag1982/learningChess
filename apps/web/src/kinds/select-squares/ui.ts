import type { ActionOf, DefOf, ExerciseStateOf, OutcomeOf, Square } from '@learn/subject-chess';
import type { ExerciseKindUI } from '../kind-ui.ts';
import type { WrongSquaresExtra } from '../move-ui.ts';
import { baseInitUi } from '../move-ui.ts';
import { PlayArea } from './PlayArea.tsx';

export interface SelectSquaresExtra extends WrongSquaresExtra {
  /** Answer squares the kid had not selected, after a wrong check: dashed orange until tapped.
   * Kept across toggles; the play area hides the ones since selected. */
  readonly missedSquares: readonly Square[];
}

export const selectSquaresUi: ExerciseKindUI<
  DefOf<'select-squares'>,
  ExerciseStateOf<DefOf<'select-squares'>>,
  ActionOf<'select-squares'>,
  OutcomeOf<'select-squares'>,
  SelectSquaresExtra
> = {
  type: 'select-squares',

  initUi: (def) => ({ ...baseInitUi(def), missedSquares: [] }),

  clearWrongUi: () => ({ wrongSquares: [] }),

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

import type { ActionOf, DefOf, ExerciseStateOf, OutcomeOf } from '@chess-kids/core/chess';
import type { ExerciseKindUI } from '../kind-ui.ts';
import type { MoveExtra } from '../move-ui.ts';
import { baseInitUi, moveToUi } from '../move-ui.ts';
import { PlayArea } from './PlayArea.tsx';

export const bestMoveUi: ExerciseKindUI<
  DefOf<'best-move'>,
  ExerciseStateOf<DefOf<'best-move'>>,
  ActionOf<'best-move'>,
  OutcomeOf<'best-move'>,
  MoveExtra
> = {
  type: 'best-move',
  initUi: baseInitUi,
  clearWrongUi: () => ({ wrongSquares: [] }),
  toUi(outcome) {
    return moveToUi(outcome);
  },
  PlayArea,
};

import type { ExerciseKindUI } from '../kind-ui.ts';
import { moveToUi } from '../move-ui.ts';
import { PlayArea } from './PlayArea.tsx';

export const bestMoveUi: ExerciseKindUI<'best-move'> = {
  type: 'best-move',
  toUi(outcome) {
    return moveToUi(outcome);
  },
  PlayArea,
};

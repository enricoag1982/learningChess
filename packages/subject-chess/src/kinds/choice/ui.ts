import { createChoiceUi } from '@learn/platform-web/kinds/choice/create-choice-ui.tsx';
import type { ExerciseStateOf } from '../../core/exercise/state.ts';
import type { ChoiceDef } from '../../core/exercise/types.ts';
import type { WrongSquaresExtra } from '../../web/kinds/move-ui.ts';
import { baseInitUi } from '../../web/kinds/move-ui.ts';
import { ChoiceBoard } from './ChoiceBoard.tsx';
import { CHESS_CHOICE_LOOK } from './look.tsx';

export const choiceUi = createChoiceUi<ChoiceDef, ExerciseStateOf<ChoiceDef>, WrongSquaresExtra>({
  initUi: baseInitUi,
  clearWrongUi: () => ({ wrongSquares: [] }),
  stimulus: ChoiceBoard,
  look: CHESS_CHOICE_LOOK,
});

// The exercise-kind UI registry, folded into `chessWeb.kinds` (`SubjectWeb`) — platform code
// dispatches through the pack, never a hardcoded import of this file.
import type { AnyExerciseKindUI } from '@learn/platform-web/kinds/kind-ui.ts';
import { bestMoveUi } from '../../kinds/best-move/ui.ts';
import { captureUi } from '../../kinds/capture/ui.ts';
import { choiceUi } from '../../kinds/choice/ui.ts';
import { collectStarsUi } from '../../kinds/collect-stars/ui.ts';
import { mateInNUi } from '../../kinds/mate-in-n/ui.ts';
import { selectSquaresUi } from '../../kinds/select-squares/ui.ts';
import { setupUi } from '../../kinds/setup/ui.ts';
import { yesNoUi } from '../../kinds/yes-no/ui.ts';

/** Every exercise type's UI, by `type`. */
export const EXERCISE_KIND_UI: Readonly<Record<string, AnyExerciseKindUI>> = {
  'collect-stars': collectStarsUi,
  capture: captureUi,
  'select-squares': selectSquaresUi,
  'yes-no': yesNoUi,
  choice: choiceUi,
  'best-move': bestMoveUi,
  setup: setupUi,
  'mate-in-n': mateInNUi,
};

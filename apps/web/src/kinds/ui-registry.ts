// The exercise-kind UI registry, folded into `chessWeb.kinds` (`SubjectWeb`) — platform code
// dispatches through the pack, never a hardcoded import of this file.
import type { AnyExerciseKindUI } from './kind-ui.ts';
import { bestMoveUi } from './best-move/ui.ts';
import { captureUi } from './capture/ui.ts';
import { choiceUi } from './choice/ui.ts';
import { collectStarsUi } from './collect-stars/ui.ts';
import { mateInNUi } from './mate-in-n/ui.ts';
import { selectSquaresUi } from './select-squares/ui.ts';
import { setupUi } from './setup/ui.ts';
import { yesNoUi } from './yes-no/ui.ts';

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

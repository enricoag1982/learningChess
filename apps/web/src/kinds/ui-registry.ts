// The exercise-kind UI registry — the only place exercise-type dispatch happens for the UI
// (`ExercisePlay.tsx`'s `kindUiOf`, never a local `if`/`switch`).
import type { ExerciseDef, ExerciseType } from '@chess-kids/core/chess';
import { bestMoveUi } from './best-move/ui.ts';
import { captureUi } from './capture/ui.ts';
import { choiceUi } from './choice/ui.ts';
import { collectStarsUi } from './collect-stars/ui.ts';
import type { ExerciseKindUI } from './kind-ui.ts';
import { mateInNUi } from './mate-in-n/ui.ts';
import { selectSquaresUi } from './select-squares/ui.ts';
import { setupUi } from './setup/ui.ts';
import { yesNoUi } from './yes-no/ui.ts';

/** Every exercise type's UI, by `type`. */
export const EXERCISE_KIND_UI = {
  'collect-stars': collectStarsUi,
  capture: captureUi,
  'select-squares': selectSquaresUi,
  'yes-no': yesNoUi,
  choice: choiceUi,
  'best-move': bestMoveUi,
  setup: setupUi,
  'mate-in-n': mateInNUi,
} as const satisfies { readonly [T in ExerciseType]: ExerciseKindUI<T> };

/** `def`'s own exercise kind's UI. `PlayArea`'s `dispatch` is contravariant in the kind's action
 * type, so — unlike `kindOf`'s `act` — this widening needs the one narrow/widen cast pattern core's
 * `kinds/adapt.ts` uses for the same reason; the entries above are still checked precisely against
 * `ExerciseKindUI<T>`. */
export const kindUiOf = (def: ExerciseDef): ExerciseKindUI<ExerciseType> =>
  EXERCISE_KIND_UI[def.type] as ExerciseKindUI<ExerciseType>;

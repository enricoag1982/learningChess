// The exercise-kind UI registry, folded into `mathWeb.kinds` (`SubjectWeb`): platform code dispatches through the pack.
import type { AnyExerciseKindUI } from '@learn/platform-web/kinds/kind-ui.ts';
import { choiceUi } from '../../kinds/choice/ui.ts';
import { numberEntryUi } from '../../kinds/number-entry/ui.ts';

export const EXERCISE_KIND_UI: Readonly<Record<string, AnyExerciseKindUI>> = {
  choice: choiceUi,
  'number-entry': numberEntryUi,
};

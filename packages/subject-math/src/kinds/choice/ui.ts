import { createChoiceUi } from '@learn/platform-web/kinds/choice/create-choice-ui.tsx';
import type { MathChoiceDef, MathState } from '../../core/types.ts';
import { MATH_CHOICE_LOOK } from './look.tsx';
import { ProblemStimulus } from './ProblemStimulus.tsx';

export const choiceUi = createChoiceUi<MathChoiceDef, MathState<MathChoiceDef>, object>({
  initUi: () => ({}),
  clearWrongUi: () => ({}),
  stimulus: ProblemStimulus,
  look: MATH_CHOICE_LOOK,
});

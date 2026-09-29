import { createChoiceKind } from '@learn/platform-core/domain/exercise/kinds/choice/kind';
import { initState } from '../../core/exercise/state.ts';
import type { ExerciseStateOf } from '../../core/exercise/state.ts';
import type { ChoiceDef } from '../../core/exercise/types.ts';
import type { VariantRules } from '../../core/variant/rules.ts';

export const choiceKind = createChoiceKind<ChoiceDef, ExerciseStateOf<ChoiceDef>, VariantRules>(
  initState,
);

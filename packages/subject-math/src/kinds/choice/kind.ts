import type { AnswerOutcome } from '@learn/platform-core/domain/exercise/answer';
import type { AnswerChoiceAction } from '@learn/platform-core/domain/exercise/kinds/choice/def';
import { createChoiceKind } from '@learn/platform-core/domain/exercise/kinds/choice/kind';
import { initMathState } from '../../core/state.ts';
import type { MathChoiceDef, MathKind, MathState } from '../../core/types.ts';

export const mathChoiceKind: MathKind<MathChoiceDef, AnswerChoiceAction, AnswerOutcome> =
  createChoiceKind<MathChoiceDef, MathState<MathChoiceDef>, null>(initMathState);

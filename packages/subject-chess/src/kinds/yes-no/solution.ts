import type { AnswerYesNoAction } from './kind.ts';
import type { YesNoDef } from '../../core/exercise/types.ts';

/** The correct answer, straight from `def`. */
export function yesNoSolution(def: YesNoDef): readonly AnswerYesNoAction[] {
  return [{ type: 'answer-yes-no', value: def.answer }];
}

/** The wrong answer: exactly 1 error, then still answerable (a fresh try is never blocked). */
export function yesNoWrongAction(def: YesNoDef): readonly AnswerYesNoAction[] {
  return [{ type: 'answer-yes-no', value: !def.answer }];
}

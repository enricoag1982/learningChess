import type { AnswerChoiceAction, ChoiceDef } from './def.ts';

/** The correct option, straight from `def`. */
export function choiceSolution(def: ChoiceDef): readonly AnswerChoiceAction[] {
  return [{ type: 'answer-choice', optionId: def.answer }];
}

/** Any option other than the answer: exactly 1 error, then still answerable. */
export function choiceWrongAction(def: ChoiceDef): readonly AnswerChoiceAction[] {
  const wrong = def.options.find((option) => option.id !== def.answer);
  if (wrong === undefined) {
    throw new Error(`choice "${def.id}": no option other than the answer`);
  }
  return [{ type: 'answer-choice', optionId: wrong.id }];
}

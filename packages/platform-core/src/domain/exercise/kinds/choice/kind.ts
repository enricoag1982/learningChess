import { deriveAnswerOutcome } from '../../answer.ts';
import type { AnswerOutcome } from '../../answer.ts';
import type { ExerciseKind } from '../../kind.ts';
import { errorHintStars } from '../../stars.ts';
import type { AnswerChoiceAction, ChoiceDefBase, ChoiceHint, ChoiceState } from './def.ts';
import { answerChoice, choiceHint } from './engine.ts';

/** The `choice` kind for a subject's def and state; `init` builds the subject's fresh state. */
export function createChoiceKind<D extends ChoiceDefBase, S extends ChoiceState<D>, Ctx>(
  init: (def: D) => S,
): ExerciseKind<D, S, AnswerChoiceAction, AnswerOutcome, ChoiceHint, Ctx> {
  return {
    type: 'choice',
    input: 'answer',
    init,

    act(state, action) {
      const next = answerChoice(state, action.optionId);
      return { state: next, outcome: deriveAnswerOutcome(state, next) };
    },

    hint(state, level) {
      return choiceHint({ ...state, hintLevel: level }, level);
    },

    stars(state) {
      return errorHintStars(state.hintLevel, state.errors);
    },
  };
}

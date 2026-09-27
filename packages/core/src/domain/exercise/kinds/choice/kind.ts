import { errorHintStars } from '../../stars.ts';
import { narrowState, widen } from '../adapt.ts';
import { deriveAnswerOutcome } from '../base.ts';
import type { ChessKind } from '../index.ts';
import { initState } from '../../state.ts';
import type { AnswerChoiceAction, AnswerOutcome, ChoiceDef } from './def.ts';
import { answerChoice, choiceHint } from './engine.ts';

export const choiceKind: ChessKind<ChoiceDef, AnswerChoiceAction, AnswerOutcome> = {
  type: 'choice',
  input: 'answer',

  init(def) {
    return initState(def);
  },

  act(state, action) {
    const next = answerChoice(widen(state), action.optionId);
    return { state: narrowState(next), outcome: deriveAnswerOutcome(state, next) };
  },

  hint(state, level) {
    const bumped = { ...state, hintLevel: level };
    const result = choiceHint(widen(bumped), bumped.def, level);
    return { state: narrowState(result.state), hint: result.hint };
  },

  stars(state) {
    return errorHintStars(state.hintLevel, state.errors);
  },
};

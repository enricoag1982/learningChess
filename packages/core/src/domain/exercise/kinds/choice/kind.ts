import { answerChoice, startExercise } from '../../engine.ts';
import { delegateHint, delegateStars, narrowState, widen } from '../adapt.ts';
import { deriveAnswerOutcome } from '../base.ts';
import type { ChessKind } from '../index.ts';
import type { AnswerChoiceAction, AnswerOutcome, ChoiceDef } from './def.ts';
import { choiceSolution, choiceWrongAction } from './solution.ts';

export const choiceKind: ChessKind<ChoiceDef, AnswerChoiceAction, AnswerOutcome> = {
  type: 'choice',
  input: 'answer',

  init(def) {
    return narrowState(startExercise(def));
  },

  act(state, action) {
    const next = answerChoice(widen(state), action.optionId);
    return { state: narrowState(next), outcome: deriveAnswerOutcome(state, next) };
  },

  hint(state, level, ctx) {
    return delegateHint(state, ctx);
  },

  stars(state) {
    return delegateStars(state);
  },

  solution(def) {
    return choiceSolution(def);
  },

  wrongAction(def) {
    return choiceWrongAction(def);
  },
};

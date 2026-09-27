import { answerYesNo, startExercise } from '../../engine.ts';
import { delegateHint, delegateStars, narrowState, widen } from '../adapt.ts';
import { deriveAnswerOutcome } from '../base.ts';
import type { ChessKind } from '../index.ts';
import type { AnswerOutcome, AnswerYesNoAction, YesNoDef } from './def.ts';
import { yesNoSolution, yesNoWrongAction } from './solution.ts';

export const yesNoKind: ChessKind<YesNoDef, AnswerYesNoAction, AnswerOutcome> = {
  type: 'yes-no',
  input: 'answer',

  init(def) {
    return narrowState(startExercise(def));
  },

  act(state, action) {
    const next = answerYesNo(widen(state), action.value);
    return { state: narrowState(next), outcome: deriveAnswerOutcome(state, next) };
  },

  hint(state, level, ctx) {
    return delegateHint(state, ctx);
  },

  stars(state) {
    return delegateStars(state);
  },

  solution(def) {
    return yesNoSolution(def);
  },

  wrongAction(def) {
    return yesNoWrongAction(def);
  },
};

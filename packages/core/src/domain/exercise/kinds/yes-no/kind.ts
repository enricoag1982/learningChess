import { startExercise } from '../../engine.ts';
import { errorHintStars } from '../../stars.ts';
import { narrowState, widen } from '../adapt.ts';
import { deriveAnswerOutcome } from '../base.ts';
import type { ChessKind } from '../index.ts';
import type { AnswerOutcome, AnswerYesNoAction, YesNoDef } from './def.ts';
import { answerYesNo, yesNoHint } from './engine.ts';
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

  hint(state, level) {
    const bumped = { ...state, hintLevel: level };
    return { state: bumped, hint: yesNoHint(bumped.def, level) };
  },

  stars(state) {
    return errorHintStars(state.hintLevel, state.errors);
  },

  solution(def) {
    return yesNoSolution(def);
  },

  wrongAction(def) {
    return yesNoWrongAction(def);
  },
};

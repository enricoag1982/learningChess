import { errorHintStars } from '../../stars.ts';
import { narrowState, widen } from '../adapt.ts';
import { deriveAnswerOutcome } from '../base.ts';
import type { AnswerOutcome } from '../base.ts';
import type { ChessKind } from '../index.ts';
import { initState } from '../../state.ts';
import type { YesNoDef } from '../../types.ts';
import { answerYesNo, yesNoHint } from './engine.ts';

export type { YesNoDef } from '../../types.ts';
export type { AnswerOutcome };

export interface AnswerYesNoAction {
  readonly type: 'answer-yes-no';
  readonly value: boolean;
}

export const yesNoKind: ChessKind<YesNoDef, AnswerYesNoAction, AnswerOutcome> = {
  type: 'yes-no',
  input: 'answer',

  init(def) {
    return initState(def);
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
};

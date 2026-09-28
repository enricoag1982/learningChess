import { errorHintStars } from '@learn/platform-core/domain/exercise/stars';
import { deriveAnswerOutcome } from '../base.ts';
import type { AnswerOutcome } from '../base.ts';
import type { ChessKind } from '../index.ts';
import { initState } from '../../core/exercise/state.ts';
import type { YesNoDef } from '../../core/exercise/types.ts';
import { answerYesNo, yesNoHint } from './engine.ts';

export type { YesNoDef } from '../../core/exercise/types.ts';
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
    const next = answerYesNo(state, action.value);
    return { state: next, outcome: deriveAnswerOutcome(state, next) };
  },

  hint(state, level) {
    const bumped = { ...state, hintLevel: level };
    return { state: bumped, hint: yesNoHint(bumped.def, level) };
  },

  stars(state) {
    return errorHintStars(state.hintLevel, state.errors);
  },
};

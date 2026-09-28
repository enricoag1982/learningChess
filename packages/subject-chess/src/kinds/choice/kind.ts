import { errorHintStars } from '@learn/platform-core/domain/exercise/stars';
import { deriveAnswerOutcome } from '../base.ts';
import type { AnswerOutcome } from '../base.ts';
import type { ChessKind } from '../index.ts';
import { initState } from '../../core/exercise/state.ts';
import type { ChoiceDef } from '../../core/exercise/types.ts';
import { answerChoice, choiceHint } from './engine.ts';

export type { ChoiceDef, ChoiceOption } from '../../core/exercise/types.ts';
export type { AnswerOutcome };

export interface AnswerChoiceAction {
  readonly type: 'answer-choice';
  readonly optionId: string;
}

export const choiceKind: ChessKind<ChoiceDef, AnswerChoiceAction, AnswerOutcome> = {
  type: 'choice',
  input: 'answer',

  init(def) {
    return initState(def);
  },

  act(state, action) {
    const next = answerChoice(state, action.optionId);
    return { state: next, outcome: deriveAnswerOutcome(state, next) };
  },

  hint(state, level) {
    const bumped = { ...state, hintLevel: level };
    const result = choiceHint(bumped, bumped.def, level);
    return { state: result.state, hint: result.hint };
  },

  stars(state) {
    return errorHintStars(state.hintLevel, state.errors);
  },
};

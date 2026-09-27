import type { AnswerOutcome } from '../base.ts';

export type { ChoiceDef, ChoiceOption } from '../../types.ts';
export type { AnswerOutcome };

export interface AnswerChoiceAction {
  readonly type: 'answer-choice';
  readonly optionId: string;
}

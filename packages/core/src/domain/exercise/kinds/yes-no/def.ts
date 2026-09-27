import type { AnswerOutcome } from '../base.ts';

export type { YesNoDef } from '../../types.ts';
export type { AnswerOutcome };

export interface AnswerYesNoAction {
  readonly type: 'answer-yes-no';
  readonly value: boolean;
}

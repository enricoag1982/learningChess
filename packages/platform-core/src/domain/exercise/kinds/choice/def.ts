import type { ExerciseDefBase, HintBase } from '../../../subject.ts';
import type { ExerciseProgress } from '../../kind.ts';

/** One pickable option: a subject adds its own visual (a piece, a value) beside `textKey`. */
export interface ChoiceOptionBase {
  readonly id: string;
  readonly textKey?: string;
}

/** Pick the option whose id is `answer`. */
export interface ChoiceDefBase<
  O extends ChoiceOptionBase = ChoiceOptionBase,
> extends ExerciseDefBase {
  readonly type: 'choice';
  readonly options: readonly O[];
  readonly answer: string;
}

export interface ChoiceState<D extends ChoiceDefBase = ChoiceDefBase> extends ExerciseProgress {
  readonly def: D;
  /** Option ids ruled out (wrong pick or hint-removed); disabled in the UI. */
  readonly wrongOptions?: readonly string[];
}

export interface AnswerChoiceAction {
  readonly type: 'answer-choice';
  readonly optionId: string;
}

export interface ChoiceHint extends HintBase {
  readonly kind: 'choice';
  readonly removedOptionId?: string;
  readonly reveal: boolean;
}

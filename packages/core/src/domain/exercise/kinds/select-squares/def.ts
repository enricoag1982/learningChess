import type { Square } from '../../../chess/types.ts';

export type { SelectSquaresDef } from '../../types.ts';

/** Result of a select-squares submission. */
export interface SelectionResult {
  readonly correct: boolean;
  /** Count of answer squares not selected. */
  readonly missing: number;
  /** Answer squares not selected (shown as "still missing" after a wrong check). */
  readonly missingSquares: readonly Square[];
  /** Selected squares that are not part of the answer. */
  readonly wrong: readonly Square[];
}

export interface ToggleAction {
  readonly type: 'toggle';
  readonly square: Square;
}

export interface SubmitAction {
  readonly type: 'submit';
}

export type SelectSquaresAction = ToggleAction | SubmitAction;

/** Result of a select-squares action. */
export type SelectOutcome =
  { readonly kind: 'toggled' } | { readonly kind: 'checked'; readonly result: SelectionResult };

import type { Square } from '../../../chess/types.ts';
import type { SelectionResult } from '../../engine.ts';

export type { SelectSquaresDef } from '../../types.ts';
export type { SelectionResult };

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

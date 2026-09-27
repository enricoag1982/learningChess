import type { Square } from '../../../chess/types.ts';
import type { ExerciseState } from '../../engine.ts';
import type { Hint } from '../../hint.ts';

/** Answers a yes-no exercise. Correct → solved; wrong → errors + 1. No-op once solved. */
export function answerYesNo(state: ExerciseState, value: boolean): ExerciseState {
  if (state.def.type !== 'yes-no') {
    throw new Error('answerYesNo: exercise is not yes-no');
  }
  if (state.solved) {
    return state;
  }
  if (value === state.def.answer) {
    return { ...state, solved: true };
  }
  return { ...state, errors: state.errors + 1 };
}

export function yesNoHint(def: { readonly focus?: Square }, level: 1 | 2 | 3): Hint {
  const squares = def.focus === undefined ? [] : [def.focus];
  if (level === 1) {
    return { kind: 'yes-no', level: 1, squares, reveal: false };
  }
  if (level === 2) {
    return { kind: 'yes-no', level: 2, squares: [], reveal: false };
  }
  return { kind: 'yes-no', level: 3, squares, reveal: true };
}

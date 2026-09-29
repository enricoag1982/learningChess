import type { MathExerciseDef, MathState } from './types.ts';

/** A fresh state; every math kind's `init`. */
export function initMathState<D extends MathExerciseDef>(def: D): MathState<D> {
  return { def, moves: 0, solved: false, errors: 0, hintLevel: 0, entry: '' };
}

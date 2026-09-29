import type { Position, Square } from '../chess/types.ts';
import type { ExerciseProgress } from '@learn/platform-core/domain/exercise/kind';
import type { ExerciseDef } from './types.ts';

export interface ExerciseStateOf<D> extends ExerciseProgress {
  readonly def: D;
  readonly position: Position;
  /** Positions before each played move, for `undo`. */
  readonly history: readonly Position[];
  /** Kid moves played (collect-stars / capture / best-move only). */
  readonly moves: number;
  /** Currently selected squares (select-squares only). */
  readonly selected: readonly Square[];
  /** Option ids ruled out for a `choice` exercise (wrong pick or hint-removed); disabled in UI. */
  readonly wrongOptions?: readonly string[];
}

export type ExerciseState = ExerciseStateOf<ExerciseDef>;

/** A fresh state at `def`'s authored position; every kind's `init` calls it. */
export function initState<D extends { readonly position: Position }>(def: D): ExerciseStateOf<D> {
  return {
    def,
    position: def.position,
    history: [],
    moves: 0,
    selected: [],
    errors: 0,
    hintLevel: 0,
    solved: false,
    wrongOptions: [],
  };
}

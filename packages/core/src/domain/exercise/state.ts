import type { Position, Square } from '../chess/types.ts';
import type { ExerciseProgress } from './kind.ts';

/** Immutable exercise progress, `def`'s own type carried through. */
export interface ExerciseStateOf<D> extends ExerciseProgress {
  readonly def: D;
  /** Current position. */
  readonly position: Position;
  /** Positions before each played move, for `undo`. */
  readonly history: readonly Position[];
  /** Kid moves played (collect-stars / capture / best-move only). */
  readonly moves: number;
  /** Currently selected squares (select-squares only). */
  readonly selected: readonly Square[];
  /**
   * Option ids ruled out for a `choice` exercise (wrong pick or hint-removed); disabled in UI.
   * Optional (defaults to none) so existing `ExerciseState` literals elsewhere stay valid.
   */
  readonly wrongOptions?: readonly string[];
}

/**
 * Builds a fresh `ExerciseStateOf<D>` at `def`'s own authored position. Every kind's `init` calls
 * this directly (not `engine.ts`'s `startExercise`, which dispatches back through the kind — this
 * is the one non-dispatching implementation that dispatch bottoms out at).
 */
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

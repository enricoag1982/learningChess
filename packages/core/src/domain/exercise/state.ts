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

import type { ExerciseDefBase, ExerciseStateBase } from '../../../subject.ts';

/** A `series` mini-game: fixed exercise rounds (any kind) scored on total mistakes across rounds.
 * Generic over the subject's def shape `E`. */
export interface SeriesGameDef<E extends ExerciseDefBase = ExerciseDefBase> {
  readonly id: string;
  readonly concept: string;
  readonly rounds: readonly E[];
  /** Total mistakes (errors + hint levels, summed across every round) at/under which 3 stars are earned. */
  readonly errors3: number;
  /** …2 stars threshold; `errors2 >= errors3`. Above it, still 1 star once every round is done. */
  readonly errors2: number;
}

export interface SeriesGameState<E extends ExerciseDefBase = ExerciseDefBase> {
  readonly mode: 'series';
  readonly def: SeriesGameDef<E>;
  readonly roundIndex: number;
  readonly round: ExerciseStateBase<E>;
  /** Mistakes (errors + hint level) folded in from every round completed so far. */
  readonly mistakes: number;
  readonly done: boolean;
}

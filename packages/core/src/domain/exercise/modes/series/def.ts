import type { ExerciseState } from '../../state.ts';
import type { ExerciseDef } from '../../types.ts';

/**
 * A `series` mini-game's content (Square Hunt, Setup Race, and M3's Safe or Not? / Escape the
 * Check / Mate in 1): a fixed sequence of exercise rounds, of any exercise type, scored on total
 * mistakes across all rounds rather than a single win condition.
 */
export interface SeriesGameDef {
  readonly id: string;
  readonly concept: string;
  readonly rounds: readonly ExerciseDef[];
  /** Total mistakes (errors + hint levels, summed across every round) at/under which 3 stars are earned. */
  readonly errors3: number;
  /** …2 stars threshold; `errors2 >= errors3`. Above it, still 1 star once every round is done. */
  readonly errors2: number;
}

/** Immutable series mini-game progress: one round played at a time via the normal exercise engine. */
export interface SeriesGameState {
  readonly mode: 'series';
  readonly def: SeriesGameDef;
  readonly roundIndex: number;
  /** Current (or, once `done`, last) round's exercise state. */
  readonly round: ExerciseState;
  /** Mistakes (errors + hint level) folded in from every round completed so far. */
  readonly mistakes: number;
  readonly done: boolean;
}

import { startExercise } from '../../kinds/index.ts';
import type { ExerciseState } from '../../state.ts';
import type { ExerciseDef } from '../../types.ts';
import type { SeriesGameDef, SeriesGameState } from './def.ts';

/** Starts a fresh series at its first round. */
export function startSeries(def: SeriesGameDef): SeriesGameState {
  const firstRound = def.rounds[0];
  if (firstRound === undefined) {
    throw new Error('startSeries: def.rounds is empty');
  }
  return {
    mode: 'series',
    def,
    roundIndex: 0,
    round: startExercise(firstRound),
    mistakes: 0,
    done: false,
  };
}

/** The exercise definition for the round currently (or, once `done`, last) in play. */
export function currentRound(state: SeriesGameState): ExerciseDef {
  return state.def.rounds[state.roundIndex] ?? state.round.def;
}

/**
 * Folds a solved round's mistakes (errors + hint level; hints are allowed but count as mistakes,
 * same as a wrong try) into the series total, then advances to the next round, or marks the series
 * `done` after the last one. `roundState` must be the current round's `solved` exercise state.
 */
export function completeRound(state: SeriesGameState, roundState: ExerciseState): SeriesGameState {
  const mistakes = state.mistakes + roundState.errors + roundState.hintLevel;
  const nextIndex = state.roundIndex + 1;
  const nextDef = state.def.rounds[nextIndex];
  if (nextDef === undefined) {
    return { ...state, round: roundState, mistakes, done: true };
  }
  return { ...state, roundIndex: nextIndex, round: startExercise(nextDef), mistakes, done: false };
}

/** Current series status: `playing` until every round is complete. */
export function seriesResult(state: SeriesGameState): 'playing' | 'won' {
  return state.done ? 'won' : 'playing';
}

/** Stars for a finished series: total mistakes ≤ `errors3` → 3, ≤ `errors2` → 2, else 1 (finished). */
export function seriesStars(state: SeriesGameState): 0 | 1 | 2 | 3 {
  if (!state.done) {
    return 0;
  }
  if (state.mistakes <= state.def.errors3) {
    return 3;
  }
  if (state.mistakes <= state.def.errors2) {
    return 2;
  }
  return 1;
}

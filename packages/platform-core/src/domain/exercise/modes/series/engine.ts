import type { AnyKind, ExerciseDefBase, ExerciseStateBase } from '../../../subject.ts';
import type { SeriesGameDef, SeriesGameState } from './def.ts';

export function startSeries<E extends ExerciseDefBase>(
  def: SeriesGameDef<E>,
  kinds: Readonly<Record<string, AnyKind<unknown>>>,
): SeriesGameState<E> {
  const firstRound = def.rounds[0];
  if (firstRound === undefined) {
    throw new Error('startSeries: def.rounds is empty');
  }
  return {
    mode: 'series',
    def,
    roundIndex: 0,
    round: kinds[firstRound.type]?.init(firstRound) as ExerciseStateBase<E>,
    mistakes: 0,
    done: false,
  };
}

export function currentRound<E extends ExerciseDefBase>(state: SeriesGameState<E>): E {
  return state.def.rounds[state.roundIndex] ?? state.round.def;
}

/** Folds a solved round's mistakes (errors + hint level) into the series total, then advances or marks `done`.
 * `roundState` must be the current, `solved` round. */
export function completeRound<E extends ExerciseDefBase>(
  state: SeriesGameState<E>,
  roundState: ExerciseStateBase<E>,
  kinds: Readonly<Record<string, AnyKind<unknown>>>,
): SeriesGameState<E> {
  const mistakes = state.mistakes + roundState.errors + roundState.hintLevel;
  const nextIndex = state.roundIndex + 1;
  const nextDef = state.def.rounds[nextIndex];
  if (nextDef === undefined) {
    return { ...state, round: roundState, mistakes, done: true };
  }
  return {
    ...state,
    roundIndex: nextIndex,
    round: kinds[nextDef.type]?.init(nextDef) as ExerciseStateBase<E>,
    mistakes,
    done: false,
  };
}

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

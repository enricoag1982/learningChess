import type { MiniGameMode } from '../../mode.ts';
import type { AnyKind, ExerciseDefBase } from '../../../subject.ts';
import type { SeriesGameDef, SeriesGameState } from './def.ts';
import { seriesResult, seriesStars, startSeries } from './engine.ts';

/** Builds the `series` mini-game mode over `kinds` — subject-free: any subject's exercise kinds
 * drive a round, not just chess's. */
export function createSeriesMode<E extends ExerciseDefBase = ExerciseDefBase>(
  kinds: Readonly<Record<string, AnyKind<unknown>>>,
): MiniGameMode<SeriesGameDef<E>, SeriesGameState<E>> {
  return {
    mode: 'series',

    start(def) {
      return startSeries(def, kinds);
    },

    isOver(state) {
      return state.done;
    },

    isWin(state) {
      return seriesResult(state) === 'won';
    },

    stars(state) {
      return seriesStars(state);
    },

    summarise(state) {
      return {
        conceptId: state.def.concept,
        stars: seriesStars(state),
        correct: state.mistakes === 0,
        // A series' mistakes already fold errors and hint levels together per round; logged as
        // `errors` (there is no single hint level to report once several rounds are involved).
        hints: 0,
        errors: state.mistakes,
        moves: state.def.rounds.length,
      };
    },
  };
}

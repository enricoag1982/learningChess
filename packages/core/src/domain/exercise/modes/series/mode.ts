import type { MiniGameMode } from '../../mode.ts';
import type { SeriesGameDef, SeriesGameState } from './def.ts';
import { seriesResult, seriesStars, startSeries } from './engine.ts';

export const seriesMode: MiniGameMode<SeriesGameDef, SeriesGameState> = {
  mode: 'series',

  start(def) {
    return startSeries(def);
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

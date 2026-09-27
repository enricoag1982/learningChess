import type { MiniGameMode } from '../../mode.ts';
import type { VersusGameDef, VersusState } from './def.ts';
import { kidMoveCount, startVersus, versusStars } from './engine.ts';

export const versusMode: MiniGameMode<VersusGameDef, VersusState> = {
  mode: 'versus',

  start(def) {
    return startVersus(def);
  },

  isOver(state) {
    return state.status !== 'playing';
  },

  isWin(state) {
    return state.status === 'won';
  },

  stars(state) {
    return versusStars(state);
  },

  summarise(state) {
    // No hints or wrong tries in a versus boss (it is a real game against the bot, not a scored
    // exercise): "correct" is simply a win, and "errors" has no equivalent — logged as 0.
    return {
      conceptId: state.def.concept,
      stars: versusStars(state),
      correct: state.status === 'won',
      hints: 0,
      errors: 0,
      moves: kidMoveCount(state),
    };
  },
};

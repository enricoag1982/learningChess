import type { MiniGameMode } from '@learn/platform-core/domain/exercise/mode';
import type { GameState, StaticCaptureGameDef } from './def.ts';
import { gameResult, gameStars, startStaticCaptureGame } from './engine.ts';

export const staticMode: MiniGameMode<StaticCaptureGameDef, GameState> = {
  mode: 'static',

  start(def) {
    return startStaticCaptureGame(def);
  },

  isOver(state) {
    return gameResult(state) !== 'playing';
  },

  isWin(state) {
    return gameResult(state) === 'won';
  },

  stars(state) {
    return gameStars(state);
  },

  summarise(state) {
    const { exercise } = state;
    return {
      conceptId: state.def.concept,
      stars: gameStars(state),
      correct: exercise.solved && exercise.errors === 0 && exercise.hintLevel === 0,
      hints: exercise.hintLevel,
      errors: exercise.errors,
      moves: exercise.moves,
    };
  },
};

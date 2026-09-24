import type { GameState, SeriesGameState } from './minigame.ts';
import { gameResult, gameStars, seriesResult, seriesStars } from './minigame.ts';
import type { VersusState } from './versus.ts';
import { kidMoveCount, versusStars } from './versus.ts';

/** The attempt-log fields a boss/mini-game result reduces to, whichever mode played it. */
export interface BossResultSummary {
  readonly conceptId: string;
  readonly stars: 0 | 1 | 2 | 3;
  readonly correct: boolean;
  readonly hints: number;
  readonly errors: number;
  readonly moves: number;
}

/**
 * Reduces any boss/mini-game state (`static`, `series`, `versus`) to its attempt-log fields.
 * Shared by a lesson's boss (`recordBossResult`) and the Play screen's standalone session
 * (`recordMiniGameResult`) — same mini-game modes, same fields either way.
 */
export function summarizeBossResult(
  state: GameState | SeriesGameState | VersusState,
): BossResultSummary {
  if (state.mode === 'series') {
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
  }
  if (state.mode === 'versus') {
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
  }
  const { exercise } = state;
  return {
    conceptId: state.def.concept,
    stars: gameStars(state),
    correct: exercise.solved && exercise.errors === 0 && exercise.hintLevel === 0,
    hints: exercise.hintLevel,
    errors: exercise.errors,
    moves: exercise.moves,
  };
}

/**
 * True when the boss/mini-game ended in a win, whichever mode played it. A finished `series`
 * always counts (it has no losing state, only a mistake count); `static`/`versus` only on an
 * actual win (not "ended"/"lost"/"draw").
 */
export function isBossResultWin(state: GameState | SeriesGameState | VersusState): boolean {
  if (state.mode === 'series') {
    return seriesResult(state) === 'won';
  }
  if (state.mode === 'versus') {
    return state.status === 'won';
  }
  return gameResult(state) === 'won';
}

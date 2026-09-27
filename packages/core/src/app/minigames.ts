import type { GameState } from '../domain/exercise/modes/static/def.ts';
import type { SeriesGameState } from '../domain/exercise/modes/series/def.ts';
import { versusGameState } from '../domain/exercise/modes/versus/engine.ts';
import type { VersusState } from '../domain/exercise/modes/versus/def.ts';
import type { MiniGame } from '../domain/lesson.ts';
import type { MiniGameProgress } from '../domain/progress.ts';
import { recordMiniGamePlay } from '../domain/progress.ts';
import { isStandardStart } from '../domain/chess/facts/start.ts';
import { recordGame, versusGameRecordResult } from './games.ts';
import { checkRewards } from './rewards.ts';
import type { AppDeps } from './use-cases.ts';

/** `GameRecord.game` for a `versus` mini-game: `'full'` when it is a full standard game (kings,
 * standard start position), the same id the Play screen's "Full game" flow records; else its own id. */
function gameRecordId(state: VersusState): string {
  const { def } = state;
  return def.rules.kings && isStandardStart(def.position) ? 'full' : def.id;
}

/** All saved mini-game progress for a profile (Play screen's best-stars tiles). */
export async function loadMiniGameProgress(
  deps: AppDeps,
  profileId: string,
): Promise<MiniGameProgress[]> {
  return deps.progress.listMiniGames(profileId);
}

/** Result of playing one mini-game, from the Play screen or as a lesson's boss. */
export interface RecordMiniGameResultInput {
  readonly profileId: string;
  readonly game: MiniGame;
  readonly state: GameState | SeriesGameState | VersusState;
  readonly durationMs: number;
}

/** Keeps the profile's best stars / plays / wins for a mini-game, without recording an `Attempt`.
 * `recordBossResult` uses it for a lesson's own boss, so the Play tile reflects both routes. */
export async function saveMiniGamePlay(
  deps: AppDeps,
  input: Omit<RecordMiniGameResultInput, 'durationMs'>,
): Promise<MiniGameProgress> {
  const { profileId, game, state } = input;
  const now = deps.clock.now();
  const mode = deps.subject.modes[state.mode];
  if (mode === undefined) {
    throw new Error(`saveMiniGamePlay: no mode registered for "${state.mode}"`);
  }
  const summary = mode.summarise(state);
  const existing = await deps.progress.getMiniGame(profileId, game.id);
  const updated = recordMiniGamePlay(
    existing,
    deps.ids.next(),
    profileId,
    game.id,
    summary.stars,
    mode.isWin(state),
    now,
  );
  await deps.progress.saveMiniGame(updated);

  // A `versus` play also gets its own `GameRecord`; `static`/`series` mini-games have no computer
  // opponent to record one against.
  if (state.mode === 'versus') {
    const { result, reason } = versusGameRecordResult(state);
    await recordGame(deps, {
      profileId,
      game: gameRecordId(state),
      opponentLevel: state.def.opponentLevel,
      result,
      reason,
      moves: versusGameState(state).history.map((move) => move.san),
    });
  } else {
    // static/series finishes have no GameRecord, so this is their only "game finished" check.
    await checkRewards(deps, profileId);
  }

  return updated;
}

/** Records one mini-game played from the Play screen: an `Attempt` with `scored: false` (outside
 * its lesson it never counts towards mastery) plus the best stars / plays / wins. */
export async function recordMiniGameResult(
  deps: AppDeps,
  input: RecordMiniGameResultInput,
): Promise<MiniGameProgress> {
  const { profileId, game, state, durationMs } = input;
  const now = deps.clock.now();
  const mode = deps.subject.modes[state.mode];
  if (mode === undefined) {
    throw new Error(`recordMiniGameResult: no mode registered for "${state.mode}"`);
  }
  const summary = mode.summarise(state);

  await deps.progress.addAttempt({
    id: deps.ids.next(),
    profileId,
    lessonId: game.unlockAfter,
    exerciseId: game.id,
    conceptId: summary.conceptId,
    scored: false,
    correct: summary.correct,
    stars: summary.stars,
    hints: summary.hints,
    errors: summary.errors,
    moves: summary.moves,
    durationMs,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });

  return saveMiniGamePlay(deps, { profileId, game, state });
}

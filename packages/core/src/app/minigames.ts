import { isBossResultWin, summarizeBossResult } from '../domain/exercise/boss-result.ts';
import type { GameState, SeriesGameState } from '../domain/exercise/minigame.ts';
import type { VersusState } from '../domain/exercise/versus.ts';
import type { MiniGame } from '../domain/lesson.ts';
import type { MiniGameProgress } from '../domain/progress.ts';
import { recordMiniGamePlay } from '../domain/progress.ts';
import type { AppDeps } from './use-cases.ts';

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

/**
 * Keeps the profile's best stars / plays / wins for a mini-game (rewards.md §2 "Play" tile),
 * without recording an `Attempt`. `recordBossResult` uses it for a lesson's own boss (the lesson
 * already records that attempt), so the Play tile reflects both routes to the same mini-game.
 */
export async function saveMiniGamePlay(
  deps: AppDeps,
  input: Omit<RecordMiniGameResultInput, 'durationMs'>,
): Promise<MiniGameProgress> {
  const { profileId, game, state } = input;
  const now = deps.clock.now();
  const summary = summarizeBossResult(state);
  const existing = await deps.progress.getMiniGame(profileId, game.id);
  const updated = recordMiniGamePlay(
    existing,
    deps.ids.next(),
    profileId,
    game.id,
    summary.stars,
    isBossResultWin(state),
    now,
  );
  await deps.progress.saveMiniGame(updated);
  return updated;
}

/**
 * Records one mini-game played from the Play screen: an `Attempt` with `scored: false` (outside
 * its lesson it never counts towards mastery) plus the best stars / plays / wins.
 */
export async function recordMiniGameResult(
  deps: AppDeps,
  input: RecordMiniGameResultInput,
): Promise<MiniGameProgress> {
  const { profileId, game, state, durationMs } = input;
  const now = deps.clock.now();
  const summary = summarizeBossResult(state);

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

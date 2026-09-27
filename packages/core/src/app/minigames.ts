import type { MiniGameBase, MiniGameStateBase } from '../domain/subject.ts';
import type { MiniGameProgress } from '../domain/progress.ts';
import { recordMiniGamePlay } from '../domain/progress.ts';
import { checkRewards } from './rewards.ts';
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
  readonly game: MiniGameBase;
  readonly state: MiniGameStateBase;
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

  // The subject's own GameRecord for this mode/state (chess: versus only — static/series have no
  // computer opponent to log against); `null` just needs the generic "finished" reward check.
  const gameRecordInput = deps.subject.gameRecordOf?.(game, state);
  if (gameRecordInput === undefined || gameRecordInput === null) {
    await checkRewards(deps, profileId);
  } else {
    const nowIso = now.toISOString();
    await deps.gameRecords.add({
      id: deps.ids.next(),
      profileId,
      ...gameRecordInput,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    if (gameRecordInput.result !== 'abandoned') {
      await checkRewards(deps, profileId);
    }
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

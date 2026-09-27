import type { BadgeFacts, EarnedBadge } from '../domain/badges.ts';
import { evaluateBadges, newEarnedBadge } from '../domain/badges.ts';
import { chessJsRules } from '../domain/chess/chessjs-rules.ts';
import { parseFen } from '../domain/chess/fen.ts';
import type { Attempt, GameRecord, LessonProgress } from '../domain/progress.ts';
import { totalStars } from '../domain/progress.ts';
import { addMinutes, lastNDays, totalMinutesForDate } from '../domain/session-log.ts';
import type { SessionLog } from '../domain/session-log.ts';
import type { Streak } from '../domain/streak.ts';
import { localDayString, newStreak, recordActivityDay } from '../domain/streak.ts';
import { getOrCreateDeviceId } from './device.ts';
import type { Journey } from './journey.ts';
import { loadJourney } from './journey.ts';
import type { RewardsRepository } from './ports.ts';
import type { AppDeps } from './use-cases.ts';

/** `deps.rewards`, or a clear error if this `AppDeps` has not wired it up (see `checkRewards` for
 * the permissive, no-op entry point every use case actually calls). */
function requireRewards(deps: AppDeps): RewardsRepository {
  if (deps.rewards === undefined) {
    throw new Error('AppDeps.rewards is not wired up');
  }
  return deps.rewards;
}

/** Lessons with 3 stars on every exercise; boss stars don't count. */
function perfectLessonsCount(journey: Journey, progresses: readonly LessonProgress[]): number {
  const progressByLesson = new Map(progresses.map((progress) => [progress.lessonId, progress]));
  let count = 0;
  for (const lesson of journey.lessons) {
    if (lesson.exercises.length === 0) continue;
    const progress = progressByLesson.get(lesson.id);
    const allThreeStars = lesson.exercises.every(
      (exercise) => (progress?.bestStars[exercise.id] ?? 0) === 3,
    );
    if (allThreeStars) count += 1;
  }
  return count;
}

/** `'world:<id>'` / `'track:<id>'` for every mastered world/track, from `Journey.worlds`. */
function masteredScopes(journey: Journey): ReadonlySet<string> {
  const scopes = new Set<string>();
  const worldsByTrack = new Map<string, boolean[]>();
  for (const { world, status } of journey.worlds) {
    if (status === 'mastered') scopes.add(`world:${world.id}`);
    const list = worldsByTrack.get(world.track) ?? [];
    list.push(status === 'mastered');
    worldsByTrack.set(world.track, list);
  }
  for (const [trackId, statuses] of worldsByTrack) {
    if (statuses.length > 0 && statuses.every(Boolean)) scopes.add(`track:${trackId}`);
  }
  return scopes;
}

interface ConceptFacts {
  readonly correctTotal: Readonly<Record<string, number>>;
  readonly correctInARow: Readonly<Record<string, number>>;
  readonly noHintsInARow: Readonly<Record<string, number>>;
}

/** Per-concept lifetime/streak facts, from every scored `Attempt` (lesson or review alike), oldest
 * first within each concept. */
function conceptFacts(attempts: readonly Attempt[]): ConceptFacts {
  const byConcept = new Map<string, Attempt[]>();
  for (const attempt of attempts) {
    if (!attempt.scored) continue;
    const list = byConcept.get(attempt.conceptId) ?? [];
    list.push(attempt);
    byConcept.set(attempt.conceptId, list);
  }

  const correctTotal: Record<string, number> = {};
  const correctInARow: Record<string, number> = {};
  const noHintsInARow: Record<string, number> = {};

  for (const [conceptId, list] of byConcept) {
    const sorted = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    let total = 0;
    let trailingCorrect = 0;
    let trailingNoHints = 0;
    for (const attempt of sorted) {
      if (attempt.correct) total += 1;
      trailingCorrect = attempt.correct ? trailingCorrect + 1 : 0;
      const solvedNoHint = attempt.stars > 0 && attempt.hints === 0;
      trailingNoHints = solvedNoHint ? trailingNoHints + 1 : 0;
    }
    correctTotal[conceptId] = total;
    correctInARow[conceptId] = trailingCorrect;
    noHintsInARow[conceptId] = trailingNoHints;
  }

  return { correctTotal, correctInARow, noHintsInARow };
}

interface GameFacts {
  readonly gameWins: Readonly<Record<string, number>>;
  readonly gameEvents: { promotion: number; castling: number };
  readonly localGamesPlayed: number;
}

// Win/event facts from GameRecords, abandoned games excluded. gameWins.any/['computer:<n>'] count
// only full games; a mini-game win counts only under its own id. gameEvents.castling counts games
// with >= 1 castling move (a game, not a move); reads GameRecord.moves directly, both sides alike.
function gameFacts(records: readonly GameRecord[]): GameFacts {
  const nonAbandoned = records.filter((record) => record.result !== 'abandoned');
  const gameWins: Record<string, number> = { any: 0 };
  for (const record of nonAbandoned.filter((r) => r.result === 'win')) {
    if (record.game === 'full') {
      gameWins.any = (gameWins.any ?? 0) + 1;
      gameWins[record.opponent] = (gameWins[record.opponent] ?? 0) + 1;
    } else {
      gameWins[record.game] = (gameWins[record.game] ?? 0) + 1;
    }
  }

  let promotion = 0;
  let castling = 0;
  for (const record of nonAbandoned) {
    let castledThisGame = false;
    for (const san of record.moves) {
      if (san.includes('=')) promotion += 1;
      if (san.startsWith('O-O')) castledThisGame = true;
    }
    if (castledThisGame) castling += 1;
  }

  const localGamesPlayed = nonAbandoned.filter(
    (record) => record.opponent === 'guest' || record.opponent.startsWith('profile:'),
  ).length;

  return { gameWins, gameEvents: { promotion, castling }, localGamesPlayed };
}

/** Standard chess start position, castling rights included (same as `FullGameScreen`'s `START_FEN`). */
const STANDARD_START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** True if the opponent ever captured this profile's queen while replaying `moves` from the
 * standard start. Only meaningful for a full game. An unreplayable move stops the scan. */
function queenCapturedByOpponent(moves: readonly string[], color: 'w' | 'b'): boolean {
  let position = parseFen(STANDARD_START_FEN);
  for (const san of moves) {
    const played = chessJsRules.play(position, san);
    if (played === null) return false;
    if (played.move.color !== color && played.move.captured === 'q') {
      return true;
    }
    position = played.position;
  }
  return false;
}

/** Every fact `evaluateBadges` needs, freshly derived from stored profile data + the current
 * `Journey` (the domain engine itself stays pure, `domain/badges.ts`). */
export async function buildBadgeFacts(
  deps: AppDeps,
  profileId: string,
  journey: Journey,
  streakCurrent: number,
): Promise<BadgeFacts> {
  const [progresses, attempts, records] = await Promise.all([
    deps.progress.listLessons(profileId),
    deps.progress.listAttempts(profileId),
    deps.gameRecords.listByProfile(profileId),
  ]);

  const { correctTotal, correctInARow, noHintsInARow } = conceptFacts(attempts);
  const { gameWins, gameEvents, localGamesPlayed } = gameFacts(records);
  const queenKeptWins = records.filter(
    (record) =>
      record.game === 'full' &&
      record.result === 'win' &&
      !queenCapturedByOpponent(record.moves, record.color ?? 'w'),
  ).length;

  return {
    masteredScopes: masteredScopes(journey),
    starsTotal: totalStars(progresses),
    perfectLessons: perfectLessonsCount(journey, progresses),
    conceptCorrectTotal: correctTotal,
    conceptCorrectInARow: correctInARow,
    conceptNoHintsInARow: noHintsInARow,
    gameWins,
    queenKeptWins,
    gameEvents,
    localGamesPlayed,
    streakCurrent,
    warmupsCompleted: attempts.filter(
      (attempt) => attempt.review === true && attempt.reviewSource === 'warmup',
    ).length,
    comebackCount: attempts.filter(
      (attempt) => attempt.scored && attempt.stars > 0 && attempt.errors >= 2,
    ).length,
  };
}

/** Evaluates `deps.content.badges()` against fresh facts and persists every newly earned tier. */
export async function evaluateAndRecordBadges(
  deps: AppDeps,
  profileId: string,
  journey: Journey,
  streakCurrent: number,
  now: Date,
): Promise<readonly EarnedBadge[]> {
  const defs = deps.content.badges?.() ?? [];
  if (defs.length === 0) {
    return [];
  }
  const rewards = requireRewards(deps);
  const [facts, earned] = await Promise.all([
    buildBadgeFacts(deps, profileId, journey, streakCurrent),
    rewards.listEarnedBadges(profileId),
  ]);
  const newlyEarned = evaluateBadges(defs, facts, earned);

  const saved: EarnedBadge[] = [];
  for (const { badgeId, tier } of newlyEarned) {
    const badge = newEarnedBadge(deps.ids.next(), profileId, badgeId, tier, now);
    await rewards.addEarnedBadge(badge);
    saved.push(badge);
  }
  return saved;
}

/** Folds today's local calendar day into the profile's streak. */
export async function recordDailyActivity(
  deps: AppDeps,
  profileId: string,
  now: Date,
): Promise<Streak> {
  const rewards = requireRewards(deps);
  const existing = await rewards.getStreak(profileId);
  const streak = existing ?? newStreak(deps.ids.next(), profileId, now);
  const updated = recordActivityDay(streak, localDayString(now), now);
  if (updated !== streak) {
    await rewards.saveStreak(updated);
  }
  return updated;
}

/** Adds `minutes` to today's `SessionLog` row for this profile. */
export async function recordSessionMinutes(
  deps: AppDeps,
  profileId: string,
  minutes: number,
  now: Date,
): Promise<SessionLog> {
  const rewards = requireRewards(deps);
  const date = localDayString(now);
  const [existing, deviceId] = await Promise.all([
    rewards.getSessionLog(profileId, date),
    getOrCreateDeviceId(deps),
  ]);
  const log = addMinutes(existing, deps.ids.next(), profileId, date, minutes, now, deviceId);
  await rewards.saveSessionLog(log);
  return log;
}

/** One local calendar day's played minutes (`minutesByDay`'s own result row). */
export interface DayMinutes {
  readonly date: string;
  readonly minutes: number;
}

/** A profile's played minutes for the last `days` local calendar days, oldest first, ending today.
 * Each day sums every device's row for that date (`totalMinutesForDate`). `0` without `deps.rewards`
 * wired up, same reasoning as `checkRewards`'s own early return. */
export async function minutesByDay(
  deps: AppDeps,
  profileId: string,
  days: number,
): Promise<readonly DayMinutes[]> {
  const now = deps.clock.now();
  const dayStrings = lastNDays(now, days);
  if (deps.rewards === undefined) {
    return dayStrings.map((date) => ({ date, minutes: 0 }));
  }
  const logs = await deps.rewards.listSessionLogs(profileId);
  return dayStrings.map((date) => ({ date, minutes: totalMinutesForDate(logs, date) }));
}

/** Stars earned today (sum of every scored `Attempt.stars`, local day) — the "See you tomorrow"
 * screen's celebratory line. Not deduplicated against `bestStars`: a fun daily tally, not a formal one. */
export async function starsToday(deps: AppDeps, profileId: string, now: Date): Promise<number> {
  const attempts = await deps.progress.listAttempts(profileId);
  const today = localDayString(now);
  return attempts
    .filter((attempt) => attempt.scored && localDayString(new Date(attempt.createdAt)) === today)
    .reduce((sum, attempt) => sum + attempt.stars, 0);
}

/** Outcome of {@link checkRewards}: the streak after today's activity, and any newly earned badges. */
export interface RewardsCheckResult {
  readonly streak: Streak;
  readonly newBadges: readonly EarnedBadge[];
}

/** The one call every "activity" choke point makes: folds today into the streak, then evaluates and
 * persists any newly earned badge/tier. Idempotent — a second call for the same event finds
 * nothing new. No-ops (empty result) without `deps.rewards`; badges alone no-op without
 * `deps.content.catalog()`, the streak still counts either way. */
export async function checkRewards(deps: AppDeps, profileId: string): Promise<RewardsCheckResult> {
  const now = deps.clock.now();
  if (deps.rewards === undefined) {
    return { streak: newStreak('', profileId, now), newBadges: [] };
  }

  const streak = await recordDailyActivity(deps, profileId, now);
  if (deps.content.catalog?.() === undefined) {
    return { streak, newBadges: [] };
  }

  const journey = await loadJourney(deps, profileId);
  const newBadges = await evaluateAndRecordBadges(deps, profileId, journey, streak.current, now);
  return { streak, newBadges };
}

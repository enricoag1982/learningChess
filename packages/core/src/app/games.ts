import type { BotLevel } from '../domain/bot/levels.ts';
import type { VersusState } from '../domain/exercise/versus.ts';
import { versusEndReason } from '../domain/exercise/versus.ts';
import type { GameRecord, GameRecordResult } from '../domain/progress.ts';
import type { Journey } from './journey.ts';
import type { AppDeps } from './use-cases.ts';

/** Result + reason for a `GameRecord`, from a `VersusState` that has already ended. */
export function versusGameRecordResult(state: VersusState): {
  readonly result: GameRecordResult;
  readonly reason: string;
} {
  const reason = versusEndReason(state) ?? state.status;
  if (state.status === 'won') return { result: 'win', reason };
  if (state.status === 'lost') return { result: 'loss', reason };
  if (state.status === 'draw') return { result: 'draw', reason };
  throw new Error('versusGameRecordResult: game is still in progress');
}

export interface RecordGameInput {
  readonly profileId: string;
  /** `'full'` for a full standard game, else a `versus` mini-game's content id. */
  readonly game: string;
  readonly opponentLevel: number;
  readonly result: GameRecordResult;
  readonly reason: string;
  readonly moves: readonly string[];
}

/** Saves one `GameRecord` (domain-model.md §2): a finished full game / versus mini-game, or a left one. */
export async function recordGame(deps: AppDeps, input: RecordGameInput): Promise<GameRecord> {
  const { profileId, game, opponentLevel, result, reason, moves } = input;
  const now = deps.clock.now().toISOString();
  const record: GameRecord = {
    id: deps.ids.next(),
    profileId,
    game,
    opponent: `computer:${String(opponentLevel)}`,
    result,
    reason,
    moves,
    createdAt: now,
    updatedAt: now,
  };
  await deps.gameRecords.add(record);
  return record;
}

/** This profile's saved game records (newest and oldest alike; callers filter/sort as needed). */
export function loadGameRecords(deps: AppDeps, profileId: string): Promise<GameRecord[]> {
  return deps.gameRecords.listByProfile(profileId);
}

/** A locked computer level's unlock condition, for the Play screen's vs Computer card. */
export type ComputerLevelCondition =
  | { readonly kind: 'world-mastered'; readonly worldId: string }
  | { readonly kind: 'beat'; readonly level: BotLevel['name']; readonly times: number };

/** One bot level's Play-screen status: locked (+ condition) or unlocked, with its full-game tally. */
export interface ComputerLevelStatus {
  readonly level: BotLevel['level'];
  readonly name: BotLevel['name'];
  readonly locked: boolean;
  /** Set iff `locked`. */
  readonly condition?: ComputerLevelCondition;
  readonly wins: number;
  readonly games: number;
}

const LEVEL_NAMES: readonly BotLevel['name'][] = ['mouse', 'rabbit', 'fox', 'wolf', 'bear'];

/** Full games ("game: 'full'", not mini-games) played vs `level`, excluding abandoned ones. */
function fullGameTally(
  records: readonly GameRecord[],
  level: number,
): { readonly wins: number; readonly games: number } {
  const opponent = `computer:${String(level)}`;
  const relevant = records.filter(
    (record) =>
      record.game === 'full' && record.opponent === opponent && record.result !== 'abandoned',
  );
  return {
    wins: relevant.filter((record) => record.result === 'win').length,
    games: relevant.length,
  };
}

/**
 * Per-level status for the Play screen's vs Computer card (`docs/computer-opponent.md` §3). Mouse
 * unlocks with World 4 ("check") mastered — the same rule as the pre-M3.5 "Full game" button
 * (`app-structure.md` §7). Every level above it unlocks with 3 full-game wins vs the level right
 * below (Rabbit vs Mouse, Fox vs Rabbit, Wolf vs Fox, Bear vs Wolf) — *or*, once there is already
 * any recorded full-game win directly against this level, it stays unlocked regardless of that
 * count (M4.2 decision log): covers a world boss fought directly at a level before the kid has
 * separately racked up 3 Play-screen wins one level down (e.g. World 5's boss vs Rabbit, ahead of
 * Fox's own "beat Rabbit 3x") — an early win like that should never show as "locked" again just
 * because the strict tally has not caught up. Fox's other M4.2 unlock path, the Openings world's
 * own boss, is content not yet authored (`docs/computer-opponent.md` §3's "or … later"); once it
 * exists it is just one more full-game win recorded against Fox, already covered by this same rule.
 */
export function computerLevelStatus(
  records: readonly GameRecord[],
  journey: Journey,
): readonly ComputerLevelStatus[] {
  const worldFourMastered =
    journey.worlds.find((entry) => entry.world.id === 'check')?.status === 'mastered';

  return LEVEL_NAMES.map((name, index) => {
    const level = (index + 1) as BotLevel['level'];
    const { wins, games } = fullGameTally(records, level);

    if (level === 1) {
      return worldFourMastered
        ? { level, name, locked: false, wins, games }
        : {
            level,
            name,
            locked: true,
            condition: { kind: 'world-mastered', worldId: 'check' },
            wins,
            games,
          };
    }

    const previousName = LEVEL_NAMES[index - 1] ?? 'mouse';
    const beatPrevious = fullGameTally(records, level - 1).wins >= 3;
    const unlocked = beatPrevious || wins >= 1;
    return unlocked
      ? { level, name, locked: false, wins, games }
      : {
          level,
          name,
          locked: true,
          condition: { kind: 'beat', level: previousName, times: 3 },
          wins,
          games,
        };
  });
}

const LAST_N_GAMES = 5;
const LEVEL_UP_MIN_WINS = 4;
const LEVEL_DOWN_MAX_WINS = 1;

/** One update to a profile's "Automatic level" suggestion (`docs/computer-opponent.md` §5), from
 * `nextSuggestedLevel` after a completed full game. `leveledUp` tells the caller whether to show
 * Owl's suggestion line ("Ready for the Fox?") — the drop is silent. */
export interface SuggestedLevelUpdate {
  readonly level: BotLevel['level'];
  readonly leveledUp: boolean;
}

/** Full, non-abandoned games at `level`, most-recent-first (by `createdAt`). */
function recentFullGames(records: readonly GameRecord[], level: number): GameRecord[] {
  const opponent = `computer:${String(level)}`;
  return records
    .filter((record) => record.game === 'full' && record.opponent === opponent)
    .filter((record) => record.result !== 'abandoned')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * The "Automatic level" suggestion update after one full game vs computer at `level` finishes
 * (`docs/computer-opponent.md` §5): among the last `LAST_N_GAMES` full games at `level` (most
 * recent first) — computed only once that many have actually been played, so a single early result
 * cannot swing it — `>= 4` wins suggests the next level, but only when it is already unlocked
 * (`statuses`); `<= 1` win drops one level, silently, never below Mouse. Otherwise `null`: no
 * change. Never skips more than one level either way, since it only ever moves `level` by one.
 */
export function nextSuggestedLevel(
  records: readonly GameRecord[],
  level: BotLevel['level'],
  statuses: readonly ComputerLevelStatus[],
): SuggestedLevelUpdate | null {
  const last = recentFullGames(records, level).slice(0, LAST_N_GAMES);
  if (last.length < LAST_N_GAMES) {
    return null;
  }
  const wins = last.filter((record) => record.result === 'win').length;

  if (wins >= LEVEL_UP_MIN_WINS && level < 5) {
    const next = (level + 1) as BotLevel['level'];
    const nextStatus = statuses.find((status) => status.level === next);
    return nextStatus && !nextStatus.locked ? { level: next, leveledUp: true } : null;
  }
  if (wins <= LEVEL_DOWN_MAX_WINS && level > 1) {
    return { level: (level - 1) as BotLevel['level'], leveledUp: false };
  }
  return null;
}

/** Highest currently unlocked level, for `suggestedLevel`'s fallback (Mouse if somehow none is). */
function highestUnlocked(statuses: readonly ComputerLevelStatus[]): BotLevel['level'] {
  const unlockedLevels = statuses.filter((status) => !status.locked).map((status) => status.level);
  return unlockedLevels.length > 0 ? (Math.max(...unlockedLevels) as BotLevel['level']) : 1;
}

/**
 * Play's vs Computer level chips default to this (`docs/computer-opponent.md` §5): the profile's
 * stored suggestion (`AppSettings.suggestedLevels`), as long as it still names an unlocked level —
 * a level never re-locks (`computerLevelStatus`), so this only ever guards a suggestion from before
 * a level was unlocked at all. No suggestion stored yet (a fresh profile, or one that has not
 * finished 5 full games at any level to earn one — `nextSuggestedLevel`) falls back to the highest
 * level already unlocked, the most relevant default for a kid who just unlocked a new one.
 */
export function suggestedLevel(
  stored: number | undefined,
  statuses: readonly ComputerLevelStatus[],
): BotLevel['level'] {
  if (stored !== undefined) {
    const status = statuses.find((candidate) => candidate.level === stored);
    if (status && !status.locked) {
      return status.level;
    }
  }
  return highestUnlocked(statuses);
}

/**
 * Persists `nextSuggestedLevel`'s update (if any) for `profileId`, folding it into the shared
 * `AppSettings.suggestedLevels` map. Returns the update (or `null`) so the caller can decide
 * whether to show Owl's "Ready for the Fox?" line (`leveledUp`).
 */
export async function updateSuggestedLevel(
  deps: AppDeps,
  profileId: string,
  level: BotLevel['level'],
  records: readonly GameRecord[],
  statuses: readonly ComputerLevelStatus[],
): Promise<SuggestedLevelUpdate | null> {
  const update = nextSuggestedLevel(records, level, statuses);
  if (update === null) {
    return null;
  }
  const settings = await deps.settings.get();
  await deps.settings.save({
    ...settings,
    suggestedLevels: { ...settings.suggestedLevels, [profileId]: update.level },
  });
  return update;
}

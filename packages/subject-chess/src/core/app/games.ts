import { BOT_LEVELS } from '../bot/levels.ts';
import type { BotLevel } from '../bot/levels.ts';
import { isStandardStart } from '../chess/facts/start.ts';
import type { VersusState } from '../../modes/versus/def.ts';
import { versusEndReason, versusGameState } from '../../modes/versus/engine.ts';
import type { GameRecord, GameRecordResult } from '@learn/platform-core/domain/progress';
import type {
  MiniGameBase,
  MiniGameStateBase,
  RecordGameInput,
} from '@learn/platform-core/domain/subject';
import type { Journey } from '@learn/platform-core/app/journey';
import { checkRewards } from '@learn/platform-core/app/rewards';
import type { AppDeps } from '@learn/platform-core/app/use-cases';

export type { RecordGameInput } from '@learn/platform-core/domain/subject';

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

/** `GameRecord.game` for a `versus` mini-game: `'full'` when it is a full standard game (kings,
 * standard start position), the same id the Play screen's "Full game" flow records; else its own id. */
function gameRecordId(state: VersusState): string {
  const { def } = state;
  return def.rules.kings && isStandardStart(def.position) ? 'full' : def.id;
}

/** `SubjectCore.gameRecordOf`: a `versus` mini-game's `GameRecord` (`null` for `static`/`series`,
 * which have no computer opponent to log). `state` is narrowed from `MiniGameStateBase` once
 * `mode` says `'versus'` — same cast pattern `kinds/` uses for its own subject state. */
export function chessGameRecordOf(
  game: MiniGameBase,
  state: MiniGameStateBase,
): Omit<RecordGameInput, 'profileId'> | null {
  if (state.mode !== 'versus') {
    return null;
  }
  const versusState = state as VersusState;
  const { result, reason } = versusGameRecordResult(versusState);
  return {
    game: gameRecordId(versusState),
    opponent: `computer:${String(versusState.def.opponentLevel)}`,
    result,
    reason,
    moves: versusGameState(versusState).history.map((move) => move.san),
  };
}

/** Saves one `GameRecord`: a finished full game / versus mini-game, or a left one. */
export async function recordGame(deps: AppDeps, input: RecordGameInput): Promise<GameRecord> {
  const { profileId, game, opponent, result, reason, moves } = input;
  const now = deps.clock.now().toISOString();
  const record: GameRecord = {
    id: deps.ids.next(),
    profileId,
    game,
    opponent,
    result,
    reason,
    moves,
    createdAt: now,
    updatedAt: now,
  };
  await deps.gameRecords.add(record);

  // An abandoned game is never a real finish: never a win, never a badge/streak check.
  if (result !== 'abandoned') {
    await checkRewards(deps, profileId);
  }

  return record;
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

const LEVEL_NAMES: readonly BotLevel['name'][] = BOT_LEVELS.map((level) => level.name);

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

/** Per-level status for the Play screen's vs Computer card. Mouse unlocks with World 4 ("check")
 * mastered. Every level above unlocks with 3 full-game wins vs the level below, or — once any
 * full-game win is recorded directly against this level — stays unlocked regardless of that count
 * (covers a world boss fought at a level before 3 separate Play-screen wins caught up). */
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

/** One update to a profile's "Automatic level" suggestion, from `nextSuggestedLevel` after a
 * completed full game. `leveledUp` tells the caller whether to show Owl's suggestion line — the
 * drop is silent. */
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

/** The "Automatic level" suggestion update after one full game finishes: among the last
 * `LAST_N_GAMES` full games at `level`, `>= 4` wins suggests the next level (only if unlocked),
 * `<= 1` win drops one level silently (never below Mouse). Otherwise `null`. */
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

/** Play's vs Computer level chips default to this: the profile's stored suggestion, as long as it
 * still names an unlocked level. No suggestion stored yet falls back to the highest unlocked level. */
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

/** Persists `nextSuggestedLevel`'s update (if any) for `profileId`, folding it into the shared
 * `AppSettings.suggestedLevels` map. */
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

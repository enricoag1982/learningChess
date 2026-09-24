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
 * Per-level status for the Play screen's vs Computer card (docs/computer-opponent.md §3, M3 scope:
 * `docs/roadmap.md` M3.5). Mouse unlocks with World 4 ("check") mastered — the same rule as the
 * pre-M3.5 "Full game" button (`app-structure.md` §7); Rabbit with 3 full-game wins vs Mouse. Fox,
 * Wolf and Bear stay locked in M3 — their own unlock rule (an Openings-world alternative for Fox,
 * "beat the previous level 3x" for all three) is M4 work — shown here with their beat-condition so
 * the card can display it now.
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
    if (level === 2) {
      const unlocked = fullGameTally(records, 1).wins >= 3;
      return unlocked
        ? { level, name, locked: false, wins, games }
        : {
            level,
            name,
            locked: true,
            condition: { kind: 'beat', level: 'mouse', times: 3 },
            wins,
            games,
          };
    }
    const previousName = LEVEL_NAMES[index - 1];
    return {
      level,
      name,
      locked: true,
      condition: { kind: 'beat', level: previousName ?? 'mouse', times: 3 },
      wins,
      games,
    };
  });
}

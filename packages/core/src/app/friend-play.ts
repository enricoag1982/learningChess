import type { Color } from '../domain/chess/types.ts';
import type { GameResult } from '../domain/game/types.ts';
import type { Lesson, MiniGame } from '../domain/lesson.ts';
import { unlockedMiniGames } from '../domain/play.ts';
import type { GameRecord, GameRecordResult, LessonProgress } from '../domain/progress.ts';
import { computerLevelStatus } from './games.ts';
import { checkRewards } from './rewards.ts';
import type { Journey } from './journey.ts';
import type { AppDeps } from './use-cases.ts';

/**
 * The second player in a vs Friend match (`docs/app-structure.md` §6): another profile on this
 * device, or a guest — no password, no saved `GameRecord` for them.
 */
export type LocalPlayer =
  { readonly kind: 'profile'; readonly profileId: string } | { readonly kind: 'guest' };

/** One game offered on the vs Friend setup sheet: `'full'` for the full game, else a `versus`
 * mini-game's content id (Pawn Wars, Win the Queen, …), with its content title key. */
export interface FriendGameOption {
  readonly id: string;
  readonly titleKey: string;
}

/**
 * The only mini-game ids vs Friend ever offers (M4.3 decision log "Games"): the standalone Pawn
 * Wars / Win the Queen mini-games, never a lesson- or world-specific reuse of their rules (e.g.
 * World 4's own `first-game` boss, or World 2's `pawn-wars-4` — both `versus` too, but not this
 * list) — those stay vs-computer-only.
 */
const FRIEND_MINI_GAME_IDS: readonly string[] = ['pawn-wars', 'win-the-queen'];

/**
 * Games the active profile may offer a friend (`docs/app-structure.md` §6 "Availability"): the
 * full game once unlocked (World 4 mastered — the same gate `computerLevelStatus`'s Mouse level
 * uses), Pawn Wars once unlocked (after Promotion) and Win the Queen once unlocked (after Trades).
 * Only games already unlocked for this profile are offered; parent unlock is a later milestone.
 */
export function friendGameOptions(
  gameRecords: readonly GameRecord[],
  journey: Journey,
  lessons: readonly Lesson[],
  minigames: readonly MiniGame[],
  progress: readonly LessonProgress[],
): readonly FriendGameOption[] {
  const options: FriendGameOption[] = [];
  const mouse = computerLevelStatus(gameRecords, journey)[0];
  if (mouse && !mouse.locked) {
    options.push({ id: 'full', titleKey: 'play.full-game-title' });
  }
  for (const entry of unlockedMiniGames(lessons, minigames, progress)) {
    if (entry.unlocked && FRIEND_MINI_GAME_IDS.includes(entry.minigame.id)) {
      options.push({ id: entry.minigame.id, titleKey: entry.minigame.titleKey });
    }
  }
  return options;
}

/** Whether a `GameRecord.opponent` names a friend (another profile or a guest), not the computer. */
export function isFriendOpponent(opponent: string): boolean {
  return opponent === 'guest' || opponent.startsWith('profile:');
}

/** This profile's `GameRecord`s played vs a friend (My Den's "Games with friends" count), excluding abandoned ones — same convention as `computerLevelStatus`'s own tally. */
export function friendGamesPlayed(records: readonly GameRecord[]): number {
  return records.filter(
    (record) => isFriendOpponent(record.opponent) && record.result !== 'abandoned',
  ).length;
}

function opponentTag(player: LocalPlayer): string {
  return player.kind === 'guest' ? 'guest' : `profile:${player.profileId}`;
}

/** Per-colour `GameRecord` result + reason, from a finished (or abandoned) `LocalMatchState`. */
function resultFor(
  color: Color,
  outcome: RecordLocalMatchInput['outcome'],
): { readonly result: GameRecordResult; readonly reason: string } {
  if (outcome.kind === 'abandoned') {
    return { result: 'abandoned', reason: 'left' };
  }
  const { result } = outcome;
  if (result.kind === 'draw') {
    return { result: 'draw', reason: result.reason };
  }
  if (result.kind === 'win') {
    return { result: result.winner === color ? 'win' : 'loss', reason: result.reason };
  }
  throw new Error('recordLocalMatch: game is still ongoing');
}

export interface RecordLocalMatchInput {
  /** `'full'` for a full standard game, else the `versus` mini-game's content id. */
  readonly game: string;
  readonly white: LocalPlayer;
  readonly black: LocalPlayer;
  /** The finished game's outcome, or `abandoned` when it was left mid-game ("Stop" confirmed). */
  readonly outcome:
    { readonly kind: 'result'; readonly result: GameResult } | { readonly kind: 'abandoned' };
  /** SAN moves played, in order (both sides). */
  readonly moves: readonly string[];
}

/**
 * Saves one `GameRecord` (domain-model.md §2) per profile involved in a vs Friend match — a guest
 * gets none. No stars, mastery or review effects (M4.3 decision log): this only appends to the
 * game log, same as a vs-computer `recordGame`. `Match` itself is not stored in v1 (decision log);
 * this is the whole of what a finished/left local match leaves behind.
 */
export async function recordLocalMatch(
  deps: AppDeps,
  input: RecordLocalMatchInput,
): Promise<readonly GameRecord[]> {
  const now = deps.clock.now().toISOString();
  const records: GameRecord[] = [];
  for (const [color, self, opponent] of [
    ['w', input.white, input.black],
    ['b', input.black, input.white],
  ] as const) {
    if (self.kind !== 'profile') continue;
    const { result, reason } = resultFor(color, input.outcome);
    records.push({
      id: deps.ids.next(),
      profileId: self.profileId,
      game: input.game,
      opponent: opponentTag(opponent),
      result,
      reason,
      moves: input.moves,
      color,
      createdAt: now,
      updatedAt: now,
    });
  }
  await Promise.all(records.map((record) => deps.gameRecords.add(record)));
  // rewards.md §4 "game finished": Friendly Match, Queen Keeper, … for every profile involved.
  for (const record of records) {
    await checkRewards(deps, record.profileId);
  }
  return records;
}

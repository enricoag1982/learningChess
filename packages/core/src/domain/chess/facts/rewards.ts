// Chess's `SubjectCore.rewards`: the 3 badge condition types the generic engine can't compute on
// its own (game-win, game-event, game-played) — SAN/game-record facts, kept out of `domain/badges.ts`
// (design-r4.md §2 leak #4).
import type { BadgeCondition } from '../../badges.ts';
import type { GameRecord } from '../../progress.ts';
import { chessJsRules } from '../chessjs-rules.ts';
import { parseFen } from '../fen.ts';

/** Standard chess start position, castling rights included (same board `isStandardStart` checks). */
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

/** Chess's own badge facts: win counts, SAN-derived events, local-game count and queen-kept wins —
 * everything `game-win`/`game-event`/`game-played` badge conditions read (`chessConditionValue`). */
export interface ChessRewardFacts {
  /** Win counts keyed like `BadgeCondition.opponent`: `'any'`, `'computer:<n>'`, a mini-game id. */
  readonly gameWins: Readonly<Record<string, number>>;
  /** Wins where the kid's queen was never captured. */
  readonly queenKeptWins: number;
  /** Promotion move count / games-with-a-castle count, across all non-abandoned games. */
  readonly gameEvents: Readonly<{ promotion: number; castling: number }>;
  /** Games played vs a friend (`opponent` starting `profile:`/`guest`). */
  readonly localGamesPlayed: number;
}

/** Derives {@link ChessRewardFacts} from every `GameRecord`, abandoned games excluded.
 * `gameWins.any`/`['computer:<n>']` count only full games; a mini-game win counts only under its
 * own id. `gameEvents.castling` counts games with >= 1 castling move (a game, not a move); reads
 * `GameRecord.moves` directly, both sides alike. */
export function chessRewardFacts(records: readonly GameRecord[]): ChessRewardFacts {
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

  const queenKeptWins = records.filter(
    (record) =>
      record.game === 'full' &&
      record.result === 'win' &&
      !queenCapturedByOpponent(record.moves, record.color ?? 'w'),
  ).length;

  return { gameWins, queenKeptWins, gameEvents: { promotion, castling }, localGamesPlayed };
}

/** `SubjectCore.rewards.conditionValue`: the fact value for chess's 3 game-record badge condition
 * types; `undefined` for any other type (the badge engine's own 7 generic ones). */
export function chessConditionValue(
  condition: BadgeCondition,
  facts: ChessRewardFacts,
): number | undefined {
  switch (condition.type) {
    case 'game-win':
      return condition.extra === 'queen-kept'
        ? facts.queenKeptWins
        : (facts.gameWins[condition.opponent ?? 'any'] ?? 0);
    case 'game-event':
      return facts.gameEvents[condition.event ?? 'promotion'];
    case 'game-played':
      return facts.localGamesPlayed;
    default:
      return undefined;
  }
}

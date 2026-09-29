import type { ChessRules, Move } from '../chess/rules.ts';
import type { GameState } from '../game/types.ts';
import type { Random } from '@learn/platform-core/domain/random';

/** One opening line: SAN moves from the game's own start position, both colours. Whoever is to
 * move at a given ply plays it — a line is just a shared sequence. */
export interface BookLine {
  readonly name: string;
  readonly moves: readonly string[];
}

/** Opening lines for Fox/Wolf/Bear (`BotLevel.book`) while a game follows one; content-owned and passed in so `domain` stays content-free. */
export interface BotBook {
  readonly lines: readonly BookLine[];
}

export const MAX_BOOK_PLIES = 6;

/** Every book move still applying at `state`: one per line whose SAN prefix matches `state.history`, deduplicated, still
 * legal; `[]` past `MAX_BOOK_PLIES` or off every line. */
export function bookCandidates(state: GameState, book: BotBook, rules: ChessRules): Move[] {
  const played = state.history.map((move) => move.san);
  if (played.length >= MAX_BOOK_PLIES) {
    return [];
  }
  let legal: Move[] | undefined;
  const seenSan = new Set<string>();
  const candidates: Move[] = [];
  for (const line of book.lines) {
    if (line.moves.length <= played.length) {
      continue;
    }
    const matches = played.every((san, index) => line.moves[index] === san);
    if (!matches) {
      continue;
    }
    const nextSan = line.moves[played.length];
    if (nextSan === undefined || seenSan.has(nextSan)) {
      continue;
    }
    legal ??= rules.legalMoves(state.position);
    const move = legal.find((candidate) => candidate.san === nextSan);
    if (move === undefined) {
      continue;
    }
    seenSan.add(nextSan);
    candidates.push(move);
  }
  return candidates;
}

/** A book move (uniform among `bookCandidates`, seeded `random`), or `null`; deterministic for the same state + book + seed. */
export function bookMove(
  state: GameState,
  book: BotBook,
  rules: ChessRules,
  random: Random,
): Move | null {
  const candidates = bookCandidates(state, book, rules);
  if (candidates.length === 0) {
    return null;
  }
  const index = Math.min(candidates.length - 1, Math.floor(random.next() * candidates.length));
  return candidates[index] ?? null;
}

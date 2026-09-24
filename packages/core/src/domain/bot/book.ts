import type { ChessRules, Move } from '../chess/rules.ts';
import type { GameState } from '../game/types.ts';
import type { Random } from '../random.ts';

/** One opening line: SAN moves from the game's own start position, both colours (docs/computer-
 * opponent.md §3: "e4 / d4 main lines, ≤ 6 plies"). Whoever is to move at a given ply plays it,
 * regardless of which side the line was "authored for" — a line is just a shared sequence. */
export interface BookLine {
  readonly name: string;
  readonly moves: readonly string[];
}

/** A small set of opening lines (`packages/content/bot-book.yaml`), used by Fox/Wolf/Bear
 * (`BotLevel.book`) while the game is still following one. Content-owned data, passed in rather
 * than imported, so `domain` stays free of a dependency on `@chess-kids/content`. */
export interface BotBook {
  readonly lines: readonly BookLine[];
}

/** Plies within which the book applies (`docs/computer-opponent.md` §3: "≤ 6 plies"). */
export const MAX_BOOK_PLIES = 6;

/**
 * Every book move that still applies at `state`'s current ply: one per line whose SAN prefix
 * matches `state.history` exactly, deduplicated by SAN, and kept only when that move is still
 * legal in the current position — a defensive check, since a `versus` game that does not start
 * from the book's own starting position could otherwise coincide with a line's SAN prefix by pure
 * text accident without reaching the same position. `[]` once `state.history` runs past
 * `MAX_BOOK_PLIES` or strays from every line (the caller then falls back to the normal move choice).
 */
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

/**
 * Picks a book move for `state` (uniformly among `bookCandidates`, via the seeded `random`), or
 * `null` once none applies — the caller then falls back to its normal random / shallow / search
 * roll. Determinism (`docs/computer-opponent.md` §1): same state + book + seed → same move.
 */
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

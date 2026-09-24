import { describe, expect, it } from 'vitest';

import { chessJsRules as rules } from '../chess/chessjs-rules.ts';
import { parseFen } from '../chess/fen.ts';
import { startGame } from '../game/index.ts';
import type { GameRulesDef } from '../game/index.ts';
import { seededRandom } from '../random.ts';
import { bookCandidates, bookMove, MAX_BOOK_PLIES } from './book.ts';
import type { BotBook } from './book.ts';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const STANDARD: GameRulesDef = {
  kings: true,
  checkRules: true,
  noMoves: 'draw',
  win: { w: [{ kind: 'checkmate' }], b: [{ kind: 'checkmate' }] },
};

const BOOK: BotBook = {
  lines: [
    { name: 'e4-italian', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'] },
    { name: 'e4-ruy-lopez', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'] },
    { name: 'd4-slav', moves: ['d4', 'd5', 'c4', 'c6'] },
  ],
};

/** Plays `sans` from the standard start position, returning the resulting `GameState`. */
function stateAfter(...sans: readonly string[]) {
  let state = startGame(STANDARD, parseFen(START_FEN));
  for (const san of sans) {
    const move = rules.legalMoves(state.position).find((candidate) => candidate.san === san);
    if (move === undefined) {
      throw new Error(`test setup error: "${san}" is not legal in this position`);
    }
    const played = rules.play(state.position, move);
    if (played === null) {
      throw new Error(`test setup error: illegal move ${san}`);
    }
    state = {
      ...state,
      position: played.position,
      history: [...state.history, played.move],
      positions: [...state.positions, played.position],
    };
  }
  return state;
}

describe('bookCandidates', () => {
  it('offers the start move(s) from an empty history', () => {
    const state = stateAfter();
    const sans = bookCandidates(state, BOOK, rules)
      .map((move) => move.san)
      .sort();
    expect(sans).toEqual(['d4', 'e4']);
  });

  it('offers every line still matching the position reached so far', () => {
    const state = stateAfter('e4', 'e5', 'Nf3', 'Nc6');
    const sans = bookCandidates(state, BOOK, rules)
      .map((move) => move.san)
      .sort();
    expect(sans).toEqual(['Bb5', 'Bc4']);
  });

  it('narrows to the one line still matching once the position diverges from the rest', () => {
    const state = stateAfter('d4', 'd5', 'c4');
    expect(bookCandidates(state, BOOK, rules).map((move) => move.san)).toEqual(['c6']);
  });

  it('returns nothing once the position leaves every line', () => {
    const state = stateAfter('a4');
    expect(bookCandidates(state, BOOK, rules)).toEqual([]);
  });

  it('returns nothing at or past the ply cap, even mid-line', () => {
    const state = stateAfter('e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5');
    expect(state.history).toHaveLength(MAX_BOOK_PLIES);
    expect(bookCandidates(state, BOOK, rules)).toEqual([]);
  });

  it('dedupes an identical next move offered by more than one line', () => {
    const book: BotBook = {
      lines: [
        { name: 'a', moves: ['e4', 'e5', 'Nf3'] },
        { name: 'b', moves: ['e4', 'e5', 'Nf3', 'Nf6'] },
      ],
    };
    const state = stateAfter('e4', 'e5');
    const sans = bookCandidates(state, book, rules).map((move) => move.san);
    expect(sans).toEqual(['Nf3']);
  });
});

describe('bookMove', () => {
  it('returns null once bookCandidates is empty', () => {
    const state = stateAfter('a4');
    expect(bookMove(state, BOOK, rules, seededRandom(1))).toBeNull();
  });

  it('always returns one of the book candidates', () => {
    const state = stateAfter('e4', 'e5', 'Nf3', 'Nc6');
    const candidateSans = bookCandidates(state, BOOK, rules).map((move) => move.san);
    for (let seed = 0; seed < 20; seed += 1) {
      const move = bookMove(state, BOOK, rules, seededRandom(seed));
      expect(candidateSans).toContain(move?.san);
    }
  });

  it('is deterministic: same state + book + seed picks the same move', () => {
    const state = stateAfter('e4', 'e5', 'Nf3', 'Nc6');
    const first = bookMove(state, BOOK, rules, seededRandom(7));
    const second = bookMove(state, BOOK, rules, seededRandom(7));
    expect(second).toEqual(first);
  });

  it('eventually offers every candidate across seeds when there is more than one', () => {
    const state = stateAfter('e4', 'e5', 'Nf3', 'Nc6');
    const seen = new Set<string | undefined>();
    for (let seed = 0; seed < 30; seed += 1) {
      seen.add(bookMove(state, BOOK, rules, seededRandom(seed))?.san);
    }
    expect(seen).toEqual(new Set(['Bc4', 'Bb5']));
  });
});

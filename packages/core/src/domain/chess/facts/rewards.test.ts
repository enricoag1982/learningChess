import { describe, expect, it } from 'vitest';

import type { GameRecord } from '../../progress.ts';
import { chessConditionValue, chessRewardFacts } from './rewards.ts';

const NOW = new Date('2026-01-01T00:00:00.000Z');

function record(overrides: Partial<GameRecord> & Pick<GameRecord, 'id'>): GameRecord {
  return {
    profileId: 'p1',
    game: 'full',
    opponent: 'computer:1',
    result: 'win',
    reason: 'checkmate',
    moves: [],
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe('chessRewardFacts', () => {
  it('splits game wins: "any"/opponent only from full games, mini-game wins under their own id', () => {
    const records: GameRecord[] = [
      record({ id: 'g1', game: 'full', opponent: 'computer:1', result: 'win' }),
      record({ id: 'g2', game: 'pawn-wars', opponent: 'computer:1', result: 'win' }),
      record({ id: 'g3', game: 'full', opponent: 'computer:2', result: 'abandoned' }),
    ];
    const facts = chessRewardFacts(records);

    expect(facts.gameWins.any).toBe(1);
    expect(facts.gameWins['computer:1']).toBe(1);
    expect(facts.gameWins['computer:2']).toBeUndefined();
    expect(facts.gameWins['pawn-wars']).toBe(1);
  });

  it('counts promotion moves and castled games from SAN, ignoring abandoned games', () => {
    const records: GameRecord[] = [
      record({ id: 'g1', moves: ['e4', 'e5', 'O-O', 'a6', 'b8=Q'] }),
      record({ id: 'g2', result: 'abandoned', reason: 'left', moves: ['O-O-O', 'a8=Q'] }),
    ];
    const facts = chessRewardFacts(records);

    expect(facts.gameEvents.promotion).toBe(1);
    expect(facts.gameEvents.castling).toBe(1);
  });

  it("detects the kid keeping the queen (Scholar's mate: Black never gets to capture it)", () => {
    const kept = record({
      id: 'g1',
      moves: ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7'],
    });
    expect(chessRewardFacts([kept]).queenKeptWins).toBe(1);
  });

  it('detects the kid losing the queen (Black captures it with Nxe5)', () => {
    const lost = record({
      id: 'g2',
      moves: ['e4', 'e5', 'Qh5', 'Nc6', 'Qxe5', 'Nxe5'],
    });
    expect(chessRewardFacts([lost]).queenKeptWins).toBe(0);
  });

  it("replays from the profile's own colour: Black keeps its queen when White loses one", () => {
    // Friend game (M4.3): the profile played Black and won; White's queen was captured (by Black),
    // Black's never was.
    const blackWin = record({
      id: 'g3',
      opponent: 'profile:p2',
      moves: ['e4', 'e5', 'Qh5', 'Nc6', 'Qxe5+', 'Nxe5'],
      color: 'b',
    });
    expect(chessRewardFacts([blackWin]).queenKeptWins).toBe(1);
  });

  it('local games (guest / profile:<id> opponent) count towards localGamesPlayed', () => {
    const records: GameRecord[] = [
      record({ id: 'g1', opponent: 'guest' }),
      record({ id: 'g2', opponent: 'profile:p2' }),
      record({ id: 'g3', opponent: 'computer:1' }),
    ];
    expect(chessRewardFacts(records).localGamesPlayed).toBe(2);
  });
});

describe('chessConditionValue', () => {
  const facts = chessRewardFacts([
    record({ id: 'g1', opponent: 'computer:1', moves: ['e4', 'e5', 'O-O'] }),
  ]);

  it('game-win: extra "queen-kept" reads queenKeptWins regardless of opponent', () => {
    expect(
      chessConditionValue({ type: 'game-win', extra: 'queen-kept', thresholds: [1] }, facts),
    ).toBe(1);
  });

  it('game-win: opponent keys into gameWins', () => {
    expect(
      chessConditionValue({ type: 'game-win', opponent: 'computer:1', thresholds: [1] }, facts),
    ).toBe(1);
    expect(
      chessConditionValue({ type: 'game-win', opponent: 'computer:2', thresholds: [1] }, facts),
    ).toBe(0);
  });

  it('game-event reads the named event count', () => {
    expect(
      chessConditionValue({ type: 'game-event', event: 'castling', thresholds: [1] }, facts),
    ).toBe(1);
  });

  it('game-played reads localGamesPlayed', () => {
    expect(chessConditionValue({ type: 'game-played', thresholds: [1] }, facts)).toBe(0);
  });

  it("any other condition type is undefined (the badge engine's own 7)", () => {
    expect(chessConditionValue({ type: 'stars-total', thresholds: [1] }, facts)).toBeUndefined();
  });
});

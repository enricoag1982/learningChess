import { describe, expect, it } from 'vitest';

import type { BadgeDef, BadgeFacts, EarnedBadge } from './badges.ts';
import { evaluateBadges, markSeen, newEarnedBadge } from './badges.ts';

const NOW = new Date('2026-01-01T00:00:00.000Z');

const EMPTY_FACTS: BadgeFacts = {
  masteredScopes: new Set(),
  starsTotal: 0,
  perfectLessons: 0,
  conceptCorrectTotal: {},
  conceptCorrectInARow: {},
  conceptNoHintsInARow: {},
  gameWins: {},
  queenKeptWins: 0,
  gameEvents: { promotion: 0, castling: 0 },
  localGamesPlayed: 0,
  streakCurrent: 0,
  warmupsCompleted: 0,
  comebackCount: 0,
};

function def(id: string, overrides: Partial<BadgeDef['condition']>): BadgeDef {
  return {
    id,
    category: 'skill',
    nameKey: `rewards:badges.${id}.name`,
    conditionKey: `rewards:badges.${id}.condition`,
    condition: { type: 'stars-total', thresholds: [1], ...overrides },
  };
}

describe('evaluateBadges', () => {
  it('earns a single-tier badge once its fact value reaches the threshold', () => {
    const defs = [def('star-collector', { type: 'stars-total', thresholds: [50] })];
    const below = evaluateBadges(defs, { ...EMPTY_FACTS, starsTotal: 49 }, []);
    expect(below).toEqual([]);

    const at = evaluateBadges(defs, { ...EMPTY_FACTS, starsTotal: 50 }, []);
    expect(at).toEqual([{ badgeId: 'star-collector', tier: undefined }]);
  });

  it('names tiers bronze/silver/gold in threshold order, earning every tier reached at once', () => {
    const defs = [def('star-collector', { type: 'stars-total', thresholds: [50, 150, 400] })];
    const earned = evaluateBadges(defs, { ...EMPTY_FACTS, starsTotal: 200 }, []);
    expect(earned).toEqual([
      { badgeId: 'star-collector', tier: 'bronze' },
      { badgeId: 'star-collector', tier: 'silver' },
    ]);
  });

  it('never re-earns a tier already in `earned`', () => {
    const defs = [def('star-collector', { type: 'stars-total', thresholds: [50, 150] })];
    const earned: EarnedBadge[] = [newEarnedBadge('e1', 'p1', 'star-collector', 'bronze', NOW)];
    const result = evaluateBadges(defs, { ...EMPTY_FACTS, starsTotal: 200 }, earned);
    expect(result).toEqual([{ badgeId: 'star-collector', tier: 'silver' }]);
  });

  it('a fact value dropping later does not unearn an already-earned tier (rewards.md "nothing lost")', () => {
    const defs = [def('daily-player', { type: 'streak-days', thresholds: [3, 7] })];
    const earned: EarnedBadge[] = [
      newEarnedBadge('e1', 'p1', 'daily-player', 'bronze', NOW),
      newEarnedBadge('e2', 'p1', 'daily-player', 'silver', NOW),
    ];
    // Streak reset back to 1: nothing new to earn, and evaluateBadges itself never removes.
    const result = evaluateBadges(defs, { ...EMPTY_FACTS, streakCurrent: 1 }, earned);
    expect(result).toEqual([]);
  });

  it('mastered: true only for a scope present in masteredScopes', () => {
    const defs = [
      def('board-explorer', { type: 'mastered', scope: 'world:board', thresholds: [1] }),
    ];
    const notYet = evaluateBadges(defs, EMPTY_FACTS, []);
    expect(notYet).toEqual([]);
    const mastered = evaluateBadges(
      defs,
      { ...EMPTY_FACTS, masteredScopes: new Set(['world:board']) },
      [],
    );
    expect(mastered).toEqual([{ badgeId: 'board-explorer', tier: undefined }]);
  });

  it('concept-correct: inARow reads the in-a-row fact, noHints the no-hints fact, else the lifetime total', () => {
    const inARow = def('sharp-eyes', {
      type: 'concept-correct',
      concept: 'hanging-piece',
      inARow: true,
      thresholds: [10],
    });
    const noHints = def('escape-artist', {
      type: 'concept-correct',
      concept: 'check-escape',
      noHints: true,
      thresholds: [10],
    });
    const total = def('mate-master', {
      type: 'concept-correct',
      concept: 'mate-in-1',
      thresholds: [10],
    });
    const facts: BadgeFacts = {
      ...EMPTY_FACTS,
      conceptCorrectInARow: { 'hanging-piece': 10 },
      conceptNoHintsInARow: { 'check-escape': 3 },
      conceptCorrectTotal: { 'mate-in-1': 10 },
    };
    expect(evaluateBadges([inARow], facts, [])).toEqual([
      { badgeId: 'sharp-eyes', tier: undefined },
    ]);
    expect(evaluateBadges([noHints], facts, [])).toEqual([]);
    expect(evaluateBadges([total], facts, [])).toEqual([
      { badgeId: 'mate-master', tier: undefined },
    ]);
  });

  it('game-win: extra "queen-kept" reads queenKeptWins regardless of opponent', () => {
    const badge = def('queen-keeper', { type: 'game-win', extra: 'queen-kept', thresholds: [1] });
    expect(evaluateBadges([badge], { ...EMPTY_FACTS, queenKeptWins: 1 }, [])).toEqual([
      { badgeId: 'queen-keeper', tier: undefined },
    ]);
  });

  it('game-win: opponent keys into gameWins', () => {
    const badge = def('mouse-tamer', {
      type: 'game-win',
      opponent: 'computer:1',
      thresholds: [1],
    });
    const facts = { ...EMPTY_FACTS, gameWins: { 'computer:1': 1, 'computer:2': 0 } };
    expect(evaluateBadges([badge], facts, [])).toEqual([
      { badgeId: 'mouse-tamer', tier: undefined },
    ]);
  });

  it('game-event reads the named event count', () => {
    const promo = def('butterfly-maker', {
      type: 'game-event',
      event: 'promotion',
      thresholds: [10],
    });
    const castle = def('castle-builder', {
      type: 'game-event',
      event: 'castling',
      thresholds: [5],
    });
    const facts = { ...EMPTY_FACTS, gameEvents: { promotion: 10, castling: 4 } };
    expect(evaluateBadges([promo], facts, [])).toEqual([
      { badgeId: 'butterfly-maker', tier: undefined },
    ]);
    expect(evaluateBadges([castle], facts, [])).toEqual([]);
  });

  it('evaluates every def in catalogue order, independent of each other', () => {
    const defs = [
      def('a', { type: 'stars-total', thresholds: [1] }),
      def('b', { type: 'stars-total', thresholds: [1000] }),
      def('c', { type: 'comeback', thresholds: [1] }),
    ];
    const result = evaluateBadges(defs, { ...EMPTY_FACTS, starsTotal: 5, comebackCount: 1 }, []);
    expect(result.map((entry) => entry.badgeId)).toEqual(['a', 'c']);
  });
});

describe('newEarnedBadge / markSeen', () => {
  it('starts unseen; markSeen flips it once and is a no-op afterwards', () => {
    const badge = newEarnedBadge('e1', 'p1', 'first-win', undefined, NOW);
    expect(badge.seen).toBe(false);
    expect(badge.tier).toBeUndefined();

    const seen = markSeen(badge, new Date('2026-01-02T00:00:00.000Z'));
    expect(seen.seen).toBe(true);
    expect(seen.updatedAt).toBe('2026-01-02T00:00:00.000Z');

    const still = markSeen(seen, new Date('2026-01-03T00:00:00.000Z'));
    expect(still).toBe(seen);
  });

  it('sets tier when given one', () => {
    const badge = newEarnedBadge('e1', 'p1', 'star-collector', 'gold', NOW);
    expect(badge.tier).toBe('gold');
  });
});

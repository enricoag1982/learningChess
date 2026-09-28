import { describe, expect, it } from 'vitest';

import { isoWeekKey, localDayString, newStreak, recordActivityDay } from './streak.ts';

const NOW = new Date('2026-01-01T00:00:00.000Z');

describe('localDayString', () => {
  it('formats a local calendar day, zero-padded', () => {
    expect(localDayString(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(localDayString(new Date(2026, 8, 9, 0, 0))).toBe('2026-09-09');
  });
});

describe('isoWeekKey', () => {
  it('agrees with known ISO week numbers', () => {
    // 2026-01-01 is a Thursday -> ISO week 1 of 2026.
    expect(isoWeekKey('2026-01-01')).toBe('2026-W1');
    // 2025-12-29 (Monday) is ISO week 1 of 2026 too (the week containing Jan 1).
    expect(isoWeekKey('2025-12-29')).toBe('2026-W1');
    // 2025-12-28 (Sunday) belongs to the last ISO week of 2025.
    expect(isoWeekKey('2025-12-28')).toBe('2025-W52');
  });

  it('puts consecutive days of the same week under the same key, and Monday under a new one', () => {
    expect(isoWeekKey('2026-01-05')).toBe(isoWeekKey('2026-01-08')); // Mon .. Thu
    expect(isoWeekKey('2026-01-04')).not.toBe(isoWeekKey('2026-01-05')); // Sun -> Mon
  });
});

describe('recordActivityDay', () => {
  it('the first activity day starts the streak at 1', () => {
    const streak = recordActivityDay(newStreak('s1', 'p1', NOW), '2026-01-05', NOW);
    expect(streak.current).toBe(1);
    expect(streak.best).toBe(1);
    expect(streak.lastDay).toBe('2026-01-05');
  });

  it('the same day again is a no-op', () => {
    const first = recordActivityDay(newStreak('s1', 'p1', NOW), '2026-01-05', NOW);
    const again = recordActivityDay(first, '2026-01-05', NOW);
    expect(again).toBe(first);
  });

  it('the very next day extends the streak', () => {
    let streak = recordActivityDay(newStreak('s1', 'p1', NOW), '2026-01-05', NOW);
    streak = recordActivityDay(streak, '2026-01-06', NOW);
    expect(streak.current).toBe(2);
    expect(streak.best).toBe(2);
  });

  it('best never drops below a previous peak once the streak later resets', () => {
    let streak = recordActivityDay(newStreak('s1', 'p1', NOW), '2026-01-05', NOW);
    streak = recordActivityDay(streak, '2026-01-06', NOW);
    streak = recordActivityDay(streak, '2026-01-07', NOW);
    expect(streak.current).toBe(3);
    // Jump 5 days ahead: well past a bridgeable single-day gap -> restarts at 1.
    streak = recordActivityDay(streak, '2026-01-12', NOW);
    expect(streak.current).toBe(1);
    expect(streak.best).toBe(3);
  });

  it('a single missed day is bridged by the free weekly skip (streak keeps climbing)', () => {
    // Mon .. Tue, both within the same ISO week (2026-01-05 is a Monday).
    let streak = recordActivityDay(newStreak('s1', 'p1', NOW), '2026-01-05', NOW);
    streak = recordActivityDay(streak, '2026-01-06', NOW); // Tue, current = 2
    // Skip Wed, back on Thu: bridged by the free skip.
    streak = recordActivityDay(streak, '2026-01-08', NOW); // Thu
    expect(streak.current).toBe(3);
    expect(streak.skipsUsedThisWeek).toBe(1);
  });

  it('a second missed day in the same ISO week is not bridged (no skip left): restarts at 1', () => {
    let streak = recordActivityDay(newStreak('s1', 'p1', NOW), '2026-01-05', NOW); // Mon
    streak = recordActivityDay(streak, '2026-01-07', NOW); // Wed (skip Tue) -> bridged, current 2
    expect(streak.current).toBe(2);
    expect(streak.skipsUsedThisWeek).toBe(1);
    // Skip Thu too, back Fri: same ISO week, no skip left -> restart.
    streak = recordActivityDay(streak, '2026-01-09', NOW); // Fri
    expect(streak.current).toBe(1);
  });

  it('the weekly skip resets once a new ISO week starts', () => {
    let streak = recordActivityDay(newStreak('s1', 'p1', NOW), '2026-01-05', NOW); // Mon (week 2)
    streak = recordActivityDay(streak, '2026-01-07', NOW); // Wed (skip Tue) -> bridged, uses week 2's skip
    expect(streak.skipsUsedThisWeek).toBe(1);
    // Next week: Mon 2026-01-12, then skip Tue, back Wed 2026-01-14 -> bridged again (fresh week).
    streak = recordActivityDay(streak, '2026-01-12', NOW); // Mon (week 3) -> extends (gap=5 from Wed? no)
    // (the jump above intentionally breaks the streak; what matters here is the skip counter reset)
    expect(streak.skipsUsedThisWeek).toBe(0);
    streak = recordActivityDay(streak, '2026-01-14', NOW); // Wed (skip Tue) -> bridged again
    expect(streak.skipsUsedThisWeek).toBe(1);
  });

  it('broken streak restarts at 1 silently (no error, no special flag)', () => {
    let streak = recordActivityDay(newStreak('s1', 'p1', NOW), '2026-01-05', NOW);
    streak = recordActivityDay(streak, '2026-02-01', NOW);
    expect(streak.current).toBe(1);
    expect(streak.best).toBe(1);
  });
});

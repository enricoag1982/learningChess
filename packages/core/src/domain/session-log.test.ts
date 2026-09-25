import { describe, expect, it } from 'vitest';

import { addMinutes, lastNDays, newSessionLog } from './session-log.ts';

const NOW = new Date('2026-01-01T00:00:00.000Z');

describe('addMinutes', () => {
  it('starts a fresh row when there is none yet', () => {
    const log = addMinutes(undefined, 'l1', 'p1', '2026-01-05', 12, NOW);
    expect(log).toEqual(newSessionLog('l1', 'p1', '2026-01-05', 12, NOW));
  });

  it('sums minutes into an existing same-day row', () => {
    const first = addMinutes(undefined, 'l1', 'p1', '2026-01-05', 12, NOW);
    const later = new Date('2026-01-05T12:00:00.000Z');
    const second = addMinutes(first, 'l1', 'p1', '2026-01-05', 8, later);
    expect(second.minutes).toBe(20);
    expect(second.id).toBe('l1');
    expect(second.updatedAt).toBe(later.toISOString());
  });
});

describe('lastNDays', () => {
  it('returns the last N local calendar days, oldest first, ending today', () => {
    expect(lastNDays(new Date(2026, 0, 10), 5)).toEqual([
      '2026-01-06',
      '2026-01-07',
      '2026-01-08',
      '2026-01-09',
      '2026-01-10',
    ]);
  });

  it('returns a single day for days: 1', () => {
    expect(lastNDays(new Date(2026, 0, 10), 1)).toEqual(['2026-01-10']);
  });

  it('returns [] for days <= 0', () => {
    expect(lastNDays(new Date(2026, 0, 10), 0)).toEqual([]);
    expect(lastNDays(new Date(2026, 0, 10), -3)).toEqual([]);
  });

  it('crosses a month/year boundary correctly', () => {
    expect(lastNDays(new Date(2026, 0, 2), 4)).toEqual([
      '2025-12-30',
      '2025-12-31',
      '2026-01-01',
      '2026-01-02',
    ]);
  });
});

import { describe, expect, it } from 'vitest';

import { DEFAULT_PROFILE_SETTINGS } from './profile-settings.ts';
import {
  addMinutes,
  extraMinutesToday,
  grantExtraMinutes,
  isOverLimit,
  lastNDays,
  newSessionLog,
  timeUsedToday,
} from './session-log.ts';
import type { SessionLog } from './session-log.ts';

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

const TODAY = new Date(2026, 0, 5, 10, 0, 0); // 2026-01-05, local
const YESTERDAY_LOG: SessionLog = newSessionLog('l1', 'p1', '2026-01-04', 999, TODAY);
const TODAY_LOG: SessionLog = newSessionLog('l1', 'p1', '2026-01-05', 12, TODAY);

describe('timeUsedToday', () => {
  it('is 0 without a log', () => {
    expect(timeUsedToday(undefined, TODAY)).toBe(0);
  });

  it('is 0 for a stale (not today) log — the midnight reset', () => {
    expect(timeUsedToday(YESTERDAY_LOG, TODAY)).toBe(0);
  });

  it("reads today's own log row", () => {
    expect(timeUsedToday(TODAY_LOG, TODAY)).toBe(12);
  });
});

describe('extraMinutesToday', () => {
  it('is 0 without a log, or with no grant on it', () => {
    expect(extraMinutesToday(undefined, TODAY)).toBe(0);
    expect(extraMinutesToday(TODAY_LOG, TODAY)).toBe(0);
  });

  it('is 0 for a stale (not today) log', () => {
    const grantedYesterday = { ...YESTERDAY_LOG, extraMinutes: 15 };
    expect(extraMinutesToday(grantedYesterday, TODAY)).toBe(0);
  });

  it("reads today's own grant", () => {
    expect(extraMinutesToday({ ...TODAY_LOG, extraMinutes: 15 }, TODAY)).toBe(15);
  });
});

describe('isOverLimit', () => {
  it('is always false with the limit off, no matter the minutes played', () => {
    const settings = { ...DEFAULT_PROFILE_SETTINGS, dailyLimitMinutes: null };
    const overLimitLog = { ...TODAY_LOG, minutes: 999 };
    expect(isOverLimit(settings, overLimitLog, TODAY)).toBe(false);
  });

  it('is false under the limit, true once minutes reach it', () => {
    const settings = { ...DEFAULT_PROFILE_SETTINGS, dailyLimitMinutes: 30 };
    expect(isOverLimit(settings, { ...TODAY_LOG, minutes: 29 }, TODAY)).toBe(false);
    expect(isOverLimit(settings, { ...TODAY_LOG, minutes: 30 }, TODAY)).toBe(true);
    expect(isOverLimit(settings, { ...TODAY_LOG, minutes: 31 }, TODAY)).toBe(true);
  });

  it('is false without a session log yet, even with the limit on', () => {
    const settings = { ...DEFAULT_PROFILE_SETTINGS, dailyLimitMinutes: 30 };
    expect(isOverLimit(settings, undefined, TODAY)).toBe(false);
  });

  it("resets at local midnight — yesterday's minutes never count against today's limit", () => {
    const settings = { ...DEFAULT_PROFILE_SETTINGS, dailyLimitMinutes: 30 };
    expect(isOverLimit(settings, YESTERDAY_LOG, TODAY)).toBe(false);
  });

  it("raises the effective limit by today's extra grant", () => {
    const settings = { ...DEFAULT_PROFILE_SETTINGS, dailyLimitMinutes: 30 };
    const grantedLog = { ...TODAY_LOG, minutes: 40, extraMinutes: 15 };
    expect(isOverLimit(settings, grantedLog, TODAY)).toBe(false); // 40 < 30 + 15
    expect(isOverLimit(settings, { ...grantedLog, minutes: 45 }, TODAY)).toBe(true);
  });
});

describe('grantExtraMinutes', () => {
  it('starts a fresh row at 0 played minutes with the grant on it', () => {
    const log = grantExtraMinutes(undefined, 'l1', 'p1', '2026-01-05', 15, TODAY);
    expect(log.minutes).toBe(0);
    expect(log.extraMinutes).toBe(15);
  });

  it('sums grants into an existing row, leaving played minutes untouched', () => {
    const first = grantExtraMinutes(undefined, 'l1', 'p1', '2026-01-05', 15, TODAY);
    const withMinutes = { ...first, minutes: 20 };
    const later = new Date(2026, 0, 5, 11, 0, 0);
    const second = grantExtraMinutes(withMinutes, 'l1', 'p1', '2026-01-05', 15, later);
    expect(second.extraMinutes).toBe(30);
    expect(second.minutes).toBe(20);
    expect(second.updatedAt).toBe(later.toISOString());
  });
});

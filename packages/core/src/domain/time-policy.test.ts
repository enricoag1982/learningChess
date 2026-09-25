import { describe, expect, it } from 'vitest';

import { DEFAULT_PROFILE_SETTINGS } from './profile-settings.ts';
import { newSessionLog } from './session-log.ts';
import type { SessionLog } from './session-log.ts';
import {
  allowedHoursReason,
  isWithinAllowedHours,
  minutesUntilEnd,
  shouldWarn,
} from './time-policy.ts';

describe('allowedHoursReason / isWithinAllowedHours', () => {
  it('null (within hours) with both edges off — pre-M7.1 default', () => {
    expect(allowedHoursReason(DEFAULT_PROFILE_SETTINGS, new Date(2026, 0, 5, 23, 0))).toBeNull();
    expect(isWithinAllowedHours(DEFAULT_PROFILE_SETTINGS, new Date(2026, 0, 5, 23, 0))).toBe(true);
  });

  it('"late" once at or past playUntil, "null" just before it', () => {
    const settings = { ...DEFAULT_PROFILE_SETTINGS, playUntil: '20:00' };
    expect(allowedHoursReason(settings, new Date(2026, 0, 5, 19, 59))).toBeNull();
    expect(allowedHoursReason(settings, new Date(2026, 0, 5, 20, 0))).toBe('late');
    expect(allowedHoursReason(settings, new Date(2026, 0, 5, 20, 1))).toBe('late');
  });

  it('"early" strictly before playFrom, "null" exactly at it (inclusive "not before")', () => {
    const settings = { ...DEFAULT_PROFILE_SETTINGS, playFrom: '07:00' };
    expect(allowedHoursReason(settings, new Date(2026, 0, 5, 6, 59))).toBe('early');
    expect(allowedHoursReason(settings, new Date(2026, 0, 5, 7, 0))).toBeNull();
  });

  it('an active override lifts either edge; an expired one does not', () => {
    const settings = { ...DEFAULT_PROFILE_SETTINGS, playUntil: '20:00' };
    const now = new Date(2026, 0, 5, 20, 5);
    const activeUntil = new Date(2026, 0, 5, 20, 10).toISOString();
    const expiredUntil = new Date(2026, 0, 5, 20, 4).toISOString();
    expect(allowedHoursReason(settings, now, activeUntil)).toBeNull();
    expect(allowedHoursReason(settings, now, expiredUntil)).toBe('late');
  });

  it('checks playFrom before playUntil — an "early" instant never conflicts with a same-day playUntil', () => {
    const settings = { ...DEFAULT_PROFILE_SETTINGS, playFrom: '07:00', playUntil: '20:00' };
    expect(allowedHoursReason(settings, new Date(2026, 0, 5, 6, 0))).toBe('early');
    expect(allowedHoursReason(settings, new Date(2026, 0, 5, 12, 0))).toBeNull();
  });
});

describe('minutesUntilEnd', () => {
  it('null when neither the daily limit nor playUntil is set', () => {
    expect(
      minutesUntilEnd(DEFAULT_PROFILE_SETTINGS, undefined, new Date(2026, 0, 5, 10, 0)),
    ).toBeNull();
  });

  it('the daily-limit remainder when only the limit is set', () => {
    const settings = { ...DEFAULT_PROFILE_SETTINGS, dailyLimitMinutes: 30 };
    const log = newSessionLog('l1', 'p1', '2026-01-05', 22, new Date(2026, 0, 5, 10, 0));
    expect(minutesUntilEnd(settings, log, new Date(2026, 0, 5, 10, 0))).toBe(8);
  });

  it('the minutes-until-playUntil remainder when only hours are set', () => {
    const settings = { ...DEFAULT_PROFILE_SETTINGS, playUntil: '20:00' };
    expect(minutesUntilEnd(settings, undefined, new Date(2026, 0, 5, 19, 55))).toBe(5);
  });

  it('the smaller of the two when both are set', () => {
    const settings = { ...DEFAULT_PROFILE_SETTINGS, dailyLimitMinutes: 30, playUntil: '20:00' };
    const log = newSessionLog('l1', 'p1', '2026-01-05', 27, new Date(2026, 0, 5, 19, 30));
    // Daily limit leaves 3 min; playUntil leaves 30 min — the limit wins.
    expect(minutesUntilEnd(settings, log, new Date(2026, 0, 5, 19, 30))).toBe(3);
  });

  it("today's extra grant widens the daily-limit remainder", () => {
    const settings = { ...DEFAULT_PROFILE_SETTINGS, dailyLimitMinutes: 30 };
    const log = {
      ...newSessionLog('l1', 'p1', '2026-01-05', 30, new Date(2026, 0, 5, 10, 0)),
      extraMinutes: 10,
    };
    expect(minutesUntilEnd(settings, log, new Date(2026, 0, 5, 10, 0))).toBe(10);
  });

  it('an active hours override widens the remainder to the override edge', () => {
    const settings = { ...DEFAULT_PROFILE_SETTINGS, playUntil: '20:00' };
    const now = new Date(2026, 0, 5, 20, 5);
    const log: SessionLog = {
      ...newSessionLog('l1', 'p1', '2026-01-05', 0, now),
      hoursOverrideUntil: new Date(2026, 0, 5, 20, 15).toISOString(),
    };
    expect(minutesUntilEnd(settings, log, now)).toBe(10);
  });
});

describe('shouldWarn', () => {
  const NOW = new Date(2026, 0, 5, 19, 56);

  it('false when remaining is null, 0, negative, or above 5', () => {
    expect(shouldWarn(null, undefined, NOW)).toBe(false);
    expect(shouldWarn(0, undefined, NOW)).toBe(false);
    expect(shouldWarn(-1, undefined, NOW)).toBe(false);
    expect(shouldWarn(6, undefined, NOW)).toBe(false);
  });

  it('true at exactly 5 and at 1, with no prior warning today', () => {
    expect(shouldWarn(5, undefined, NOW)).toBe(true);
    expect(shouldWarn(1, undefined, NOW)).toBe(true);
  });

  it("false once today's log already has warnedAt", () => {
    const log = { ...newSessionLog('l1', 'p1', '2026-01-05', 0, NOW), warnedAt: NOW.toISOString() };
    expect(shouldWarn(3, log, NOW)).toBe(false);
  });

  it("a stale (not-today) log's warnedAt does not block a fresh warning", () => {
    const yesterday = {
      ...newSessionLog('l1', 'p1', '2026-01-04', 0, NOW),
      warnedAt: NOW.toISOString(),
    };
    expect(shouldWarn(3, yesterday, NOW)).toBe(true);
  });
});

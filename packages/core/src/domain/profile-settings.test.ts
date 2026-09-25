import { describe, expect, it } from 'vitest';

import {
  DAILY_LIMIT_OPTIONS,
  DEFAULT_PROFILE_SETTINGS,
  isValidComputerLevel,
  isValidDailyLimit,
  isValidPieceStyle,
  isValidProfileSettings,
} from './profile-settings.ts';
import type { ProfileSettings } from './profile-settings.ts';

describe('isValidDailyLimit', () => {
  it('accepts every DAILY_LIMIT_OPTIONS value', () => {
    for (const value of DAILY_LIMIT_OPTIONS) {
      expect(isValidDailyLimit(value)).toBe(true);
    }
  });

  it('rejects anything else', () => {
    expect(isValidDailyLimit(10)).toBe(false);
    expect(isValidDailyLimit(-15)).toBe(false);
  });
});

describe('isValidComputerLevel', () => {
  it('accepts "auto" and every level 1-5', () => {
    expect(isValidComputerLevel('auto')).toBe(true);
    for (let level = 1; level <= 5; level += 1) {
      expect(isValidComputerLevel(level)).toBe(true);
    }
  });

  it('rejects out-of-range numbers and other values', () => {
    expect(isValidComputerLevel(0)).toBe(false);
    expect(isValidComputerLevel(6)).toBe(false);
    expect(isValidComputerLevel('manual')).toBe(false);
    expect(isValidComputerLevel(null)).toBe(false);
  });
});

describe('isValidPieceStyle', () => {
  it('accepts "animal" and "classic"', () => {
    expect(isValidPieceStyle('animal')).toBe(true);
    expect(isValidPieceStyle('classic')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isValidPieceStyle('wood')).toBe(false);
    expect(isValidPieceStyle(undefined)).toBe(false);
  });
});

describe('isValidProfileSettings', () => {
  it('accepts DEFAULT_PROFILE_SETTINGS', () => {
    expect(isValidProfileSettings(DEFAULT_PROFILE_SETTINGS)).toBe(true);
  });

  it('accepts every field customized to a valid value', () => {
    const settings: ProfileSettings = {
      dailyLimitMinutes: 30,
      voice: false,
      sound: false,
      hints: false,
      computerLevel: 3,
      pieceStyle: 'classic',
    };
    expect(isValidProfileSettings(settings)).toBe(true);
  });

  it('rejects an invalid dailyLimitMinutes', () => {
    expect(isValidProfileSettings({ ...DEFAULT_PROFILE_SETTINGS, dailyLimitMinutes: 10 })).toBe(
      false,
    );
  });

  it('rejects an invalid computerLevel', () => {
    expect(
      isValidProfileSettings({
        ...DEFAULT_PROFILE_SETTINGS,
        computerLevel: 9 as unknown as ProfileSettings['computerLevel'],
      }),
    ).toBe(false);
  });
});

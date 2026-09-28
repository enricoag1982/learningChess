import { describe, expect, it } from 'vitest';

import {
  composeDefaultSettings,
  DAILY_LIMIT_OPTIONS,
  isValidDailyLimit,
  isValidProfileSettings,
} from './profile-settings.ts';
import type { ProfileSettings } from './profile-settings.ts';

/** No settings-slot fields — enough to exercise the platform-only validation. */
const NO_SUBJECT_FIELDS = { defaults: {}, isValid: () => true };

const DEFAULTS = composeDefaultSettings(NO_SUBJECT_FIELDS);

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

describe('isValidProfileSettings', () => {
  it('accepts the composed defaults', () => {
    expect(isValidProfileSettings(NO_SUBJECT_FIELDS, DEFAULTS)).toBe(true);
  });

  it('rejects an invalid dailyLimitMinutes', () => {
    const settings: ProfileSettings = { ...DEFAULTS, dailyLimitMinutes: 10 };
    expect(isValidProfileSettings(NO_SUBJECT_FIELDS, settings)).toBe(false);
  });

  it('defers to the subject for the rest of the bag', () => {
    const rejecting = { defaults: {}, isValid: () => false };
    expect(isValidProfileSettings(rejecting, DEFAULTS)).toBe(false);
  });
});

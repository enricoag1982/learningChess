import { describe, expect, it } from 'vitest';

import { composeDefaultSettings } from '@learn/platform-core/domain/profile-settings';
import { makeSettingsRepo, makeDeps as buildDeps } from '@learn/platform-core/testing';
import { getProfileSettings, updateProfileSettings } from '@learn/platform-core/app/settings';
import type { AppDeps } from '@learn/platform-core/app/use-cases';
import type { AppSettings } from '@learn/platform-core/app/ports';

function makeDeps(initialSettings: AppSettings): AppDeps {
  return buildDeps({ settings: makeSettingsRepo(initialSettings) });
}

const DEFAULT_PROFILE_SETTINGS = composeDefaultSettings(buildDeps({}).subject.settings);

const EMPTY_SETTINGS: AppSettings = {
  lastProfileId: null,
  suggestedLevels: {},
  profileSettings: {},
};

describe('getProfileSettings', () => {
  it('returns DEFAULT_PROFILE_SETTINGS for a profile with none stored yet', async () => {
    const deps = makeDeps(EMPTY_SETTINGS);
    expect(await getProfileSettings(deps, 'p1')).toEqual(DEFAULT_PROFILE_SETTINGS);
  });

  it('returns the stored settings, merged over defaults', async () => {
    const deps = makeDeps({
      ...EMPTY_SETTINGS,
      profileSettings: { p1: { ...DEFAULT_PROFILE_SETTINGS, hints: false, dailyLimitMinutes: 30 } },
    });
    expect(await getProfileSettings(deps, 'p1')).toEqual({
      ...DEFAULT_PROFILE_SETTINGS,
      hints: false,
      dailyLimitMinutes: 30,
    });
  });
});

describe('updateProfileSettings', () => {
  it('merges a partial patch into the current settings and persists it', async () => {
    const deps = makeDeps(EMPTY_SETTINGS);
    const updated = await updateProfileSettings(deps, 'p1', { hints: false, voice: false });
    expect(updated).toEqual({
      ...DEFAULT_PROFILE_SETTINGS,
      hints: false,
      voice: false,
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(await getProfileSettings(deps, 'p1')).toEqual(updated);
  });

  it('stamps updatedAt (M7.2 device sharing "newest wins")', async () => {
    const deps = makeDeps(EMPTY_SETTINGS);
    const updated = await updateProfileSettings(deps, 'p1', { hints: false });
    expect(updated.updatedAt).toBe(deps.clock.now().toISOString());
  });

  it('leaves other profiles’ settings alone', async () => {
    const deps = makeDeps({
      ...EMPTY_SETTINGS,
      profileSettings: { other: { ...DEFAULT_PROFILE_SETTINGS, sound: false } },
    });
    await updateProfileSettings(deps, 'p1', { hints: false });
    expect(await getProfileSettings(deps, 'other')).toEqual({
      ...DEFAULT_PROFILE_SETTINGS,
      sound: false,
    });
  });

  it('rejects an invalid dailyLimitMinutes', async () => {
    const deps = makeDeps(EMPTY_SETTINGS);
    await expect(updateProfileSettings(deps, 'p1', { dailyLimitMinutes: 10 })).rejects.toThrow();
  });

  it("rejects a value the subject's own settings refuse", async () => {
    const deps = makeDeps(EMPTY_SETTINGS);
    const valid = { hints: true, difficulty: 'hard' };
    const invalid = { hints: true, difficulty: 'nightmare' };
    await expect(updateProfileSettings(deps, 'p1', valid)).resolves.toMatchObject(valid);
    await expect(updateProfileSettings(deps, 'p1', invalid)).rejects.toThrow();
  });
});

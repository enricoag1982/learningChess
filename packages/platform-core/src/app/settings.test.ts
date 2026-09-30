import { describe, expect, it } from 'vitest';

import { composeDefaultSettings } from '../domain/profile-settings.ts';
import { createSubjectRuntime } from '../domain/runtime.ts';
import { makeSettingsRepo, makeDeps as buildDeps, testSubject } from '../testing/index.ts';
import { getProfileSettings, updateProfileSettings } from './settings.ts';
import type { AppDeps } from './use-cases.ts';
import type { AppSettings } from './ports.ts';

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

describe('retired subject settings (SubjectCore.settings.retired)', () => {
  const subject = createSubjectRuntime({
    ...testSubject,
    settings: { ...testSubject.settings, retired: ['legacy'] },
  });
  const stored = { ...DEFAULT_PROFILE_SETTINGS, legacy: 'kept-by-an-old-version' };

  function makeRetiredDeps(): AppDeps {
    return buildDeps({
      subject,
      settings: makeSettingsRepo({
        ...EMPTY_SETTINGS,
        profileSettings: { p1: stored },
      }),
    });
  }

  it('reads a stored profile without its retired field', async () => {
    const loaded = await getProfileSettings(makeRetiredDeps(), 'p1');
    expect(loaded).toEqual(DEFAULT_PROFILE_SETTINGS);
    expect(Object.keys(loaded)).not.toContain('legacy');
  });

  it('drops the retired field on the next save', async () => {
    const deps = makeRetiredDeps();
    await updateProfileSettings(deps, 'p1', { hints: false });
    const saved = (await deps.settings.get()).profileSettings.p1;
    expect(Object.keys(saved ?? {})).not.toContain('legacy');
  });

  it('keeps an unknown stored field when the subject retires none', async () => {
    const deps = buildDeps({
      settings: makeSettingsRepo({ ...EMPTY_SETTINGS, profileSettings: { p1: stored } }),
    });
    expect(Object.keys(await getProfileSettings(deps, 'p1'))).toContain('legacy');
  });
});

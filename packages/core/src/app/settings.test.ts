import { describe, expect, it } from 'vitest';

import { DEFAULT_PROFILE_SETTINGS } from '../domain/profile-settings.ts';
import { seededRandom } from '../domain/random.ts';
import { getProfileSettings, updateProfileSettings } from './settings.ts';
import type { AppDeps } from './use-cases.ts';
import type {
  AppSettings,
  ContentSource,
  GameRecordRepository,
  ParentLockRepository,
  PasswordFileWriter,
  ProfileRepository,
  ProgressRepository,
  SettingsRepository,
} from './ports.ts';

function makeSettingsRepo(initial: AppSettings): SettingsRepository {
  let settings = initial;
  return {
    get: () => Promise.resolve(settings),
    save: (next) => {
      settings = next;
      return Promise.resolve();
    },
  };
}

const stubContent: ContentSource = {
  lessons: () => [],
  lesson: () => undefined,
  minigames: () => [],
  minigame: () => undefined,
};

function makeDeps(initialSettings: AppSettings): AppDeps {
  const profiles: ProfileRepository = {
    list: () => Promise.resolve([]),
    get: () => Promise.resolve(undefined),
    save: () => Promise.resolve(),
    delete: () => Promise.resolve(),
  };
  return {
    profiles,
    progress: {} as unknown as ProgressRepository,
    gameRecords: {} as unknown as GameRecordRepository,
    clock: { now: () => new Date('2026-01-01T00:00:00.000Z') },
    ids: { next: () => 'id-1' },
    content: stubContent,
    parentLock: {} as unknown as ParentLockRepository,
    passwordFile: {} as unknown as PasswordFileWriter,
    settings: makeSettingsRepo(initialSettings),
    random: seededRandom(1),
  };
}

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
    expect(updated).toEqual({ ...DEFAULT_PROFILE_SETTINGS, hints: false, voice: false });
    expect(await getProfileSettings(deps, 'p1')).toEqual(updated);
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

  it('rejects an invalid computerLevel', async () => {
    const deps = makeDeps(EMPTY_SETTINGS);
    await expect(
      updateProfileSettings(deps, 'p1', { computerLevel: 9 as unknown as 'auto' }),
    ).rejects.toThrow();
  });
});

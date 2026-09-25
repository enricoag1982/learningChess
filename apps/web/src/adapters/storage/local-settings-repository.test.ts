import { beforeEach, describe, expect, it } from 'vitest';
import { openLocalStore, StorageError } from './local-store.ts';
import { LocalStorageSettingsRepository } from './local-settings-repository.ts';

beforeEach(() => {
  localStorage.clear();
});

describe('LocalStorageSettingsRepository', () => {
  it('defaults to lastProfileId: null, suggestedLevels: {}, profileSettings: {} before anything is saved', async () => {
    const repo = new LocalStorageSettingsRepository(openLocalStore(localStorage));
    expect(await repo.get()).toEqual({
      lastProfileId: null,
      suggestedLevels: {},
      profileSettings: {},
    });
  });

  it('saves and reads back settings, updates in place', async () => {
    const repo = new LocalStorageSettingsRepository(openLocalStore(localStorage));
    await repo.save({
      lastProfileId: 'profile-1',
      suggestedLevels: { 'profile-1': 3 },
      profileSettings: {},
    });
    expect(await repo.get()).toEqual({
      lastProfileId: 'profile-1',
      suggestedLevels: { 'profile-1': 3 },
      profileSettings: {},
    });

    await repo.save({ lastProfileId: null, suggestedLevels: {}, profileSettings: {} });
    expect(await repo.get()).toEqual({
      lastProfileId: null,
      suggestedLevels: {},
      profileSettings: {},
    });
  });

  it('saves and reads back per-profile settings (M5.1)', async () => {
    const repo = new LocalStorageSettingsRepository(openLocalStore(localStorage));
    const settings = {
      dailyLimitMinutes: 30,
      voice: false,
      sound: true,
      hints: false,
      computerLevel: 3 as const,
      pieceStyle: 'classic' as const,
    };
    await repo.save({
      lastProfileId: null,
      suggestedLevels: {},
      profileSettings: { 'profile-1': settings },
    });
    expect(await repo.get()).toEqual({
      lastProfileId: null,
      suggestedLevels: {},
      profileSettings: { 'profile-1': settings },
    });
  });

  it('persists for a new repository instance over the same storage', async () => {
    await new LocalStorageSettingsRepository(openLocalStore(localStorage)).save({
      lastProfileId: 'profile-1',
      suggestedLevels: { 'profile-1': 2 },
      profileSettings: {},
    });

    const second = new LocalStorageSettingsRepository(openLocalStore(localStorage));
    expect(await second.get()).toEqual({
      lastProfileId: 'profile-1',
      suggestedLevels: { 'profile-1': 2 },
      profileSettings: {},
    });
  });

  it('reads a pre-M4.2 record with no suggestedLevels as {}', async () => {
    const store = openLocalStore(localStorage);
    store.write('settings', { lastProfileId: 'profile-1' });
    const repo = new LocalStorageSettingsRepository(store);

    expect(await repo.get()).toEqual({
      lastProfileId: 'profile-1',
      suggestedLevels: {},
      profileSettings: {},
    });
  });

  it('reads a pre-M5.1 record with no profileSettings as {}', async () => {
    const store = openLocalStore(localStorage);
    store.write('settings', { lastProfileId: 'profile-1', suggestedLevels: { 'profile-1': 2 } });
    const repo = new LocalStorageSettingsRepository(store);

    expect(await repo.get()).toEqual({
      lastProfileId: 'profile-1',
      suggestedLevels: { 'profile-1': 2 },
      profileSettings: {},
    });
  });

  it('rejects with StorageError on a corrupt stored shape', async () => {
    const store = openLocalStore(localStorage);
    store.write('settings', { lastProfileId: 42 });
    const repo = new LocalStorageSettingsRepository(store);

    await expect(repo.get()).rejects.toThrow(StorageError);
  });

  it('rejects with StorageError on a corrupt suggestedLevels', async () => {
    const store = openLocalStore(localStorage);
    store.write('settings', { lastProfileId: null, suggestedLevels: 'nope' });
    const repo = new LocalStorageSettingsRepository(store);

    await expect(repo.get()).rejects.toThrow(StorageError);
  });

  it('rejects with StorageError on a corrupt profileSettings', async () => {
    const store = openLocalStore(localStorage);
    store.write('settings', { lastProfileId: null, suggestedLevels: {}, profileSettings: 'nope' });
    const repo = new LocalStorageSettingsRepository(store);

    await expect(repo.get()).rejects.toThrow(StorageError);
  });
});

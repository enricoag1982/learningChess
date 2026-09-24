import { beforeEach, describe, expect, it } from 'vitest';
import { openLocalStore, StorageError } from './local-store.ts';
import { LocalStorageSettingsRepository } from './local-settings-repository.ts';

beforeEach(() => {
  localStorage.clear();
});

describe('LocalStorageSettingsRepository', () => {
  it('defaults to lastProfileId: null, suggestedLevels: {} before anything is saved', async () => {
    const repo = new LocalStorageSettingsRepository(openLocalStore(localStorage));
    expect(await repo.get()).toEqual({ lastProfileId: null, suggestedLevels: {} });
  });

  it('saves and reads back settings, updates in place', async () => {
    const repo = new LocalStorageSettingsRepository(openLocalStore(localStorage));
    await repo.save({ lastProfileId: 'profile-1', suggestedLevels: { 'profile-1': 3 } });
    expect(await repo.get()).toEqual({
      lastProfileId: 'profile-1',
      suggestedLevels: { 'profile-1': 3 },
    });

    await repo.save({ lastProfileId: null, suggestedLevels: {} });
    expect(await repo.get()).toEqual({ lastProfileId: null, suggestedLevels: {} });
  });

  it('persists for a new repository instance over the same storage', async () => {
    await new LocalStorageSettingsRepository(openLocalStore(localStorage)).save({
      lastProfileId: 'profile-1',
      suggestedLevels: { 'profile-1': 2 },
    });

    const second = new LocalStorageSettingsRepository(openLocalStore(localStorage));
    expect(await second.get()).toEqual({
      lastProfileId: 'profile-1',
      suggestedLevels: { 'profile-1': 2 },
    });
  });

  it('reads a pre-M4.2 record with no suggestedLevels as {}', async () => {
    const store = openLocalStore(localStorage);
    store.write('settings', { lastProfileId: 'profile-1' });
    const repo = new LocalStorageSettingsRepository(store);

    expect(await repo.get()).toEqual({ lastProfileId: 'profile-1', suggestedLevels: {} });
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
});

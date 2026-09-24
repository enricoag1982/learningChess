import { beforeEach, describe, expect, it } from 'vitest';
import { openLocalStore, StorageError } from './local-store.ts';
import { LocalStorageSettingsRepository } from './local-settings-repository.ts';

beforeEach(() => {
  localStorage.clear();
});

describe('LocalStorageSettingsRepository', () => {
  it('defaults to lastProfileId: null before anything is saved', async () => {
    const repo = new LocalStorageSettingsRepository(openLocalStore(localStorage));
    expect(await repo.get()).toEqual({ lastProfileId: null });
  });

  it('saves and reads back settings, updates in place', async () => {
    const repo = new LocalStorageSettingsRepository(openLocalStore(localStorage));
    await repo.save({ lastProfileId: 'profile-1' });
    expect(await repo.get()).toEqual({ lastProfileId: 'profile-1' });

    await repo.save({ lastProfileId: null });
    expect(await repo.get()).toEqual({ lastProfileId: null });
  });

  it('persists for a new repository instance over the same storage', async () => {
    await new LocalStorageSettingsRepository(openLocalStore(localStorage)).save({
      lastProfileId: 'profile-1',
    });

    const second = new LocalStorageSettingsRepository(openLocalStore(localStorage));
    expect(await second.get()).toEqual({ lastProfileId: 'profile-1' });
  });

  it('rejects with StorageError on a corrupt stored shape', async () => {
    const store = openLocalStore(localStorage);
    store.write('settings', { lastProfileId: 42 });
    const repo = new LocalStorageSettingsRepository(store);

    await expect(repo.get()).rejects.toThrow(StorageError);
  });
});

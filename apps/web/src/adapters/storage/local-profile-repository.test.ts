import { beforeEach, describe, expect, it } from 'vitest';
import type { Profile } from '@chess-kids/core';
import { openLocalStore, StorageError } from './local-store.ts';
import { LocalStorageProfileRepository } from './local-profile-repository.ts';

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'p1',
    accountId: 'local',
    nickname: 'Rex',
    avatar: 'fox',
    locale: 'en',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('LocalStorageProfileRepository', () => {
  it('saves, gets, lists ordered by createdAt then id, updates and no-op deletes', async () => {
    const repo = new LocalStorageProfileRepository(openLocalStore(localStorage));
    const early = makeProfile({ id: 'a', createdAt: '2026-01-01T00:00:00.000Z' });
    const late = makeProfile({ id: 'b', createdAt: '2026-01-02T00:00:00.000Z' });

    await repo.save(late);
    await repo.save(early);

    expect(await repo.get('a')).toEqual(early);
    expect(await repo.list()).toEqual([early, late]);

    const updated: Profile = { ...early, nickname: 'Rex Jr.' };
    await repo.save(updated);
    expect(await repo.get('a')).toEqual(updated);

    await repo.delete('a');
    expect(await repo.get('a')).toBeUndefined();
    expect(await repo.list()).toEqual([late]);

    await expect(repo.delete('does-not-exist')).resolves.toBeUndefined();
    expect(await repo.list()).toEqual([late]);
  });

  it('persists data for a new repository instance over the same storage', async () => {
    const profile = makeProfile();
    await new LocalStorageProfileRepository(openLocalStore(localStorage)).save(profile);

    const second = new LocalStorageProfileRepository(openLocalStore(localStorage));
    expect(await second.get(profile.id)).toEqual(profile);
    expect(await second.list()).toEqual([profile]);
  });

  it('rejects with StorageError on a corrupt stored shape', async () => {
    const store = openLocalStore(localStorage);
    store.write('profiles', { a: { nickname: 'no id field' } });
    const repo = new LocalStorageProfileRepository(store);

    await expect(repo.list()).rejects.toThrow(StorageError);
  });
});

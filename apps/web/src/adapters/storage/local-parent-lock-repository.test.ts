import { beforeEach, describe, expect, it } from 'vitest';
import type { ParentLock } from '@chess-kids/core';
import { openLocalStore, StorageError } from './local-store.ts';
import { LocalStorageParentLockRepository } from './local-parent-lock-repository.ts';

function makeLock(overrides: Partial<ParentLock> = {}): ParentLock {
  return {
    id: 'lock-1',
    password: '1234',
    fileLocation: 'Downloads/chess-for-kids-parent-code.txt',
    failedAttempts: 0,
    lockedUntil: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('LocalStorageParentLockRepository', () => {
  it('get() is undefined before any lock is saved', async () => {
    const repo = new LocalStorageParentLockRepository(openLocalStore(localStorage));
    expect(await repo.get()).toBeUndefined();
  });

  it('saves and reads back the lock, updates in place', async () => {
    const repo = new LocalStorageParentLockRepository(openLocalStore(localStorage));
    const lock = makeLock();
    await repo.save(lock);
    expect(await repo.get()).toEqual(lock);

    const updated = { ...lock, failedAttempts: 2 };
    await repo.save(updated);
    expect(await repo.get()).toEqual(updated);
  });

  it('persists for a new repository instance over the same storage', async () => {
    const lock = makeLock();
    await new LocalStorageParentLockRepository(openLocalStore(localStorage)).save(lock);

    const second = new LocalStorageParentLockRepository(openLocalStore(localStorage));
    expect(await second.get()).toEqual(lock);
  });

  it('rejects with StorageError on a corrupt stored shape', async () => {
    const store = openLocalStore(localStorage);
    store.write('parent-lock', { nope: true });
    const repo = new LocalStorageParentLockRepository(store);

    await expect(repo.get()).rejects.toThrow(StorageError);
  });
});

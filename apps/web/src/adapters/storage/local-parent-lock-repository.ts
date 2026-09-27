import type { ParentLock, ParentLockRepository } from '@chess-kids/core';
import type { SingletonRecord } from './collections.ts';
import { singleton } from './collections.ts';
import type { LocalStore } from './local-store.ts';
import { StorageError } from './local-store.ts';
import { STORAGE_KEYS } from './storage-keys.ts';

function isParentLockShape(value: unknown): value is ParentLock {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.password === 'string' &&
    typeof record.fileLocation === 'string' &&
    typeof record.failedAttempts === 'number' &&
    (record.lockedUntil === null || typeof record.lockedUntil === 'string')
  );
}

/** `ParentLockRepository` storing the single device-wide lock under one `LocalStore` record. */
export class LocalStorageParentLockRepository implements ParentLockRepository {
  private readonly record: SingletonRecord<unknown>;

  constructor(store: LocalStore) {
    this.record = singleton(store, STORAGE_KEYS.parentLock);
  }

  get(): Promise<ParentLock | undefined> {
    return this.record.get().then((raw) => {
      if (raw === undefined) return undefined;
      if (!isParentLockShape(raw)) {
        throw new StorageError(`Corrupt parent lock data stored at "${STORAGE_KEYS.parentLock}"`);
      }
      return raw;
    });
  }

  save(lock: ParentLock): Promise<void> {
    return this.record.set(lock);
  }
}

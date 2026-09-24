import type { ParentLock, ParentLockRepository } from '@chess-kids/core';
import type { LocalStore } from './local-store.ts';
import { StorageError } from './local-store.ts';

const RECORD_NAME = 'parent-lock';

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

/**
 * Runs a synchronous computation and reports it as a settled promise, so a thrown
 * `StorageError` surfaces as a rejection instead of a synchronous throw (methods here have no
 * `await` of their own, so they are not declared `async`: `@typescript-eslint/require-await`
 * would flag that).
 */
function toPromise<T>(compute: () => T): Promise<T> {
  try {
    return Promise.resolve(compute());
  } catch (error: unknown) {
    return Promise.reject<T>(error instanceof Error ? error : new Error(String(error)));
  }
}

/** `ParentLockRepository` storing the single device-wide lock under one `LocalStore` record. */
export class LocalStorageParentLockRepository implements ParentLockRepository {
  private readonly store: LocalStore;

  constructor(store: LocalStore) {
    this.store = store;
  }

  get(): Promise<ParentLock | undefined> {
    return toPromise(() => {
      const raw = this.store.read(RECORD_NAME);
      if (raw === undefined) return undefined;
      if (!isParentLockShape(raw)) {
        throw new StorageError(`Corrupt parent lock data stored at "${RECORD_NAME}"`);
      }
      return raw;
    });
  }

  save(lock: ParentLock): Promise<void> {
    return toPromise(() => {
      this.store.write(RECORD_NAME, lock);
    });
  }
}

import type { AppSettings, SettingsRepository } from '@chess-kids/core';
import type { LocalStore } from './local-store.ts';
import { StorageError } from './local-store.ts';

const RECORD_NAME = 'settings';
const DEFAULT_SETTINGS: AppSettings = { lastProfileId: null };

function isAppSettingsShape(value: unknown): value is AppSettings {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.lastProfileId === null || typeof record.lastProfileId === 'string';
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

/** `SettingsRepository` storing device-wide settings under one `LocalStore` record. */
export class LocalStorageSettingsRepository implements SettingsRepository {
  private readonly store: LocalStore;

  constructor(store: LocalStore) {
    this.store = store;
  }

  get(): Promise<AppSettings> {
    return toPromise(() => {
      const raw = this.store.read(RECORD_NAME);
      if (raw === undefined) return DEFAULT_SETTINGS;
      if (!isAppSettingsShape(raw)) {
        throw new StorageError(`Corrupt settings data stored at "${RECORD_NAME}"`);
      }
      return raw;
    });
  }

  save(settings: AppSettings): Promise<void> {
    return toPromise(() => {
      this.store.write(RECORD_NAME, settings);
    });
  }
}

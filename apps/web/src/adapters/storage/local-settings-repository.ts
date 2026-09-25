import type { AppSettings, SettingsRepository } from '@chess-kids/core';
import type { LocalStore } from './local-store.ts';
import { StorageError } from './local-store.ts';

const RECORD_NAME = 'settings';
const DEFAULT_SETTINGS: AppSettings = {
  lastProfileId: null,
  suggestedLevels: {},
  profileSettings: {},
};

/** Loosely-typed stored shape, before `normalize` fills in a field a pre-`suggestedLevels`/
 * pre-`profileSettings` record (M4.1 and earlier / pre-M5.1) does not have — same "old data reads
 * back as the empty default" approach `migrations.ts` already uses for `concept-stats`/
 * `game-records`, so this needs no version bump. */
function isAppSettingsShape(value: unknown): value is {
  lastProfileId: string | null;
  suggestedLevels?: unknown;
  profileSettings?: unknown;
  storagePersisted?: unknown;
  deviceId?: unknown;
} {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (record.lastProfileId !== null && typeof record.lastProfileId !== 'string') return false;
  if (
    record.suggestedLevels !== undefined &&
    (typeof record.suggestedLevels !== 'object' || record.suggestedLevels === null)
  ) {
    return false;
  }
  return (
    record.profileSettings === undefined ||
    (typeof record.profileSettings === 'object' && record.profileSettings !== null)
  );
}

/** Fills in `suggestedLevels: {}` / `profileSettings: {}` for a record stored before either existed. */
function normalize(stored: {
  lastProfileId: string | null;
  suggestedLevels?: unknown;
  profileSettings?: unknown;
  storagePersisted?: unknown;
  deviceId?: unknown;
}): AppSettings {
  return {
    lastProfileId: stored.lastProfileId,
    suggestedLevels: (stored.suggestedLevels as Record<string, number> | undefined) ?? {},
    profileSettings: (stored.profileSettings as AppSettings['profileSettings'] | undefined) ?? {},
    ...(typeof stored.storagePersisted === 'boolean'
      ? { storagePersisted: stored.storagePersisted }
      : {}),
    ...(typeof stored.deviceId === 'string' ? { deviceId: stored.deviceId } : {}),
  };
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
      return normalize(raw);
    });
  }

  save(settings: AppSettings): Promise<void> {
    return toPromise(() => {
      this.store.write(RECORD_NAME, settings);
    });
  }
}

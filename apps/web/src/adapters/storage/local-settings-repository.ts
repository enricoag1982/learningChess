import type { AppSettings, SettingsRepository } from '@learn/platform-core';
import type { SingletonRecord } from './collections.ts';
import { singleton } from './collections.ts';
import type { LocalStore } from './local-store.ts';
import { StorageError } from './local-store.ts';
import { STORAGE_KEYS } from './storage-keys.ts';

const DEFAULT_SETTINGS: AppSettings = {
  lastProfileId: null,
  suggestedLevels: {},
  profileSettings: {},
};

/** Loosely-typed stored shape, before `normalize` fills in a field a pre-`suggestedLevels`/
 * pre-`profileSettings` record does not have; needs no version bump. */
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

/** `SettingsRepository` storing device-wide settings under one `LocalStore` record. */
export class LocalStorageSettingsRepository implements SettingsRepository {
  private readonly record: SingletonRecord<unknown>;

  constructor(store: LocalStore) {
    this.record = singleton(store, STORAGE_KEYS.settings);
  }

  get(): Promise<AppSettings> {
    return this.record.get().then((raw) => {
      if (raw === undefined) return DEFAULT_SETTINGS;
      if (!isAppSettingsShape(raw)) {
        throw new StorageError(`Corrupt settings data stored at "${STORAGE_KEYS.settings}"`);
      }
      return normalize(raw);
    });
  }

  save(settings: AppSettings): Promise<void> {
    return this.record.set(settings);
  }
}

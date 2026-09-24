/** Raised on any storage state the app must never silently paper over (corrupt or newer-than-known data). */
export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

/** Namespaced JSON storage over a `read`/`write`/`remove` triplet keyed by short names. */
export interface LocalStore {
  /** Parsed value at `name`, or `undefined` if absent. Throws `StorageError` on corrupt JSON. */
  read(name: string): unknown;
  write(name: string, value: unknown): void;
  remove(name: string): void;
}

/** One schema migration, applied when moving from `to - 1` to `to`. */
export interface Migration {
  readonly to: number;
  migrate(store: LocalStore): void;
}

export interface OpenLocalStoreOptions {
  /** Schema version this build expects. Defaults to `SCHEMA_VERSION`. */
  readonly version?: number;
  /** Migrations covering every version between the stored one and `version`, in any order. */
  readonly migrations?: readonly Migration[];
}

/**
 * Current schema version for `chess-kids:*` storage, used when `options.version` is omitted.
 * v2 (M3.4) adds the `concept-stats` record; v3 (M3.5) adds the `game-records` record (see
 * `migrations.ts`) — existing v1/v2 data has none yet, so both migrations only bump the version:
 * `LocalStorageProgressRepository`/`LocalStorageGameRecordRepository` read a missing key as "none
 * yet", same as a fresh profile.
 */
export const SCHEMA_VERSION = 3;

const KEY_PREFIX = 'chess-kids:';
const VERSION_KEY = `${KEY_PREFIX}schema-version`;

function namespacedKey(name: string): string {
  return `${KEY_PREFIX}${name}`;
}

function createStore(storage: Storage): LocalStore {
  return {
    read(name: string): unknown {
      const raw = storage.getItem(namespacedKey(name));
      if (raw === null) return undefined;
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        throw new StorageError(`Corrupt JSON stored at key "${name}"`);
      }
    },
    write(name: string, value: unknown): void {
      storage.setItem(namespacedKey(name), JSON.stringify(value));
    },
    remove(name: string): void {
      storage.removeItem(namespacedKey(name));
    },
  };
}

/** True if `storage` holds any `chess-kids:` key other than the version key. */
function hasNamespacedData(storage: Storage): boolean {
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key !== null && key !== VERSION_KEY && key.startsWith(KEY_PREFIX)) {
      return true;
    }
  }
  return false;
}

/** Stored schema version, or `undefined` if the version key is absent. */
function readStoredVersion(storage: Storage): number | undefined {
  const raw = storage.getItem(VERSION_KEY);
  if (raw === null) return undefined;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    throw new StorageError('Corrupt schema version stored');
  }
  return parsed;
}

/**
 * Opens namespaced, versioned JSON storage over `storage` (e.g. `window.localStorage`).
 *
 * - Fresh storage (no version key, no `chess-kids:` data) starts at the target version.
 * - A stored version below the target is migrated up one step at a time; a missing step throws.
 * - A stored version above the target, or `chess-kids:` data with no version key, throws without
 *   touching anything: this is data the running app must not guess about.
 */
export function openLocalStore(storage: Storage, options?: OpenLocalStoreOptions): LocalStore {
  const targetVersion = options?.version ?? SCHEMA_VERSION;
  const migrations = options?.migrations ?? [];
  const store = createStore(storage);
  const storedVersion = readStoredVersion(storage);

  if (storedVersion === undefined) {
    if (hasNamespacedData(storage)) {
      throw new StorageError('Unversioned chess-kids data found in storage');
    }
    storage.setItem(VERSION_KEY, String(targetVersion));
    return store;
  }

  if (storedVersion > targetVersion) {
    throw new StorageError(
      `Stored schema version ${String(storedVersion)} is newer than supported version ${String(targetVersion)}`,
    );
  }

  let current = storedVersion;
  while (current < targetVersion) {
    const next = current + 1;
    const migration = migrations.find((candidate) => candidate.to === next);
    if (!migration) {
      throw new StorageError(`Missing migration to schema version ${String(next)}`);
    }
    migration.migrate(store);
    storage.setItem(VERSION_KEY, String(next));
    current = next;
  }

  return store;
}

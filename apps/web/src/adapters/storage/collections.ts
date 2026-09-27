import type { LocalStore } from './local-store.ts';
import { StorageError } from './local-store.ts';

/**
 * Runs a synchronous computation and reports it as a settled promise, so a thrown `StorageError`
 * surfaces as a rejection instead of a synchronous throw. The one place this conversion happens —
 * every collection below, plus the backup importer's own staging writes, share it instead of each
 * declaring its own copy.
 */
export function toPromise<T>(compute: () => T): Promise<T> {
  try {
    return Promise.resolve(compute());
  } catch (error: unknown) {
    return Promise.reject<T>(error instanceof Error ? error : new Error(String(error)));
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A record map: every `T` stored as one JSON object under `name`, keyed by `keyOf(record)`. */
export interface KeyedCollection<T> {
  get(key: string): Promise<T | undefined>;
  list(filter?: (record: T) => boolean): Promise<T[]>;
  put(record: T): Promise<void>;
  remove(key: string): Promise<void>;
  removeWhere(predicate: (record: T) => boolean): Promise<void>;
}

/**
 * A `LocalStore` record holding `Record<string, T>`, addressed by a key derived from each record
 * (e.g. an id, or `"<profileId>:<lessonId>"`). `isRecord` is the same per-type shape guard every
 * repository already had; a value failing it (or the stored value not being a plain object) is
 * `StorageError`, same as corrupt JSON already is.
 */
export function keyedCollection<T>(
  store: LocalStore,
  name: string,
  keyOf: (record: T) => string,
  isRecord: (value: unknown) => value is T,
): KeyedCollection<T> {
  function readAll(): Map<string, T> {
    const raw = store.read(name);
    if (raw === undefined) return new Map();
    if (!isPlainRecord(raw) || !Object.values(raw).every(isRecord)) {
      throw new StorageError(`Corrupt data stored at "${name}"`);
    }
    return new Map(Object.entries(raw as Record<string, T>));
  }

  function writeAll(all: ReadonlyMap<string, T>): void {
    store.write(name, Object.fromEntries(all));
  }

  return {
    get(key) {
      return toPromise(() => readAll().get(key));
    },
    list(filter) {
      return toPromise(() => {
        const all = [...readAll().values()];
        return filter ? all.filter(filter) : all;
      });
    },
    put(record) {
      return toPromise(() => {
        const all = readAll();
        all.set(keyOf(record), record);
        writeAll(all);
      });
    },
    remove(key) {
      return toPromise(() => {
        const all = readAll();
        all.delete(key);
        writeAll(all);
      });
    },
    removeWhere(predicate) {
      return toPromise(() => {
        const all = readAll();
        for (const [key, record] of all) {
          if (predicate(record)) all.delete(key);
        }
        writeAll(all);
      });
    },
  };
}

/** An append-only array: every `T` stored as one JSON list under `name`, newest last. */
export interface CappedList<T> {
  list(filter?: (record: T) => boolean): Promise<T[]>;
  add(record: T): Promise<void>;
  removeWhere(predicate: (record: T) => boolean): Promise<void>;
}

/**
 * A `LocalStore` record holding `T[]`. `add` appends, then drops the oldest entries once the list
 * grows past `cap` (kept exactly as each repository already capped its own); `cap: undefined`
 * never trims (`earned-badges`/`unlocks`, which have none today). `isRecord` guards each element,
 * same reasoning as `keyedCollection`.
 */
export function cappedList<T>(
  store: LocalStore,
  name: string,
  cap: number | undefined,
  isRecord: (value: unknown) => value is T,
): CappedList<T> {
  function readAll(): T[] {
    const raw = store.read(name);
    if (raw === undefined) return [];
    if (!Array.isArray(raw) || !raw.every(isRecord)) {
      throw new StorageError(`Corrupt data stored at "${name}"`);
    }
    return raw;
  }

  return {
    list(filter) {
      return toPromise(() => {
        const all = readAll();
        return filter ? all.filter(filter) : all;
      });
    },
    add(record) {
      return toPromise(() => {
        const all = readAll();
        all.push(record);
        const kept = cap !== undefined && all.length > cap ? all.slice(all.length - cap) : all;
        store.write(name, kept);
      });
    },
    removeWhere(predicate) {
      return toPromise(() => {
        store.write(
          name,
          readAll().filter((record) => !predicate(record)),
        );
      });
    },
  };
}

/** A single JSON value stored under `name` (device-wide settings, the one parent lock). */
export interface SingletonRecord<T> {
  get(): Promise<T | undefined>;
  set(value: T): Promise<void>;
}

/**
 * A `LocalStore` record holding one `T` (or nothing yet). No shape guard here: a singleton's value
 * is either used as-is or needs field-by-field defaulting (`AppSettings`'s pre-M4.2/pre-M5.1
 * records), which stays behaviour-specific in the repository, on top of the raw value this returns.
 * `defaults`, if given, is returned in place of `undefined` when nothing has been stored yet.
 */
export function singleton<T>(store: LocalStore, name: string, defaults?: T): SingletonRecord<T> {
  return {
    get() {
      return toPromise(() => {
        const raw = store.read(name);
        return raw === undefined ? defaults : (raw as T);
      });
    },
    set(value) {
      return toPromise(() => {
        store.write(name, value);
      });
    },
  };
}

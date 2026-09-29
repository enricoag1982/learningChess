import type { LocalStore } from './local-store.ts';
import { StorageError } from './local-store.ts';

/** Runs a synchronous computation and reports it as a settled promise, so a thrown `StorageError`
 * surfaces as a rejection instead of a synchronous throw. */
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

const FIELD_CHECKS: Readonly<Record<string, (field: unknown) => boolean>> = {
  string: (field) => typeof field === 'string',
  nullableString: (field) => field === null || typeof field === 'string',
  number: (field) => typeof field === 'number',
  boolean: (field) => typeof field === 'boolean',
  array: (field) => Array.isArray(field),
  object: (field) => typeof field === 'object' && field !== null,
};

type ShapeField = 'string' | 'nullableString' | 'number' | 'boolean' | 'array' | 'object';

/** A stored-record guard: `value` is an object whose named fields have the listed kinds (per kind,
 * the field names). Cheap enough to run on every read; not a full schema. */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- `T` is the guard's claim, not inferable from `fields`.
export function shapeGuard<T>(
  fields: Readonly<Partial<Record<ShapeField, readonly string[]>>>,
): (value: unknown) => value is T {
  return (value): value is T =>
    isPlainRecord(value) &&
    Object.entries(fields).every(([kind, names]) =>
      names.every((name) => FIELD_CHECKS[kind]?.(value[name]) === true),
    );
}

export interface KeyedCollection<T> {
  get(key: string): Promise<T | undefined>;
  list(filter?: (record: T) => boolean): Promise<T[]>;
  put(record: T): Promise<void>;
  remove(key: string): Promise<void>;
  removeWhere(predicate: (record: T) => boolean): Promise<void>;
}

/** A `LocalStore` record holding `Record<string, T>`, addressed by a key derived from each record
 * (e.g. an id, or `"<profileId>:<lessonId>"`); a value failing `isRecord` is `StorageError`. */
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

export interface CappedList<T> {
  list(filter?: (record: T) => boolean): Promise<T[]>;
  add(record: T): Promise<void>;
  removeWhere(predicate: (record: T) => boolean): Promise<void>;
}

/** A `LocalStore` record holding `T[]`; `add` appends and drops the oldest once past `cap`
 * (`undefined` never trims). `isRecord` guards each element, same as `keyedCollection`. */
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

export interface SingletonRecord<T> {
  get(): Promise<T | undefined>;
  set(value: T): Promise<void>;
}

/** A `LocalStore` record holding one `T` (or nothing yet); no shape guard here, since defaulting
 * stays behaviour-specific in the repository. `defaults` returns in place of `undefined`. */
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

import type { Profile, ProfileRepository } from '@chess-kids/core';
import type { LocalStore } from './local-store.ts';
import { StorageError } from './local-store.ts';

const RECORD_NAME = 'profiles';

function isProfileShape(value: unknown): value is Profile {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { id?: unknown }).id === 'string'
  );
}

function isProfileRecord(value: unknown): value is Record<string, Profile> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every(isProfileShape);
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

/** `ProfileRepository` storing every profile under one `LocalStore` record, keyed by id. */
export class LocalStorageProfileRepository implements ProfileRepository {
  private readonly store: LocalStore;

  constructor(store: LocalStore) {
    this.store = store;
  }

  private readAll(): Map<string, Profile> {
    const raw = this.store.read(RECORD_NAME);
    if (raw === undefined) return new Map();
    if (!isProfileRecord(raw)) {
      throw new StorageError(`Corrupt profile data stored at "${RECORD_NAME}"`);
    }
    return new Map(Object.entries(raw));
  }

  private writeAll(profiles: ReadonlyMap<string, Profile>): void {
    this.store.write(RECORD_NAME, Object.fromEntries(profiles));
  }

  list(): Promise<Profile[]> {
    return toPromise(() => {
      const profiles = [...this.readAll().values()];
      profiles.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
      return profiles;
    });
  }

  get(id: string): Promise<Profile | undefined> {
    return toPromise(() => this.readAll().get(id));
  }

  save(profile: Profile): Promise<void> {
    return toPromise(() => {
      const all = this.readAll();
      all.set(profile.id, profile);
      this.writeAll(all);
    });
  }

  delete(id: string): Promise<void> {
    return toPromise(() => {
      const all = this.readAll();
      if (all.delete(id)) {
        this.writeAll(all);
      }
    });
  }
}

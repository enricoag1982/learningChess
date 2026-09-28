import type { Profile, ProfileRepository } from '@learn/platform-core';
import type { KeyedCollection } from './collections.ts';
import { keyedCollection } from './collections.ts';
import type { LocalStore } from './local-store.ts';
import { STORAGE_KEYS } from './storage-keys.ts';

function isProfileShape(value: unknown): value is Profile {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { id?: unknown }).id === 'string'
  );
}

/** `ProfileRepository` storing every profile under one `LocalStore` record, keyed by id. */
export class LocalStorageProfileRepository implements ProfileRepository {
  private readonly profiles: KeyedCollection<Profile>;

  constructor(store: LocalStore) {
    this.profiles = keyedCollection(
      store,
      STORAGE_KEYS.profiles,
      (profile) => profile.id,
      isProfileShape,
    );
  }

  list(): Promise<Profile[]> {
    return this.profiles
      .list()
      .then((all) =>
        [...all].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)),
      );
  }

  get(id: string): Promise<Profile | undefined> {
    return this.profiles.get(id);
  }

  save(profile: Profile): Promise<void> {
    return this.profiles.put(profile);
  }

  delete(id: string): Promise<void> {
    return this.profiles.remove(id);
  }
}

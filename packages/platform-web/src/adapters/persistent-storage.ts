import type { AppDeps } from '@learn/platform-core';

/** "Have we ever asked" flag, a plain device-level key, not part of `AppSettings`; gates the ask
 * without depending on a settings round trip. */
const REQUESTED_KEY = 'chess-kids:storage-persist-requested';

function alreadyRequested(): boolean {
  try {
    return window.localStorage.getItem(REQUESTED_KEY) === '1';
  } catch {
    return false;
  }
}

function markRequested(): void {
  try {
    window.localStorage.setItem(REQUESTED_KEY, '1');
  } catch {
    // Best-effort only: worst case, a later profile creation asks again.
  }
}

/** Requests persistent storage once, the first profile created on this device
 * (`non-functional.md` §1): browsers may otherwise evict `localStorage` under pressure. Feature-
 * detects `navigator.storage.persist`; best-effort, never blocks profile creation. */
export async function requestPersistentStorageIfNeeded(deps: AppDeps): Promise<void> {
  try {
    if (alreadyRequested()) {
      return;
    }
    const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
    if (typeof storage?.persist !== 'function') {
      return;
    }
    const granted = await storage.persist();
    markRequested();
    const settings = await deps.settings.get();
    await deps.settings.save({ ...settings, storagePersisted: granted });
  } catch {
    // Best-effort only (non-functional.md §1): never blocks profile creation.
  }
}

import type { AppDeps } from '@learn/platform-core';

/** "Have we ever asked" flag, a plain device-level key (under the app's storage prefix), not part
 * of `AppSettings`; gates the ask without depending on a settings round trip. */
const REQUESTED_KEY = 'storage-persist-requested';

function alreadyRequested(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function markRequested(key: string): void {
  try {
    window.localStorage.setItem(key, '1');
  } catch {
    // Best-effort only: worst case, a later profile creation asks again.
  }
}

/** Asks once, at the first profile created (`non-functional.md` §1): browsers may evict `localStorage` under pressure.
 * Feature-detected, best-effort, never blocks creation. */
export async function requestPersistentStorageIfNeeded(deps: AppDeps): Promise<void> {
  const key = `${deps.app.storagePrefix}${REQUESTED_KEY}`;
  try {
    if (alreadyRequested(key)) {
      return;
    }
    const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
    if (typeof storage?.persist !== 'function') {
      return;
    }
    const granted = await storage.persist();
    markRequested(key);
    const settings = await deps.settings.get();
    await deps.settings.save({ ...settings, storagePersisted: granted });
  } catch {
    // Best-effort only (non-functional.md §1): never blocks profile creation.
  }
}

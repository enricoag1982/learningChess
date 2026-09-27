import type { AppDeps } from '@chess-kids/core';

/** localStorage key (`chess-kids:<name>`, `architecture.md` §11) guarding "have we ever asked" —
 * a plain device-level flag, not part of `AppSettings` (same pattern `install-banner.ts`'s own
 * dismiss flag uses). `AppSettings.storagePersisted` is written too, for the parent area to read,
 * but this key alone gates the ask so it never depends on a settings round trip. */
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

/**
 * Requests persistent storage once, the first time any profile is created on this device
 * (`non-functional.md` §1 "Storage eviction"): browsers may otherwise evict `localStorage` under
 * pressure — Safari's "may clear website data after 7 days without use" is the sharpest case.
 * Feature-detects `navigator.storage.persist` (absent in jsdom/older browsers, a no-op there);
 * `REQUESTED_KEY` guards it to exactly once ever. Best-effort only: never throws or blocks
 * profile creation on its own result.
 */
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

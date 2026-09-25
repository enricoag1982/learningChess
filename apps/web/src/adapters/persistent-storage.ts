import type { AppDeps } from '@chess-kids/core';

/** localStorage key (`chess-kids:<name>`, `architecture.md` §11) guarding "have we ever asked" —
 * a plain device-level flag, not part of `AppSettings` (same "own raw key, not the versioned app
 * data" pattern `install-banner.ts`'s own dismiss flag uses). `AppSettings.storagePersisted`
 * (below) is *also* written, for the parent area to read (M5.1) — but a `SettingsRepository.get()`
 * round trip is not this flag's own source of truth: `LocalStorageSettingsRepository`'s
 * `normalize` (M5.1's file, out of this milestone's scope) does not yet carry a fresh field like
 * this one through a read (`ports.ts`'s own note on the field), so gating solely on it would
 * silently re-ask on every single profile created until that adapter catches up. This key does
 * not have that dependency. */
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
 * (`non-functional.md` §1 "Storage eviction", M5.4 decision table): browsers may otherwise evict
 * `localStorage` under pressure — Safari's own "may clear website data after 7 days without use"
 * is the sharpest case, which is also why the iPad install banner (`install-banner.ts`) exists
 * right alongside this. Feature-detects `navigator.storage.persist` (absent in jsdom/older
 * browsers — a no-op there, same as everywhere else in this codebase that reaches for a Web API
 * that is not universal); `REQUESTED_KEY` guards it to exactly once *ever*, so a second profile
 * created on the same device never re-prompts. The result is also written to
 * `AppSettings.storagePersisted` for the parent area to show (M5.1) — see `REQUESTED_KEY`'s own
 * doc comment for why that is not the "already asked" guard itself. Best-effort only: never
 * throws, and never blocks profile creation on its own result (the caller does not need to wait
 * for this to resolve before moving on, though awaiting it, as `store.ts`'s `finishNewPlayer`
 * does, keeps ordering deterministic for tests).
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

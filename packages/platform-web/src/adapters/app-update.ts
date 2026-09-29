import type { RegisterSWOptions } from 'vite-plugin-pwa/types';

/** `virtual:pwa-register`'s `registerSW` shape, passed in so this module never imports the
 * virtual module itself (it does not exist outside a Vite/PWA build); wired in `main.tsx`. */
export type RegisterSW = (options?: RegisterSWOptions) => (reloadPage?: boolean) => Promise<void>;

export interface AppUpdate {
  readonly isUpdateReady: () => boolean;
  /** Applies the waiting update: skip-waiting + reload. Call only at a safe screen (Home/picker),
   * never mid-lesson/game/parent (`docs/non-functional.md` §1). Idempotent. */
  readonly apply: () => Promise<void>;
  /** Calls `listener` when a new version starts waiting, so a kid on a safe screen gets it without navigating. Returns an unsubscribe. */
  readonly onUpdateReady: (listener: () => void) => () => void;
  /** Grown-up action: fetch the newest app now. Offline → 'offline' (nothing changes). Otherwise applies a waiting
   * update if there is one; else unregisters every service worker, deletes every Cache Storage entry and reloads. */
  readonly forceRefresh: () => Promise<'offline' | 'reloading'>;
}

/** Drops the offline copy (service workers + Cache Storage) so the reload fetches the newest app; never touches app data.
 * Each API may be missing (dev, jsdom, old Safari); a failure still ends in the reload. */
async function clearOfflineCopy(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    if ('caches' in globalThis) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // Best effort: a plain reload is still better than a stuck button.
  }
}

/** Registers the service worker once and tracks a waiting update so the app (not Workbox) controls when a new version reloads.
 * No periodic polling (`docs/non-functional.md` §1): the browser's own check plus one on tab visibility. */
export function createAppUpdate(register: RegisterSW): AppUpdate {
  let updateReady = false;
  let applied = false;
  const listeners = new Set<() => void>();
  const updateSW = register({
    onNeedRefresh() {
      updateReady = true;
      for (const listener of listeners) listener();
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void registration.update();
      });
    },
  });

  async function apply(): Promise<void> {
    if (!updateReady || applied) return;
    applied = true;
    await updateSW(true);
  }

  return {
    isUpdateReady: () => updateReady,
    apply,
    onUpdateReady: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    forceRefresh: async () => {
      if (!navigator.onLine) return 'offline';
      if (updateReady) {
        await apply();
      } else {
        await clearOfflineCopy();
        window.location.reload();
      }
      return 'reloading';
    },
  };
}

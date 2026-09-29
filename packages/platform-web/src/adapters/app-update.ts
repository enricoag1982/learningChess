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

  return {
    isUpdateReady: () => updateReady,
    apply: async () => {
      if (!updateReady || applied) return;
      applied = true;
      await updateSW(true);
    },
    onUpdateReady: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

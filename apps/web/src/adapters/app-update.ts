import type { RegisterSWOptions } from 'vite-plugin-pwa/types';

/**
 * `virtual:pwa-register`'s `registerSW` shape (vite-plugin-pwa, `registerType: 'prompt'`,
 * `injectRegister: false` — `vite.config.ts`) — passed in so this module never imports the
 * virtual module itself: it does not exist outside a Vite/PWA build (`vitest.config.ts`'s own
 * note: "the PWA plugin has no role in tests"). The real one is wired in `main.tsx`, the app's
 * composition root; `App.tsx`/`App.test.tsx` never import it, directly or otherwise.
 */
export type RegisterSW = (options?: RegisterSWOptions) => (reloadPage?: boolean) => Promise<void>;

export interface AppUpdate {
  /** True once a new version is waiting (`onNeedRefresh` fired). */
  readonly isUpdateReady: () => boolean;
  /** Applies the waiting update: skip-waiting + reload (`updateSW(true)`). Call only at a safe
   * screen (Home/picker) — never mid-lesson/game/assessment/time-limit/parent (playtest 2,
   * `docs/non-functional.md` §1). Idempotent: a second call after the first is a no-op (the first
   * reload is already under way). A no-op before `onNeedRefresh` has fired. */
  readonly apply: () => Promise<void>;
  /** Calls `listener` when a new version starts waiting, so a kid already sitting on a safe screen
   * gets it without navigating first. Returns an unsubscribe. */
  readonly onUpdateReady: (listener: () => void) => () => void;
}

/**
 * Registers the service worker once and tracks whether an update is waiting, so the app (not
 * Workbox) controls exactly when a new version actually reloads the page. `register` defaults to
 * nothing real: the app's own composition root (`main.tsx`) passes `virtual:pwa-register`'s real
 * `registerSW`; tests pass a fake.
 *
 * Check: no periodic polling (owner decision, `docs/non-functional.md` §1) — only the browser's
 * own check on registration/load, plus a re-check whenever the tab becomes visible again (a
 * kid's tablet often just wakes from sleep, not a fresh load).
 */
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

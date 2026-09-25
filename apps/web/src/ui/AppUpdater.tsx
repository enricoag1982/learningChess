import { useEffect, useRef } from 'react';
import type { AppUpdate } from '../adapters/app-update.ts';
import { useAppStore } from '../app/store.ts';

/** Screens an update is safe to apply at — never mid-lesson/game/assessment/time-limit/parent
 * (playtest 2, `docs/non-functional.md` §1 "App update"). */
function isSafeUpdateScreen(screen: string): boolean {
  return screen === 'home' || screen === 'picker';
}

/**
 * Applies a waiting app update once it is safe to (M-after-MVP, `docs/non-functional.md` §1):
 * `appUpdate.isUpdateReady()` turns true whenever the service worker found a new version
 * (`adapters/app-update.ts`'s own `onNeedRefresh`) — this only ever calls `appUpdate.apply()` at Home
 * or the profile picker: at once if the kid is already there, else on the next arrival there, so an
 * update discovered mid-lesson just waits. Renders nothing; mounted once in `App.tsx`
 * alongside `TimeTracker`/`Celebration`.
 */
export function AppUpdater({ appUpdate }: { readonly appUpdate: AppUpdate }): null {
  const screen = useAppStore((state) => state.screen);
  const screenRef = useRef(screen);

  useEffect(() => {
    screenRef.current = screen;
    if (isSafeUpdateScreen(screen) && appUpdate.isUpdateReady()) {
      void appUpdate.apply();
    }
  }, [screen, appUpdate]);

  // An update found while the kid is already on Home / the picker (e.g. the app reopened there)
  // applies right away instead of waiting for the next screen change.
  useEffect(
    () =>
      appUpdate.onUpdateReady(() => {
        if (isSafeUpdateScreen(screenRef.current)) void appUpdate.apply();
      }),
    [appUpdate],
  );

  return null;
}

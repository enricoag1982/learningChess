import { useEffect, useRef } from 'react';
import type { AppUpdate } from '../adapters/app-update.ts';
import type { Screen } from '../app/store.ts';
import { useAppStore } from '../app/store.ts';
import { ROUTE_META } from '../app/routes.ts';

/** Screens an update is safe to apply at (`ROUTE_META`'s `safeUpdate`) — never mid-lesson/game/
 * parent (`docs/non-functional.md` §1). */
function isSafeUpdateScreen(screen: Screen): boolean {
  return ROUTE_META[screen].safeUpdate === true;
}

/** Applies a waiting app update once safe (`docs/non-functional.md` §1): at Home/picker right
 * away, else on the next arrival there — an update found mid-lesson just waits. */
export function AppUpdater({ appUpdate }: { readonly appUpdate: AppUpdate }): null {
  const screen = useAppStore((state) => state.screen);
  const screenRef = useRef(screen);

  useEffect(() => {
    screenRef.current = screen;
    if (isSafeUpdateScreen(screen) && appUpdate.isUpdateReady()) {
      void appUpdate.apply();
    }
  }, [screen, appUpdate]);

  // Already on Home/the picker: applies right away instead of waiting for a screen change.
  useEffect(
    () =>
      appUpdate.onUpdateReady(() => {
        if (isSafeUpdateScreen(screenRef.current)) void appUpdate.apply();
      }),
    [appUpdate],
  );

  return null;
}

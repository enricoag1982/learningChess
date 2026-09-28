import { useEffect, useRef } from 'react';
import type { AppUpdate } from '../adapters/app-update.ts';
import type { Screen } from '../app/store.ts';
import { useAppStore } from '../app/store.ts';
import { routeMetaFor } from '../app/subject.ts';
import type { SubjectWeb } from '../app/subject.ts';

/** Screens an update is safe to apply at (the route's own `safeUpdate` flag) — never
 * mid-lesson/game/parent (`docs/non-functional.md` §1). */
function isSafeUpdateScreen(pack: SubjectWeb, screen: Screen): boolean {
  return routeMetaFor(pack, screen).safeUpdate === true;
}

/** Applies a waiting app update once safe (`docs/non-functional.md` §1): at Home/picker right
 * away, else on the next arrival there — an update found mid-lesson just waits. */
export function AppUpdater({ appUpdate }: { readonly appUpdate: AppUpdate }): null {
  const pack = useAppStore((state) => state.pack);
  const screen = useAppStore((state) => state.screen);
  const screenRef = useRef(screen);

  useEffect(() => {
    screenRef.current = screen;
    if (isSafeUpdateScreen(pack, screen) && appUpdate.isUpdateReady()) {
      void appUpdate.apply();
    }
  }, [pack, screen, appUpdate]);

  // Already on Home/the picker: applies right away instead of waiting for a screen change.
  useEffect(
    () =>
      appUpdate.onUpdateReady(() => {
        if (isSafeUpdateScreen(pack, screenRef.current)) void appUpdate.apply();
      }),
    [pack, appUpdate],
  );

  return null;
}

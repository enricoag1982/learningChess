import { useEffect, useRef } from 'react';
import { recordSessionMinutes } from '@learn/platform-core';
import type { Screen } from '../app/store.ts';
import { useAppStore, useServices } from '../app/store.ts';
import { routeMetaFor } from '../app/subject.ts';
import type { SubjectWeb } from '../app/subject.ts';

/** One real minute — the log records played time in whole minutes (domain-model.md §2 `SessionLog`). */
const TICK_MS = 60_000;
/** No tracked input for this long pauses tracking (app-structure.md's time controls table). */
const IDLE_LIMIT_MS = 2 * 60_000;
/** Counts as "the kid is doing something" for the idle check — pointer covers tap/drag/click,
 * keydown covers a parent typing in the password/settings screens. */
const INPUT_EVENTS = ['pointerdown', 'keydown'] as const;

function isTrackedScreen(pack: SubjectWeb, screen: Screen): boolean {
  return routeMetaFor(pack, screen).tracked;
}

/** Foreground time tracker (domain-model.md §3.3): while on a tracked screen, adds one minute to
 * today's `SessionLog` every real minute the tab is visible and input is recent; else paused. */
export function TimeTracker(): null {
  const services = useServices();
  const pack = useAppStore((state) => state.pack);
  const profile = useAppStore((state) => state.profile);
  const screen = useAppStore((state) => state.screen);
  const checkTimeNotice = useAppStore((state) => state.checkTimeNotice);
  const profileId = profile?.id ?? null;
  // 0, not `Date.now()`, so the initial render stays pure (react-hooks/purity); the mount effect
  // below sets the real value before anything reads it.
  const lastInputRef = useRef(0);

  useEffect(() => {
    lastInputRef.current = Date.now();
    function markInput(): void {
      lastInputRef.current = Date.now();
    }
    for (const type of INPUT_EVENTS) {
      window.addEventListener(type, markInput, { passive: true });
    }
    return () => {
      for (const type of INPUT_EVENTS) {
        window.removeEventListener(type, markInput);
      }
    };
  }, []);

  // Read at each tick, so a screen change never restarts the minute (short Home/Journey visits
  // between activities still add up).
  const screenRef = useRef(screen);
  useEffect(() => {
    screenRef.current = screen;
    // Arriving at a tracked screen counts as activity, so a kid who is reading/listening rather
    // than tapping is not immediately treated as idle.
    if (isTrackedScreen(pack, screen)) lastInputRef.current = Date.now();
  }, [pack, screen]);

  useEffect(() => {
    if (profileId === null) return;
    const id = window.setInterval(() => {
      if (!isTrackedScreen(pack, screenRef.current) || document.hidden) return;
      if (Date.now() - lastInputRef.current > IDLE_LIMIT_MS) return;
      void recordSessionMinutes(services.deps, profileId, 1, services.deps.clock.now());
      // The other 5-minute-warning trigger (`AppNotice.tsx` runs "screen change"): catches the
      // threshold being crossed while sitting still on an already-calm screen.
      void checkTimeNotice('tick');
    }, TICK_MS);
    return () => {
      window.clearInterval(id);
    };
  }, [pack, profileId, services, checkTimeNotice]);

  return null;
}

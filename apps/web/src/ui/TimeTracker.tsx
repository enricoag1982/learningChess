import { useEffect, useRef } from 'react';
import { recordSessionMinutes } from '@chess-kids/core';
import type { Screen } from '../app/store.ts';
import { useAppStore, useServices } from '../app/store.ts';

/** One real minute — the log records played time in whole minutes (domain-model.md §2 `SessionLog`). */
const TICK_MS = 60_000;
/** No tracked input for this long pauses tracking (app-structure.md's time controls table). */
const IDLE_LIMIT_MS = 2 * 60_000;
/** Counts as "the kid is doing something" for the idle check — pointer covers tap/drag/click alike
 * (`Board`'s own pointer-event model, `docs/architecture.md` §11), keydown covers a parent typing
 * in the password/settings screens. */
const INPUT_EVENTS = ['pointerdown', 'keydown'] as const;

/** Screens where a kid profile is actively playing or browsing (app-structure.md's time controls
 * table: "lessons, practice, play, Home / Journey / Den browsing" all count) — everything except
 * onboarding, the picker, and the parent gate/area, where no kid activity is happening. */
function isTrackedScreen(screen: Screen): boolean {
  return (
    screen !== 'loading' &&
    screen !== 'first-run' &&
    screen !== 'new-player' &&
    screen !== 'picker' &&
    screen !== 'password' &&
    screen !== 'parent' &&
    screen !== 'time-limit'
  );
}

/**
 * Foreground time tracker (M5.2, domain-model.md §3.3 "what counts"): while a kid profile is on a
 * tracked screen, adds one minute to today's `SessionLog` every real minute the tab is visible
 * (`document.hidden`) and the kid has touched/typed something within the last
 * {@link IDLE_LIMIT_MS} — paused otherwise, so a phone left open in a pocket or a background tab
 * never racks up play time. Renders nothing; mounted once in `App.tsx` alongside `Celebration`.
 * Replaces the earlier Today-session-only lump-sum recording (M4.4): every kid-mode screen counts
 * now, not only a Today session, matching the decision table's own "Home / Journey / Den browsing".
 */
export function TimeTracker(): null {
  const services = useServices();
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
    if (isTrackedScreen(screen)) lastInputRef.current = Date.now();
  }, [screen]);

  useEffect(() => {
    if (profileId === null) return;
    const id = window.setInterval(() => {
      if (!isTrackedScreen(screenRef.current) || document.hidden) return;
      if (Date.now() - lastInputRef.current > IDLE_LIMIT_MS) return;
      void recordSessionMinutes(services.deps, profileId, 1, services.deps.clock.now());
      // M7.1 5-minute warning: the other trigger (`AppNotice.tsx` runs the "screen change" one) —
      // catches the threshold being crossed while sitting still on an already-calm screen.
      void checkTimeNotice('tick');
    }, TICK_MS);
    return () => {
      window.clearInterval(id);
    };
  }, [profileId, services, checkTimeNotice]);

  return null;
}

/** Every top-level screen name (`v4 refactor-v4.md` R2 PR C: replaces the old `Screen` union). */
export type RouteName =
  | 'loading'
  | 'first-run'
  | 'new-player'
  | 'picker'
  | 'password'
  | 'parent'
  | 'home'
  | 'journey'
  | 'lesson'
  | 'play'
  | 'den'
  | 'minigame'
  | 'full-game'
  | 'friend-setup'
  | 'friend-game'
  | 'warmup'
  | 'practice'
  | 'practice-run'
  | 'today-summary'
  | 'placement-offer'
  | 'placement'
  | 'assessment'
  | 'time-limit';

/** A navigable place in the app. Widens with typed params (C4a) as screens move their route data
 * here off the store; `{ name }` alone for now. */
export type Route = { readonly name: RouteName };

interface RouteMeta {
  /** Counted by `TimeTracker` (M5.2) while a profile is active. */
  readonly tracked: boolean;
  /** The 5-minute warning (M7.1) may show here (`AppNotice`); `lesson` is calm only on its own
   * lesson-complete step, checked separately, not via this flag. */
  readonly calm?: true;
  /** A waiting app update may apply here (`AppUpdater`, non-functional.md §1). */
  readonly safeUpdate?: true;
  /** Entering this route runs the daily-limit / allowed-hours gate (domain-model.md §3.3). */
  readonly gated?: true;
}

/** Per-route flags, replacing `store.ts`'s `CALM_SCREENS`/`isCalmScreen`, `TimeTracker`'s
 * `isTrackedScreen`, and `AppUpdater`'s `isSafeUpdateScreen`. */
export const ROUTE_META: Readonly<Record<RouteName, RouteMeta>> = {
  loading: { tracked: false },
  'first-run': { tracked: false },
  'new-player': { tracked: false },
  picker: { tracked: false, safeUpdate: true },
  password: { tracked: false },
  parent: { tracked: false },
  home: { tracked: true, calm: true, safeUpdate: true },
  journey: { tracked: true, calm: true },
  lesson: { tracked: true, gated: true },
  play: { tracked: true, calm: true },
  den: { tracked: true, calm: true },
  minigame: { tracked: true, gated: true },
  'full-game': { tracked: true, gated: true },
  'friend-setup': { tracked: true },
  'friend-game': { tracked: true, gated: true },
  warmup: { tracked: true, gated: true },
  practice: { tracked: true, calm: true },
  'practice-run': { tracked: true, gated: true },
  'today-summary': { tracked: true, calm: true },
  'placement-offer': { tracked: true },
  placement: { tracked: true },
  assessment: { tracked: true },
  'time-limit': { tracked: false },
};

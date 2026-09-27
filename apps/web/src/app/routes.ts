import type { AssessmentScope, ConceptTask, PlacementWorldPlan } from '@chess-kids/core';

/** Screen names with no route params of their own. `time-limit` is here only until C4b's stack
 * lands: its status needs to survive underneath a pushed `password` screen (the "Parent: more
 * time" flow), which a single flat `route` field (no stack yet) cannot do — so it stays a
 * `pendingActivity`-style flat field on `TimeSlice` for now, same as today. */
export type PlainRouteName =
  | 'loading'
  | 'first-run'
  | 'new-player'
  | 'picker'
  | 'parent'
  | 'home'
  | 'journey'
  | 'play'
  | 'den'
  | 'friend-setup'
  | 'friend-game'
  | 'warmup'
  | 'practice'
  | 'today-summary'
  | 'placement-offer'
  | 'time-limit';

/** Every top-level screen name (`v4 refactor-v4.md` R2 PR C: replaces the old `Screen` union). */
export type RouteName =
  | PlainRouteName
  | 'password'
  | 'lesson'
  | 'minigame'
  | 'full-game'
  | 'practice-run'
  | 'assessment'
  | 'placement';

/**
 * A navigable place in the app: `screens`' own route data lives here (v4 R2 PR C), not spread over
 * the store's flat fields. `today` on `lesson`/`minigame` lands in C4b, once the origin fields it
 * currently replaces (`lessonOrigin`, `miniGameOrigin`) come out.
 */
export type Route =
  | { readonly name: PlainRouteName }
  | { readonly name: 'password'; readonly purpose: 'parent-area' | 'more-time' }
  | { readonly name: 'lesson'; readonly lessonId: string; readonly startStep: number }
  | { readonly name: 'minigame'; readonly miniGameId: string }
  | { readonly name: 'full-game'; readonly level: 1 | 2 | 3 | 4 | 5 }
  | {
      readonly name: 'practice-run';
      readonly conceptId: string | null;
      readonly tasks: readonly ConceptTask[];
    }
  | {
      readonly name: 'assessment';
      readonly scope: AssessmentScope;
      readonly tasks: readonly ConceptTask[];
    }
  | {
      readonly name: 'placement';
      readonly plan: readonly PlacementWorldPlan[];
      readonly index: number;
    };

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

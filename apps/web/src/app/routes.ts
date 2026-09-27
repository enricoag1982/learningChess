import type {
  AssessmentScope,
  ConceptTask,
  PlacementWorldPlan,
  TimeLimitStatus,
} from '@chess-kids/core';

/** Screen names with no route params of their own. */
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
  | 'placement-offer';

/** Every top-level screen name. */
export type RouteName =
  | PlainRouteName
  | 'password'
  | 'lesson'
  | 'minigame'
  | 'full-game'
  | 'practice-run'
  | 'assessment'
  | 'placement'
  | 'time-limit';

/** A navigable place in the app, carried on the route stack (`app/slices/nav.ts`). `today` marks a
 * Today-session activity: `exitLesson`/`exitMiniGame` abandon the whole session, not a plain back(). */
export type Route =
  | { readonly name: PlainRouteName }
  | { readonly name: 'password'; readonly purpose: 'parent-area' | 'more-time' }
  | {
      readonly name: 'lesson';
      readonly lessonId: string;
      readonly startStep: number;
      readonly today?: true;
    }
  | { readonly name: 'minigame'; readonly miniGameId: string; readonly today?: true }
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
    }
  | {
      readonly name: 'time-limit';
      readonly status: TimeLimitStatus | null;
      /** The blocked navigation, replayed by `grantMoreTimeAndResume` once granted, unchecked. */
      readonly resume: NavOp | null;
    };

/** One requested stack change (`app/slices/nav.ts`): `navigate`/`replace`/`back` each build one of
 * these, and it is what a gate remembers as `time-limit`'s `resume`. */
export type NavOp =
  | { readonly op: 'push'; readonly route: Route }
  | { readonly op: 'replace'; readonly route: Route }
  | { readonly op: 'back'; readonly to?: RouteName; readonly gate?: boolean };

interface RouteMeta {
  /** Counted by `TimeTracker` while a profile is active. */
  readonly tracked: boolean;
  /** The 5-minute warning may show here (`AppNotice`); `lesson` is calm only on its own
   * lesson-complete step, checked separately, not via this flag. */
  readonly calm?: true;
  /** A waiting app update may apply here (`AppUpdater`, non-functional.md §1). */
  readonly safeUpdate?: true;
  /** Entering this route runs the daily-limit / allowed-hours gate (domain-model.md §3.3). */
  readonly gated?: true;
}

/** Per-route flags read by `TimeTracker`, `AppNotice` and `AppUpdater`. */
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

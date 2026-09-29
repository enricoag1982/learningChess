import type {
  AssessmentScope,
  ConceptTask,
  PlacementWorldPlan,
  TimeLimitStatus,
} from '@learn/platform-core';

/** A subject route's param fields by route name, augmented per subject (chess: `play`, `'full-game'` `{level}`,
 * `'friend-setup'`, `'friend-game'`); read back via `useRoute`. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- augmented per subject
export interface SubjectRoutes {}

export type PlainRouteName =
  | 'loading'
  | 'first-run'
  | 'new-player'
  | 'picker'
  | 'parent'
  | 'home'
  | 'journey'
  | 'den'
  | 'warmup'
  | 'practice'
  | 'today-summary'
  | 'placement-offer';

export type RouteName =
  | PlainRouteName
  | 'password'
  | 'lesson'
  | 'minigame'
  | 'practice-run'
  | 'assessment'
  | 'placement'
  | 'time-limit'
  | keyof SubjectRoutes;

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
    }
  | {
      readonly [N in keyof SubjectRoutes]: { readonly name: N } & SubjectRoutes[N];
    }[keyof SubjectRoutes];

/** One requested stack change (`slices/nav.ts`); a gate remembers it as `time-limit`'s `resume`. */
export type NavOp =
  | { readonly op: 'push'; readonly route: Route }
  | { readonly op: 'replace'; readonly route: Route }
  | { readonly op: 'back'; readonly to?: RouteName; readonly gate?: boolean };

export interface RouteMeta {
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

/** Fallback for a route the `RouteMeta` lookup misses (never in practice). */
export const DEFAULT_ROUTE_META: RouteMeta = { tracked: false };

/** Per-platform-route flags read by `TimeTracker`, `AppNotice` and `AppUpdater`; a subject route's
 * own flags live on its `SubjectWeb.routes` entry instead (`subject.ts`'s `routeMetaFor`). */
export const PLATFORM_ROUTE_META: Readonly<Partial<Record<RouteName, RouteMeta>>> = {
  loading: { tracked: false },
  'first-run': { tracked: false },
  'new-player': { tracked: false },
  picker: { tracked: false, safeUpdate: true },
  password: { tracked: false },
  parent: { tracked: false },
  home: { tracked: true, calm: true, safeUpdate: true },
  journey: { tracked: true, calm: true },
  lesson: { tracked: true, gated: true },
  den: { tracked: true, calm: true },
  minigame: { tracked: true, gated: true },
  warmup: { tracked: true, gated: true },
  practice: { tracked: true, calm: true },
  'practice-run': { tracked: true, gated: true },
  'today-summary': { tracked: true, calm: true },
  'placement-offer': { tracked: true },
  placement: { tracked: true },
  assessment: { tracked: true },
  'time-limit': { tracked: false },
};

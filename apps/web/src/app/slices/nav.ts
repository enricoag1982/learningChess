import { checkActivityGate, isFirstRun, listProfiles } from '@chess-kids/core';
import type { Profile, TimeLimitStatus } from '@chess-kids/core';
import type { AppGet, AppSet } from '../store.ts';
import type { NavOp, Route, RouteName } from '../routes.ts';
import { ROUTE_META } from '../routes.ts';

export interface NavSlice {
  /** The navigation stack, root first, current screen last. */
  readonly stack: readonly Route[];
  /** The current screen's name; always `stack[stack.length - 1].name`. */
  readonly screen: RouteName;
  /** Pushes `route`. Gated routes (`ROUTE_META`) check the daily-limit/allowed-hours gate first —
   * over the limit, pushes `time-limit` instead, remembering this push to replay once granted. */
  readonly navigate: (route: Route) => Promise<void>;
  /** Same as `navigate`, but replaces the current top instead of pushing (Today session activities
   * advancing in place, a placement world moving on). */
  readonly replace: (route: Route) => Promise<void>;
  /** Pops back to the nearest `to` frame (or one level, without `to`). `gate: true` runs the
   * activity gate on the way (`goToHome`'s "back to Home" checkpoint) even though the landing
   * route itself is not one of `ROUTE_META`'s gated ones. */
  readonly back: (to?: RouteName, opts?: { readonly gate?: boolean }) => Promise<void>;
  /** Replaces the whole stack, ungated (first run, the picker, picking a profile). */
  readonly reset: (...routes: readonly Route[]) => void;
  /** Applies a `time-limit` route's `resume` without re-gating — the parent just granted more
   * time. Shared with `grantMoreTimeAndResume` (`app/slices/time.ts`). */
  readonly applyResume: (resume: NavOp) => Promise<void>;

  /** Decides the first screen: first run, or the picker (app-structure.md §3). Call once at startup. */
  readonly init: () => Promise<void>;
  /** Opens the new-player wizard, pushed on whatever it was opened from (picker or parent area) —
   * `finishNewPlayer` reads that back off the stack to decide where it returns to. */
  readonly startNewPlayer: () => void;
  /** Refreshes the profiles list and shows the picker, last-used first. */
  readonly goToPicker: () => Promise<void>;
  /** Opens the Journey map. */
  readonly goToJourney: () => void;
  /** Journey's back button, Play's/Den's/Practice's back button. */
  readonly goToHome: () => void;
  /** Opens the Play screen. */
  readonly goToPlay: () => void;
  /** Opens My Den. */
  readonly goToDen: () => void;
  /** Opens the Practice screen. */
  readonly goToPractice: () => void;
}

/** `lesson` resumes at its own `startStep`; a fresh `full-game` (or one resumed after "Parent:
 * more time") never opens still showing the previous game's level-up banner. Runs once per landed
 * route, on every `navigate`/`replace`/`back`/`reset`/gate-resume alike. */
function runRouteEnter(set: AppSet, route: Route): void {
  if (route.name === 'lesson') set({ stepIndex: route.startStep });
  if (route.name === 'full-game') set({ levelUpSuggestion: null });
}

/** Sets the stack and keeps `screen` equal to its top's name. */
function setStack(set: AppSet, stack: readonly Route[]): void {
  const top = stack[stack.length - 1];
  set({ stack, screen: top?.name ?? 'loading' });
  if (top) runRouteEnter(set, top);
}

function lastIndexOfName(stack: readonly Route[], name: RouteName): number {
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    if (stack[i]?.name === name) return i;
  }
  return -1;
}

/** The activity gate's current read (domain-model.md §3.3), or `null` under the limit / with
 * no active profile — never blocks first-run/picker/parent-area navigation. */
async function overLimitStatus(get: AppGet): Promise<TimeLimitStatus | null> {
  const { profile, services } = get();
  if (!profile) return null;
  const status = await checkActivityGate(services.deps, profile.id);
  return status.overLimit ? status : null;
}

/**
 * Runs one stack change. `skipGate` is set only when replaying a `time-limit` route's `resume`
 * (`grantMoreTimeAndResume`) — the parent already granted more time, so this is never re-checked.
 */
async function runOp(set: AppSet, get: AppGet, op: NavOp, skipGate: boolean): Promise<void> {
  const needsGate =
    !skipGate &&
    (op.op === 'push' || op.op === 'replace'
      ? ROUTE_META[op.route.name].gated === true
      : op.op === 'back' && op.gate === true);
  if (needsGate) {
    const status = await overLimitStatus(get);
    if (status) {
      setStack(set, [...get().stack, { name: 'time-limit', status, resume: op }]);
      return;
    }
  }
  switch (op.op) {
    case 'push':
      setStack(set, [...get().stack, op.route]);
      return;
    case 'replace':
      setStack(set, [...get().stack.slice(0, -1), op.route]);
      return;
    case 'back': {
      const stack = get().stack;
      const landingIndex = op.to ? lastIndexOfName(stack, op.to) : stack.length - 2;
      const safeIndex = landingIndex >= 0 ? landingIndex : 0;
      setStack(set, stack.slice(0, safeIndex + 1));
      return;
    }
    case 'reset':
      setStack(set, op.routes);
      return;
  }
}

/** Last-used profile first (docs/screens.md: picker shows it first), rest unchanged. */
function orderByLastUsed(profiles: readonly Profile[], lastProfileId: string | null): Profile[] {
  const ordered = [...profiles];
  if (lastProfileId === null) return ordered;
  const index = ordered.findIndex((profile) => profile.id === lastProfileId);
  if (index <= 0) return ordered;
  const [last] = ordered.splice(index, 1);
  if (last) ordered.unshift(last);
  return ordered;
}

/** Test-only: drops the whole stack down to exactly `route`, no gate, no `ROUTE_ENTER`. Replaces
 * `store.setState({ screen: ... })` now that a screen's own data lives in its route. */
export function setRoute(store: { readonly setState: AppSet }, route: Route): void {
  store.setState({ stack: [route], screen: route.name });
}

export function createNavSlice(set: AppSet, get: AppGet): NavSlice {
  return {
    stack: [{ name: 'loading' }],
    screen: 'loading',

    async navigate(route: Route) {
      await runOp(set, get, { op: 'push', route }, false);
    },

    async replace(route: Route) {
      await runOp(set, get, { op: 'replace', route }, false);
    },

    async back(to, opts) {
      await runOp(set, get, { op: 'back', to, gate: opts?.gate }, false);
    },

    reset(...routes: readonly Route[]) {
      setStack(set, routes);
    },

    async applyResume(resume: NavOp) {
      await runOp(set, get, resume, true);
    },

    async init() {
      const { services } = get();
      if (await isFirstRun(services.deps)) {
        get().reset({ name: 'first-run' });
        return;
      }
      await get().goToPicker();
    },

    startNewPlayer() {
      void get().navigate({ name: 'new-player' });
    },

    async goToPicker() {
      const { services } = get();
      const [profiles, settings] = await Promise.all([
        listProfiles(services.deps),
        services.deps.settings.get(),
      ]);
      set({ profiles: orderByLastUsed(profiles, settings.lastProfileId) });
      get().reset({ name: 'picker' });
    },

    goToJourney() {
      void get().navigate({ name: 'journey' });
    },

    goToHome() {
      set({ levelUpSuggestion: null });
      void get().back('home', { gate: true });
    },

    goToPlay() {
      void get().navigate({ name: 'play' });
    },

    goToDen() {
      void get().navigate({ name: 'den' });
    },

    goToPractice() {
      void get().navigate({ name: 'practice' });
    },
  };
}

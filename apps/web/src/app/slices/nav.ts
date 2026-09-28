import { checkActivityGate, isFirstRun, listProfiles } from '@chess-kids/core';
import type { Profile, TimeLimitStatus } from '@chess-kids/core';
import type { AppGet, AppSet, SliceCreator } from '../store.ts';
import { routeMetaFor } from '../subject.ts';
import type { NavOp, Route, RouteName } from '../routes.ts';

export interface NavSlice {
  /** The navigation stack, root first, current screen last. */
  readonly stack: readonly Route[];
  /** The current screen's name; always `stack[stack.length - 1].name`. */
  readonly screen: RouteName;
  /** Pushes `route`; a gated route (`ROUTE_META`) over the limit pushes `time-limit` instead. */
  readonly navigate: (route: Route) => Promise<void>;
  /** Same as `navigate`, but replaces the current top instead of pushing. */
  readonly replace: (route: Route) => Promise<void>;
  /** Pops back to the nearest `to` frame (or one level). `gate: true` runs the activity gate on
   * the way even though the landing route is not itself gated. */
  readonly back: (to?: RouteName, opts?: { readonly gate?: boolean }) => Promise<void>;
  /** Replaces the whole stack, ungated. */
  readonly reset: (...routes: readonly Route[]) => void;
  /** Applies a `time-limit` route's `resume` without re-gating. Shared with `time.ts`'s
   * `grantMoreTimeAndResume`. */
  readonly applyResume: (resume: NavOp) => Promise<void>;

  /** Decides the first screen: first run, or the picker (app-structure.md §3). */
  readonly init: () => Promise<void>;
  /** Opens the new-player wizard, pushed on whatever opened it; `finishNewPlayer` reads that
   * back off the stack. */
  readonly startNewPlayer: () => void;
  /** Refreshes the profiles list and shows the picker, last-used first. */
  readonly goToPicker: () => Promise<void>;
  /** Opens the Journey map. */
  readonly goToJourney: () => void;
  /** Journey's back button, Play's/Den's/Practice's back button. */
  readonly goToHome: () => void;
  /** Opens My Den. */
  readonly goToDen: () => void;
  /** Opens the Practice screen. */
  readonly goToPractice: () => void;
}

/** `lesson` resumes at its own `startStep`; a subject route's own entry side effect (chess:
 * `full-game` clears any stale level-up banner) runs from its pack entry. Runs once per landed
 * route, on every navigation. */
function runRouteEnter(set: AppSet, get: AppGet, route: Route): void {
  if (route.name === 'lesson') set({ stepIndex: route.startStep });
  get().pack.routes[route.name]?.onEnter?.(set);
}

/** Sets the stack and keeps `screen` equal to its top's name. */
function setStack(set: AppSet, get: AppGet, stack: readonly Route[]): void {
  const top = stack[stack.length - 1];
  set({ stack, screen: top?.name ?? 'loading' });
  if (top) runRouteEnter(set, get, top);
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

/** Runs one stack change. `skipGate` is set only when replaying a `time-limit` route's `resume`
 * — the parent already granted more time, so this is never re-checked. */
async function runOp(set: AppSet, get: AppGet, op: NavOp, skipGate: boolean): Promise<void> {
  const needsGate =
    !skipGate &&
    (op.op === 'push' || op.op === 'replace'
      ? routeMetaFor(get().pack, op.route.name).gated === true
      : op.gate === true);
  if (needsGate) {
    const status = await overLimitStatus(get);
    if (status) {
      setStack(set, get, [...get().stack, { name: 'time-limit', status, resume: op }]);
      return;
    }
  }
  switch (op.op) {
    case 'push':
      setStack(set, get, [...get().stack, op.route]);
      return;
    case 'replace':
      setStack(set, get, [...get().stack.slice(0, -1), op.route]);
      return;
    case 'back': {
      const stack = get().stack;
      const landingIndex = op.to ? lastIndexOfName(stack, op.to) : stack.length - 2;
      const safeIndex = landingIndex >= 0 ? landingIndex : 0;
      setStack(set, get, stack.slice(0, safeIndex + 1));
      return;
    }
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

/** A plain-route action that just navigates there, no other logic. */
function navigateTo(get: AppGet, name: 'new-player' | 'journey' | 'den' | 'practice') {
  return (): void => void get().navigate({ name });
}

export const createNavSlice: SliceCreator<NavSlice> = (set, get) => {
  return {
    stack: [{ name: 'loading' }],
    screen: 'loading',

    navigate: (route) => runOp(set, get, { op: 'push', route }, false),
    replace: (route) => runOp(set, get, { op: 'replace', route }, false),
    back: (to, opts) => runOp(set, get, { op: 'back', to, gate: opts?.gate }, false),
    reset: (...routes) => {
      setStack(set, get, routes);
    },
    applyResume: (resume) => runOp(set, get, resume, true),

    async init() {
      const { services } = get();
      if (await isFirstRun(services.deps)) {
        get().reset({ name: 'first-run' });
        return;
      }
      await get().goToPicker();
    },

    startNewPlayer: navigateTo(get, 'new-player'),

    async goToPicker() {
      const { services } = get();
      const [profiles, settings] = await Promise.all([
        listProfiles(services.deps),
        services.deps.settings.get(),
      ]);
      set({ profiles: orderByLastUsed(profiles, settings.lastProfileId) });
      get().reset({ name: 'picker' });
    },

    goToJourney: navigateTo(get, 'journey'),

    goToHome() {
      set(get().pack.homeReset ?? {});
      void get().back('home', { gate: true });
    },

    goToDen: navigateTo(get, 'den'),
    goToPractice: navigateTo(get, 'practice'),
  };
};

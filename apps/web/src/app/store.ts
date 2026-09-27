import { createContext, useContext } from 'react';
import { create } from 'zustand';
import type { StoreApi } from 'zustand';
import type { Route, RouteName } from './routes.ts';
import type { Services } from './services.ts';
import type { LearnSlice } from './slices/learn.ts';
import { createLearnSlice } from './slices/learn.ts';
import type { NavSlice } from './slices/nav.ts';
import { createNavSlice } from './slices/nav.ts';
import type { PlaySlice } from './slices/play.ts';
import { createPlaySlice } from './slices/play.ts';
import type { ProfileSlice } from './slices/profile.ts';
import { createProfileSlice } from './slices/profile.ts';
import type { RewardsSlice } from './slices/rewards.ts';
import { createRewardsSlice } from './slices/rewards.ts';
import type { TimeSlice } from './slices/time.ts';
import { createTimeSlice } from './slices/time.ts';
import type { TodaySlice } from './slices/today.ts';
import { createTodaySlice } from './slices/today.ts';

/** Test-only stack override — see `slices/nav.ts`'s own doc comment. Re-exported here so ui tests
 * only need one import path for the store. */
export { setRoute } from './slices/nav.ts';

/** Which top-level screen is showing. `loading` is the instant before `init()` resolves. */
export type Screen = RouteName;

/** App-wide state: which screen shows, every profile on the device, the active one and its
 * progress — composed from `app/slices/*.ts` (v4 R2 PR C), one file per domain. */
export interface AppState
  extends NavSlice, ProfileSlice, RewardsSlice, TimeSlice, LearnSlice, TodaySlice, PlaySlice {
  readonly services: Services;
}

/** Bound `set`/`get` a slice file receives from `createAppStore`, typed against the full
 * {@link AppState} (not just its own slice) so any action can read or write any field. */
export type AppSet = StoreApi<AppState>['setState'];
export type AppGet = StoreApi<AppState>['getState'];

/** A created store instance, as returned by `createAppStore` (one per `App`, for test isolation). */
export type AppStore = ReturnType<typeof createAppStore>;

/** Builds a fresh Zustand store bound to `services`; call once per `App` instance. */
export function createAppStore(services: Services) {
  return create<AppState>((set, get) => ({
    services,
    ...createNavSlice(set, get),
    ...createProfileSlice(set, get),
    ...createRewardsSlice(set, get),
    ...createTimeSlice(set, get),
    ...createLearnSlice(set, get),
    ...createTodaySlice(set, get),
    ...createPlaySlice(set, get),
  }));
}

const StoreContext = createContext<AppStore | null>(null);

export const StoreProvider = StoreContext.Provider;

/** Reads a slice of the current `App`'s store; must be used under `StoreProvider`. */
export function useAppStore<T>(selector: (state: AppState) => T): T {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error('useAppStore must be used within a StoreProvider');
  }
  return store(selector);
}

/** Convenience: the wired services (rules, narrator, content, use-case deps). */
export function useServices(): Services {
  return useAppStore((state) => state.services);
}

/** The current route (the stack's top), narrowed to `name`'s own param shape; `null` when a
 * different route shows. */
export function useRoute<N extends RouteName>(name: N): Extract<Route, { name: N }> | null {
  const route = useAppStore((state) => state.stack[state.stack.length - 1]);
  return route?.name === name ? (route as Extract<Route, { name: N }>) : null;
}

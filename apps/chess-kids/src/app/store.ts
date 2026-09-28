import { createContext, useContext } from 'react';
import { create, type StoreApi } from 'zustand';
import type { Route, RouteName } from './routes.ts';
import type { Services } from './services.ts';
import type { SubjectState, SubjectWeb } from './subject.ts';
import { createLearnSlice, type LearnSlice } from './slices/learn.ts';
import { createNavSlice, type NavSlice } from './slices/nav.ts';
import { createProfileSlice, type ProfileSlice } from './slices/profile.ts';
import { createRewardsSlice, type RewardsSlice } from './slices/rewards.ts';
import { createTimeSlice, type TimeSlice } from './slices/time.ts';
import { createTodaySlice, type TodaySlice } from './slices/today.ts';

/** Test-only stack override — see `slices/nav.ts`'s own doc comment. Re-exported here so ui tests
 * only need one import path for the store. */
export { setRoute } from './slices/nav.ts';

/** Which top-level screen is showing. `loading` is the instant before `init()` resolves. */
export type Screen = RouteName;

/** App-wide state, composed from `app/slices/*.ts`, one file per domain, plus the active subject's
 * own slice (`pack.createSlice`, chess: `PlaySlice`, via `SubjectState`). */
export interface AppState
  extends NavSlice, ProfileSlice, RewardsSlice, TimeSlice, LearnSlice, TodaySlice, SubjectState {
  readonly services: Services;
  readonly pack: SubjectWeb;
}

/** Bound `set`/`get` a slice file receives from `createAppStore`, typed against the full
 * {@link AppState} (not just its own slice) so any action can read or write any field. */
export type AppSet = StoreApi<AppState>['setState'];
export type AppGet = StoreApi<AppState>['getState'];

/** One slice's `create*Slice(set, get)` factory. */
export type SliceCreator<T> = (set: AppSet, get: AppGet) => T;

/** Pops back (optionally to a named, gated frame) and refreshes progress — the shared shape of
 * several slices' "leave a session" exit actions. */
export function backAndRefresh(
  get: AppGet,
  to?: RouteName,
  opts?: { readonly gate?: boolean },
): () => void {
  return () => {
    void get().back(to, opts);
    void get().refreshProgress();
  };
}

/** A created store instance, as returned by `createAppStore` (one per `App`, for test isolation). */
export type AppStore = ReturnType<typeof createAppStore>;

/** Builds a fresh Zustand store bound to `services` and `pack`; call once per `App` instance. */
export function createAppStore(services: Services, pack: SubjectWeb) {
  return create<AppState>((set, get) => ({
    services,
    pack,
    ...createNavSlice(set, get),
    ...createProfileSlice(set, get, pack),
    ...createRewardsSlice(set, get),
    ...createTimeSlice(set, get),
    ...createLearnSlice(set, get),
    ...createTodaySlice(set, get),
    // A subject with no `createSlice` has nothing to add to `SubjectState` (it stays the empty
    // base interface for that build), so `{}` is a real `SubjectState` here — TS just cannot see
    // across the optional call to prove it.
    ...(pack.createSlice ? pack.createSlice(set, get) : ({} as SubjectState)),
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

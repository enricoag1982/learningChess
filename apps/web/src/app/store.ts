import { createContext, useContext } from 'react';
import { create } from 'zustand';
import type { Lesson, LessonProgress, Profile } from '@chess-kids/core';
import {
  createProfile,
  getLessonProgress,
  isFirstRun,
  lessonStatus,
  listProfiles,
  loadProgress,
  selectProfile,
} from '@chess-kids/core';
import type { Services } from './services.ts';

/** Which top-level screen is showing. `loading` is the instant before `init()` resolves. */
export type Screen =
  'loading' | 'first-run' | 'new-player' | 'picker' | 'password' | 'parent' | 'home' | 'lesson';

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

/** App-wide state: which screen shows, every profile on the device, the active one and its progress. */
export interface AppState {
  readonly services: Services;
  readonly screen: Screen;
  /** Every profile on this device (picker tiles, parent area's children list). */
  readonly profiles: readonly Profile[];
  /** The kid currently playing (Home / Lesson); `null` outside those screens. */
  readonly profile: Profile | null;
  readonly progress: readonly LessonProgress[];
  readonly lessonId: string | null;
  readonly stepIndex: number;
  /** New-player wizard: return to Parent area instead of Home once it creates the profile. */
  readonly newPlayerReturnsToParent: boolean;

  /** Decides the first screen: first run, or the picker (app-structure.md §3). Call once at startup. */
  readonly init: () => Promise<void>;
  /** First run only: after the "Saved" screen, either straight to the new-player wizard, straight to
   * Home (a single existing profile — the M1-upgrade path), or the picker (more than one). */
  readonly finishFirstRun: () => Promise<void>;
  /** Opens the new-player wizard; `returnsToParent` when entered from the parent area's "Add child". */
  readonly startNewPlayer: (returnsToParent: boolean) => void;
  /** New-player wizard's last step: creates the profile, then Home or back to the parent area. */
  readonly finishNewPlayer: (nickname: string, avatar: string) => Promise<void>;
  /** Refreshes the profiles list and shows the picker, last-used first. */
  readonly goToPicker: () => Promise<void>;
  /** Picker: selects a profile, loads its progress, and goes to Home. */
  readonly selectProfileAndHome: (profileId: string) => Promise<void>;
  /** Picker's "Grown-ups" button. */
  readonly goToPasswordScreen: () => void;
  /** Password screen, once the password is verified. */
  readonly goToParentArea: () => Promise<void>;
  /** Re-reads the profiles list without changing screen (parent area, after rename/avatar/delete/add). */
  readonly refreshProfiles: () => Promise<void>;
  /** Enters a lesson: resumes at its saved step, or restarts at the story once it is complete. */
  readonly startLesson: (lessonId: string) => Promise<void>;
  readonly goToStep: (index: number) => void;
  /** Leaves the lesson screen for Home; progress up to here is already saved. */
  readonly exitLesson: () => void;
  /** Re-reads saved progress from storage (e.g. after a lesson updates it). */
  readonly refreshProgress: () => Promise<void>;
}

/** A created store instance, as returned by `createAppStore` (one per `App`, for test isolation). */
export type AppStore = ReturnType<typeof createAppStore>;

/** Builds a fresh Zustand store bound to `services`; call once per `App` instance. */
export function createAppStore(services: Services) {
  return create<AppState>((set, get) => ({
    services,
    screen: 'loading',
    profiles: [],
    profile: null,
    progress: [],
    lessonId: null,
    stepIndex: 0,
    newPlayerReturnsToParent: false,

    async init() {
      if (await isFirstRun(services.deps)) {
        set({ screen: 'first-run' });
        return;
      }
      await get().goToPicker();
    },

    async finishFirstRun() {
      const profiles = await listProfiles(services.deps);
      if (profiles.length === 0) {
        set({ screen: 'new-player', newPlayerReturnsToParent: false, profiles });
        return;
      }
      const [only] = profiles;
      if (profiles.length === 1 && only) {
        // M1-upgrade path: an existing single profile with no parent lock yet skips profile
        // creation and goes straight to Home (see the M2.1 spec's "Existing installs" note).
        await selectProfile(services.deps, only.id);
        const progress = await loadProgress(services.deps, only.id);
        set({ profile: only, progress, profiles, screen: 'home' });
        return;
      }
      await get().goToPicker();
    },

    startNewPlayer(returnsToParent: boolean) {
      set({ screen: 'new-player', newPlayerReturnsToParent: returnsToParent });
    },

    async finishNewPlayer(nickname: string, avatar: string) {
      const profile = await createProfile(services.deps, nickname, avatar);
      if (get().newPlayerReturnsToParent) {
        const profiles = await listProfiles(services.deps);
        set({ profiles, screen: 'parent' });
        return;
      }
      await selectProfile(services.deps, profile.id);
      const [profiles, progress] = await Promise.all([
        listProfiles(services.deps),
        loadProgress(services.deps, profile.id),
      ]);
      set({ profile, progress, profiles, screen: 'home' });
    },

    async goToPicker() {
      const [profiles, settings] = await Promise.all([
        listProfiles(services.deps),
        services.deps.settings.get(),
      ]);
      set({ profiles: orderByLastUsed(profiles, settings.lastProfileId), screen: 'picker' });
    },

    async selectProfileAndHome(profileId: string) {
      const profile = await services.deps.profiles.get(profileId);
      if (!profile) return;
      await selectProfile(services.deps, profileId);
      const progress = await loadProgress(services.deps, profileId);
      set({ profile, progress, screen: 'home' });
    },

    goToPasswordScreen() {
      set({ screen: 'password' });
    },

    async goToParentArea() {
      const profiles = await listProfiles(services.deps);
      set({ profiles, screen: 'parent' });
    },

    async refreshProfiles() {
      const profiles = await listProfiles(services.deps);
      set({ profiles });
    },

    async startLesson(lessonId: string) {
      const { profile } = get();
      if (!profile) return;
      const lesson: Lesson | undefined = services.deps.content.lesson(lessonId);
      if (!lesson) return;
      const saved = await getLessonProgress(services.deps, profile.id, lessonId);
      const status = lessonStatus(lesson, saved);
      const startIndex = status === 'complete' || status === 'mastered' ? 0 : saved.resumeStep;
      set({ screen: 'lesson', lessonId, stepIndex: startIndex });
    },

    goToStep(index: number) {
      set({ stepIndex: index });
    },

    exitLesson() {
      set({ screen: 'home', lessonId: null, stepIndex: 0 });
      void get().refreshProgress();
    },

    async refreshProgress() {
      const { profile } = get();
      if (!profile) return;
      const progress = await loadProgress(services.deps, profile.id);
      set({ progress });
    },
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

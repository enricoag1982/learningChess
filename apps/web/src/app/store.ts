import { createContext, useContext } from 'react';
import { create } from 'zustand';
import type { Lesson, LessonProgress, Profile } from '@chess-kids/core';
import { ensureProfile, getLessonProgress, lessonStatus, loadProgress } from '@chess-kids/core';
import type { Services } from './services.ts';

/** Which top-level screen is showing. */
export type Screen = 'home' | 'lesson';

/** App-wide state: profile, saved progress, current screen and (if in a lesson) its position. */
export interface AppState {
  readonly services: Services;
  readonly screen: Screen;
  readonly profile: Profile | null;
  readonly progress: readonly LessonProgress[];
  readonly lessonId: string | null;
  readonly stepIndex: number;
  /** Loads (or creates) the local profile and its saved progress. Call once at startup. */
  readonly init: () => Promise<void>;
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
    screen: 'home',
    profile: null,
    progress: [],
    lessonId: null,
    stepIndex: 0,

    async init() {
      const profile = await ensureProfile(services.deps);
      const progress = await loadProgress(services.deps, profile.id);
      set({ profile, progress });
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

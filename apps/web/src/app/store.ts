import { createContext, useContext } from 'react';
import { create } from 'zustand';
import type {
  AnimalFriend,
  ConceptStats,
  ConceptTask,
  Journey,
  Lesson,
  LessonProgress,
  MiniGameProgress,
  Profile,
  TodaySessionPlan,
} from '@chess-kids/core';
import {
  animalFriends,
  createProfile,
  getLessonProgress,
  isFirstRun,
  lessonStatus,
  listProfiles,
  loadJourney,
  loadMiniGameProgress,
  loadPracticeTasks,
  loadProgress,
  loadTodaySession,
  loadWarmUp,
  selectProfile,
  totalStars,
} from '@chess-kids/core';
import type { Services } from './services.ts';

/** Which top-level screen is showing. `loading` is the instant before `init()` resolves. */
export type Screen =
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
  | 'warmup'
  | 'practice'
  | 'practice-run'
  | 'today-summary';

/** Where the current lesson was opened from: decides where "Continue"/Close returns to.
 * `today`: opened as a Today session's lesson (or world-boss) activity — see `startToday`. */
export type LessonOrigin = 'home' | 'journey' | 'today';

/** Where the current standalone mini-game session was opened from: decides where its exit returns to.
 * `today`: opened as a Today session's world-boss or mini-game activity — see `startToday`. */
export type MiniGameOrigin = 'play' | 'journey' | 'home' | 'today';

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
  /** This profile's standalone mini-game progress (Play screen's best-stars tiles). */
  readonly miniGameProgress: readonly MiniGameProgress[];
  /** This profile's concept mastery + review state (M3.4 Leitner scheduler): Home's "Start today"
   * button and the Practice screen's due count / weak tags both read this. */
  readonly conceptStats: readonly ConceptStats[];
  /** This profile's Journey (tracks/worlds/lesson statuses/next lesson/rank); `null` until loaded. */
  readonly journey: Journey | null;
  readonly lessonId: string | null;
  readonly stepIndex: number;
  /** Where the open lesson was entered from; decides where Close/Continue returns to. */
  readonly lessonOrigin: LessonOrigin;
  /** New-player wizard: return to Parent area instead of Home once it creates the profile. */
  readonly newPlayerReturnsToParent: boolean;
  /** The mini-game open in a standalone Play session (screen `minigame`); `null` otherwise. */
  readonly miniGameId: string | null;
  /** Where the open standalone mini-game session was entered from; decides `exitMiniGame`'s target. */
  readonly miniGameOrigin: MiniGameOrigin;

  /** The Today session in progress (`startToday`), or `null` outside one. */
  readonly todayPlan: TodaySessionPlan | null;
  /** Index into `todayPlan.activities` of the activity currently showing. */
  readonly todayActivityIndex: number;
  /** `totalStars(progress)` snapshotted at `startToday`, so the summary can show the delta. */
  readonly todaySessionStartTotalStars: number;
  /** `animalFriends(...)` snapshotted at `startToday`, so the summary can show newly-earned ones. */
  readonly todaySessionStartFriends: readonly AnimalFriend[];
  /** `journey.rank.id` snapshotted at `startToday`, so the summary can show a rank-up. */
  readonly todaySessionStartRankId: string | null;

  /** The Practice topic run's concept (screen `practice-run`); `null` outside one. */
  readonly practiceConceptId: string | null;
  readonly practiceTasks: readonly ConceptTask[];

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
  /** Opens the Journey map. */
  readonly goToJourney: () => void;
  /** Journey's back button. */
  readonly goToHome: () => void;
  /**
   * Journey tap: opens `lessonId` (available / complete / mastered only — a no-op for a locked
   * one, which the Journey screen intercepts with a spoken "Finish … first" line instead). A
   * complete/mastered lesson restarts at the story; otherwise resumes at its saved step.
   */
  readonly startLesson: (lessonId: string) => Promise<void>;
  readonly goToStep: (index: number) => void;
  /**
   * Leaves the lesson screen (top-bar Close) for Home or the Journey, whichever it was opened
   * from; a Today-session lesson (`lessonOrigin: 'today'`) abandons the whole session instead
   * (`leaveToday` — "the kid can leave any time", domain-model.md §3.3).
   */
  readonly exitLesson: () => void;
  /**
   * The lesson-complete screen's "Continue": a Today-session lesson advances to the session's next
   * activity (`advanceToday`); otherwise identical to `exitLesson`.
   */
  readonly completeLessonActivity: () => Promise<void>;
  /**
   * Re-reads saved progress (lesson + mini-game) and the derived Journey from storage, e.g. after
   * a lesson or a standalone mini-game session updates it.
   */
  readonly refreshProgress: () => Promise<void>;
  /** Opens the Play screen. */
  readonly goToPlay: () => void;
  /** Opens My Den. */
  readonly goToDen: () => void;
  /**
   * Opens a mini-game's standalone session: from the Play screen (unlocked tiles only) or the
   * Journey map's world boss node. A Today session's world-boss / mini-game activity opens the
   * same screen directly (`enterTodayActivity`), with `miniGameOrigin: 'today'`.
   * `origin` (default `'play'`) decides where `exitMiniGame` returns to.
   */
  readonly startMiniGame: (miniGameId: string, origin?: MiniGameOrigin) => void;
  /**
   * Leaves the standalone mini-game session for wherever it was opened from; a Today-session
   * mini-game (`miniGameOrigin: 'today'`) abandons the whole session instead (`leaveToday`).
   */
  readonly exitMiniGame: () => void;

  /**
   * Home's "Start today" (domain-model.md §3.3): plans the session (`loadTodaySession`), snapshots
   * stars/friends/rank for the summary, and opens its first activity. No-op without a profile.
   */
  readonly startToday: () => Promise<void>;
  /** Moves to the Today session's next activity, or the summary once there is none left. */
  readonly advanceToday: () => Promise<void>;
  /** Abandons the Today session in progress (if any) and returns to Home, refreshing progress. */
  readonly leaveToday: () => void;
  /** The summary screen's closing action: clears the session and returns to Home. */
  readonly finishToday: () => void;

  /** Opens the Practice screen. */
  readonly goToPractice: () => void;
  /** Practice's "Daily warm-up" card: loads today's warm-up tasks and opens the task-run screen
   * (a no-op if nothing is due — the card is disabled by then, but this guards a stale click). */
  readonly startPracticeWarmUp: () => Promise<void>;
  /** Practice topic tap: loads that concept's review tasks and opens the task-run screen. */
  readonly startPracticeTopic: (conceptId: string) => Promise<void>;
  /** Leaves the Practice task run back to the topic list, refreshing progress. */
  readonly exitPracticeRun: () => void;
}

/** A created store instance, as returned by `createAppStore` (one per `App`, for test isolation). */
export type AppStore = ReturnType<typeof createAppStore>;

/** Builds a fresh Zustand store bound to `services`; call once per `App` instance. */
export function createAppStore(services: Services) {
  return create<AppState>((set, get) => {
    /** Enters `lessonId`, remembering `origin` for `exitLesson`. Shared by `startLesson`/`enterTodayActivity`. */
    async function enterLesson(lessonId: string, origin: LessonOrigin): Promise<void> {
      const { profile, journey } = get();
      if (!profile) return;
      const lesson: Lesson | undefined = services.deps.content.lesson(lessonId);
      if (!lesson) return;
      if (journey?.statuses.get(lessonId) === 'locked') return;
      const saved = await getLessonProgress(services.deps, profile.id, lessonId);
      const status = lessonStatus(lesson, saved);
      const startIndex = status === 'complete' || status === 'mastered' ? 0 : saved.resumeStep;
      set({ screen: 'lesson', lessonId, stepIndex: startIndex, lessonOrigin: origin });
    }

    /**
     * Opens a Today session's activity at `index` (`todayPlan.activities`), or the summary once
     * `index` runs past the end. Shared by `startToday`/`advanceToday`.
     */
    async function enterTodayActivity(index: number): Promise<void> {
      const plan = get().todayPlan;
      const activity = plan?.activities[index];
      if (!plan || !activity) {
        set({ screen: 'today-summary', todayActivityIndex: index });
        return;
      }
      set({ todayActivityIndex: index });
      if (activity.kind === 'warmup') {
        set({ screen: 'warmup' });
        return;
      }
      if (activity.kind === 'lesson') {
        await enterLesson(activity.lesson.id, 'today');
        return;
      }
      const miniGameId =
        activity.kind === 'world-boss' ? activity.world.boss : activity.miniGame.id;
      if (miniGameId === undefined) {
        // Defensive: `planTodaySession` only emits a `world-boss` activity once its boss mini-game
        // is set, so this never fires in practice.
        await enterTodayActivity(index + 1);
        return;
      }
      set({ screen: 'minigame', miniGameId, miniGameOrigin: 'today' });
    }

    return {
      services,
      screen: 'loading',
      profiles: [],
      profile: null,
      progress: [],
      miniGameProgress: [],
      conceptStats: [],
      journey: null,
      lessonId: null,
      stepIndex: 0,
      lessonOrigin: 'home',
      newPlayerReturnsToParent: false,
      miniGameId: null,
      miniGameOrigin: 'play',
      todayPlan: null,
      todayActivityIndex: 0,
      todaySessionStartTotalStars: 0,
      todaySessionStartFriends: [],
      todaySessionStartRankId: null,
      practiceConceptId: null,
      practiceTasks: [],

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
          const [progress, miniGameProgress, conceptStats, journey] = await Promise.all([
            loadProgress(services.deps, only.id),
            loadMiniGameProgress(services.deps, only.id),
            services.deps.progress.listConceptStats(only.id),
            loadJourney(services.deps, only.id),
          ]);
          set({
            profile: only,
            progress,
            miniGameProgress,
            conceptStats,
            journey,
            profiles,
            screen: 'home',
          });
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
        const [profiles, progress, miniGameProgress, conceptStats, journey] = await Promise.all([
          listProfiles(services.deps),
          loadProgress(services.deps, profile.id),
          loadMiniGameProgress(services.deps, profile.id),
          services.deps.progress.listConceptStats(profile.id),
          loadJourney(services.deps, profile.id),
        ]);
        set({
          profile,
          progress,
          miniGameProgress,
          conceptStats,
          journey,
          profiles,
          screen: 'home',
        });
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
        const [progress, miniGameProgress, conceptStats, journey] = await Promise.all([
          loadProgress(services.deps, profileId),
          loadMiniGameProgress(services.deps, profileId),
          services.deps.progress.listConceptStats(profileId),
          loadJourney(services.deps, profileId),
        ]);
        set({ profile, progress, miniGameProgress, conceptStats, journey, screen: 'home' });
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

      goToJourney() {
        set({ screen: 'journey' });
      },

      goToHome() {
        set({ screen: 'home' });
      },

      async startLesson(lessonId: string) {
        await enterLesson(lessonId, 'journey');
      },

      goToStep(index: number) {
        set({ stepIndex: index });
      },

      exitLesson() {
        const origin = get().lessonOrigin;
        set({ lessonId: null, stepIndex: 0 });
        if (origin === 'today') {
          get().leaveToday();
          return;
        }
        set({ screen: origin === 'journey' ? 'journey' : 'home' });
        void get().refreshProgress();
      },

      async completeLessonActivity() {
        const origin = get().lessonOrigin;
        set({ lessonId: null, stepIndex: 0 });
        if (origin === 'today') {
          await get().advanceToday();
          return;
        }
        set({ screen: origin === 'journey' ? 'journey' : 'home' });
        void get().refreshProgress();
      },

      async refreshProgress() {
        const { profile } = get();
        if (!profile) return;
        const [progress, miniGameProgress, conceptStats, journey] = await Promise.all([
          loadProgress(services.deps, profile.id),
          loadMiniGameProgress(services.deps, profile.id),
          services.deps.progress.listConceptStats(profile.id),
          loadJourney(services.deps, profile.id),
        ]);
        set({ progress, miniGameProgress, conceptStats, journey });
      },

      goToPlay() {
        set({ screen: 'play' });
      },

      goToDen() {
        set({ screen: 'den' });
      },

      startMiniGame(miniGameId: string, origin: MiniGameOrigin = 'play') {
        set({ screen: 'minigame', miniGameId, miniGameOrigin: origin });
      },

      exitMiniGame() {
        const origin = get().miniGameOrigin;
        set({ miniGameId: null });
        if (origin === 'today') {
          get().leaveToday();
          return;
        }
        set({ screen: origin === 'journey' ? 'journey' : origin === 'home' ? 'home' : 'play' });
        void get().refreshProgress();
      },

      async startToday() {
        const { profile, journey, progress } = get();
        if (!profile || !journey) return;
        const plan = await loadTodaySession(services.deps, profile.id);
        set({
          todayPlan: plan,
          todayActivityIndex: 0,
          todaySessionStartTotalStars: totalStars(progress),
          todaySessionStartFriends: animalFriends(journey.lessons, progress),
          todaySessionStartRankId: journey.rank?.id ?? null,
        });
        await enterTodayActivity(0);
      },

      async advanceToday() {
        const plan = get().todayPlan;
        if (!plan) {
          set({ screen: 'home' });
          return;
        }
        await get().refreshProgress();
        await enterTodayActivity(get().todayActivityIndex + 1);
      },

      leaveToday() {
        set({
          todayPlan: null,
          todayActivityIndex: 0,
          lessonId: null,
          miniGameId: null,
          screen: 'home',
        });
        void get().refreshProgress();
      },

      finishToday() {
        set({ todayPlan: null, todayActivityIndex: 0, screen: 'home' });
        void get().refreshProgress();
      },

      goToPractice() {
        set({ screen: 'practice' });
      },

      async startPracticeWarmUp() {
        const { profile } = get();
        if (!profile) return;
        const tasks = await loadWarmUp(services.deps, profile.id);
        if (tasks.length === 0) return;
        set({ practiceConceptId: null, practiceTasks: tasks, screen: 'practice-run' });
      },

      async startPracticeTopic(conceptId: string) {
        const { profile } = get();
        if (!profile) return;
        const tasks = await loadPracticeTasks(services.deps, profile.id, conceptId);
        set({ practiceConceptId: conceptId, practiceTasks: tasks, screen: 'practice-run' });
      },

      exitPracticeRun() {
        set({ screen: 'practice', practiceConceptId: null, practiceTasks: [] });
        void get().refreshProgress();
      },
    };
  });
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

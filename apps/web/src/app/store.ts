import { createContext, useContext } from 'react';
import { create } from 'zustand';
import type {
  AnimalFriend,
  ConceptStats,
  ConceptTask,
  EarnedBadge,
  GameRecord,
  Journey,
  Lesson,
  LessonProgress,
  MiniGameProgress,
  Profile,
  Streak,
  TodaySessionPlan,
} from '@chess-kids/core';
import {
  animalFriends,
  checkRewards,
  computerLevelStatus,
  createProfile,
  getLessonProgress,
  isFirstRun,
  lessonStatus,
  listProfiles,
  loadGameRecords,
  loadJourney,
  loadMiniGameProgress,
  loadPracticeTasks,
  loadProgress,
  loadTodaySession,
  loadWarmUp,
  markSeen,
  recordSessionMinutes,
  selectProfile,
  totalStars,
  updateSuggestedLevel,
} from '@chess-kids/core';
import type { Services } from './services.ts';

/** Rare celebrations (rewards.md §1): at most this many full-screen badge celebrations per app
 * sitting (reset when a profile is selected); every other newly earned badge still shows as a
 * "new" dot in My Den. */
const MAX_CELEBRATIONS_PER_SESSION = 2;

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
  | 'full-game'
  | 'friend-setup'
  | 'friend-game'
  | 'warmup'
  | 'practice'
  | 'practice-run'
  | 'today-summary';

/** vs Friend's second player (`docs/app-structure.md` §6): another profile, or a guest (no password, no record). */
export type FriendOpponentChoice =
  { readonly kind: 'profile'; readonly profileId: string } | { readonly kind: 'guest' };

/** Board mode for a vs Friend match (`docs/app-structure.md` §6). */
export type FriendBoardMode = 'pass-and-play' | 'face-to-face';

/** The vs Friend setup sheet's current choices, and what the friend game screen reads once "Start" is tapped. */
export interface FriendSetupState {
  readonly opponent: FriendOpponentChoice | null;
  /** `'full'` for the full game, else a `versus` mini-game's content id. */
  readonly gameId: string | null;
  readonly boardMode: FriendBoardMode;
  readonly legalMoveDots: boolean;
  /** Active profile plays White by default; true swaps starting colours. */
  readonly swapColours: boolean;
}

/** Tablet landscape and up (docs/app-structure.md §6): face-to-face's own default board mode. */
const FACE_TO_FACE_MIN_WIDTH = 768;

/** `window.innerWidth`-based default board mode; never throws (SSR/test environments without `window`). */
function defaultFriendBoardMode(): FriendBoardMode {
  try {
    return window.innerWidth >= FACE_TO_FACE_MIN_WIDTH ? 'face-to-face' : 'pass-and-play';
  } catch {
    return 'pass-and-play';
  }
}

const DEFAULT_FRIEND_SETUP: FriendSetupState = {
  opponent: null,
  gameId: null,
  boardMode: 'pass-and-play',
  legalMoveDots: true,
  swapColours: false,
};

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
  /** This profile's full-game / versus mini-game records (Play's vs Computer tally, My Den). */
  readonly gameRecords: readonly GameRecord[];
  /** This profile's concept mastery + review state (M3.4 Leitner scheduler): Home's "Start today"
   * button and the Practice screen's due count / weak tags both read this. */
  readonly conceptStats: readonly ConceptStats[];
  /** This profile's earned badges (M4.4, My Den's grid + celebrations' "new" dot). */
  readonly earnedBadges: readonly EarnedBadge[];
  /** This profile's daily-play streak (M4.4); `null` before it has any counted day yet. */
  readonly streak: Streak | null;
  /** The badge celebration currently showing full-screen (M4.4, rewards.md §1); `null` when none is. */
  readonly activeCelebration: EarnedBadge | null;
  /** Celebrations already shown this app sitting (reset on profile select); caps at {@link MAX_CELEBRATIONS_PER_SESSION}. */
  readonly celebrationsShownThisSession: number;
  /** `Date.now()` at `startToday()`, for the session's played-minutes tally on the summary. */
  readonly todaySessionStartedAt: number | null;
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
  /** The bot level (1 Mouse .. 5 Bear) of the full game open (screen `full-game`); Play's default selection otherwise. */
  readonly fullGameLevel: number;
  /** Owl's "Ready for the Fox?" line (`docs/computer-opponent.md` §5 "Automatic level"), set once
   * a just-finished full game moves the profile's suggested level up; `null` otherwise. Play reads
   * it once (`goToHome`/`startFullGame` clear it so it never lingers past the game it is about). */
  readonly levelUpSuggestion: { readonly level: number } | null;
  /** The vs Friend setup sheet's current choices (screen `friend-setup`), read by the friend game
   * screen (`friend-game`) once "Start" is tapped. */
  readonly friendSetup: FriendSetupState;

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
  /** Play's vs Computer "Full game" button: opens a full game vs `level` (1 Mouse .. 5 Bear). */
  readonly startFullGame: (level: number) => void;
  /** Leaves the full-game screen back to Play, refreshing progress (game records included). */
  readonly exitFullGame: () => void;
  /**
   * Recomputes and persists the "Automatic level" suggestion (`docs/computer-opponent.md` §5)
   * after one full game vs computer at `level` is recorded (finished or left — an abandoned game
   * never counts toward the last-5 tally itself, so this is a no-op either way for those). Sets
   * `levelUpSuggestion` when it moves the suggestion up a level. Called by `FullGameScreen` right
   * after its own `recordGame`.
   */
  readonly updateAutomaticLevel: (level: number) => Promise<void>;

  /** Play's "vs Friend" card: opens the setup sheet, resetting its choices (board mode defaults
   * to face-to-face on a tablet-width screen, pass-and-play otherwise). */
  readonly goToFriendSetup: () => void;
  /** Merges `patch` into the setup sheet's current choices. */
  readonly updateFriendSetup: (patch: Partial<FriendSetupState>) => void;
  /** The setup sheet's "Start" button: opens the friend game screen with the sheet's current
   * choices (a no-op without both a second player and a game picked — the button is disabled by
   * then, this guards a stale click). */
  readonly startFriendGame: () => void;
  /** Leaves the friend game screen back to Play, refreshing progress (game records included). */
  readonly exitFriendGame: () => void;

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

  /**
   * Re-reads this profile's earned badges/streak and, when nothing is already showing and this
   * session is still under {@link MAX_CELEBRATIONS_PER_SESSION}, queues the oldest unseen badge as
   * `activeCelebration` (rewards.md §1 "Rare celebrations"). Called after the exact 3 moments a
   * celebration may show (lesson complete, a full game's result, the Today session summary) — every
   * other newly earned badge stays unseen until My Den shows/clears its own "new" dot.
   */
  readonly checkForCelebrations: () => Promise<void>;
  /** Marks `activeCelebration` seen, counts it against this session's cap, and clears it — then
   * queues the next one, if any and still under cap. */
  readonly dismissCelebration: () => Promise<void>;
  /** My Den: marks one earned badge's "new" dot cleared (tapped/viewed), a no-op if already seen. */
  readonly markBadgeSeen: (earnedBadgeId: string) => Promise<void>;
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
        // rewards.md §4 "session ended" event: logs today's played minutes, folds the session into
        // the streak/badges one more time (picks up anything only true once the whole session is
        // done, e.g. Warm-up Champ), then the summary screen may show a celebration for it.
        const { profile, todaySessionStartedAt } = get();
        if (profile) {
          const minutes =
            todaySessionStartedAt === null
              ? 0
              : Math.round((Date.now() - todaySessionStartedAt) / 60_000);
          if (minutes > 0) {
            await recordSessionMinutes(services.deps, profile.id, minutes, new Date());
          }
          await checkRewards(services.deps, profile.id);
        }
        set({ screen: 'today-summary', todayActivityIndex: index });
        await get().checkForCelebrations();
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

    /** This profile's earned badges + streak (M4.4), `[]`/`undefined` when `rewards` is not wired. */
    async function loadRewards(
      profileId: string,
    ): Promise<{ readonly earnedBadges: EarnedBadge[]; readonly streak: Streak | undefined }> {
      const [earnedBadges, streak] = await Promise.all([
        services.deps.rewards?.listEarnedBadges(profileId) ?? Promise.resolve([]),
        services.deps.rewards?.getStreak(profileId) ?? Promise.resolve(undefined),
      ]);
      return { earnedBadges, streak };
    }

    /**
     * Queues the oldest unseen earned badge as `activeCelebration` (rewards.md §1), when nothing is
     * already showing and this app sitting is still under {@link MAX_CELEBRATIONS_PER_SESSION}.
     * Assumes `earnedBadges`/`activeCelebration`/`celebrationsShownThisSession` are already current.
     */
    function queueNextCelebration(): void {
      const { activeCelebration, celebrationsShownThisSession, earnedBadges } = get();
      if (activeCelebration || celebrationsShownThisSession >= MAX_CELEBRATIONS_PER_SESSION) return;
      const next = earnedBadges.find((badge) => !badge.seen);
      if (next) set({ activeCelebration: next });
    }

    return {
      services,
      screen: 'loading',
      profiles: [],
      profile: null,
      progress: [],
      miniGameProgress: [],
      gameRecords: [],
      conceptStats: [],
      earnedBadges: [],
      streak: null,
      activeCelebration: null,
      celebrationsShownThisSession: 0,
      todaySessionStartedAt: null,
      journey: null,
      lessonId: null,
      stepIndex: 0,
      lessonOrigin: 'home',
      newPlayerReturnsToParent: false,
      miniGameId: null,
      miniGameOrigin: 'play',
      fullGameLevel: 1,
      levelUpSuggestion: null,
      friendSetup: DEFAULT_FRIEND_SETUP,
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
          const [progress, miniGameProgress, gameRecords, conceptStats, journey, rewards] =
            await Promise.all([
              loadProgress(services.deps, only.id),
              loadMiniGameProgress(services.deps, only.id),
              loadGameRecords(services.deps, only.id),
              services.deps.progress.listConceptStats(only.id),
              loadJourney(services.deps, only.id),
              loadRewards(only.id),
            ]);
          set({
            profile: only,
            progress,
            miniGameProgress,
            gameRecords,
            conceptStats,
            journey,
            profiles,
            earnedBadges: rewards.earnedBadges,
            streak: rewards.streak ?? null,
            activeCelebration: null,
            celebrationsShownThisSession: 0,
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
        const [profiles, progress, miniGameProgress, gameRecords, conceptStats, journey, rewards] =
          await Promise.all([
            listProfiles(services.deps),
            loadProgress(services.deps, profile.id),
            loadMiniGameProgress(services.deps, profile.id),
            loadGameRecords(services.deps, profile.id),
            services.deps.progress.listConceptStats(profile.id),
            loadJourney(services.deps, profile.id),
            loadRewards(profile.id),
          ]);
        set({
          profile,
          progress,
          miniGameProgress,
          gameRecords,
          conceptStats,
          journey,
          profiles,
          earnedBadges: rewards.earnedBadges,
          streak: rewards.streak ?? null,
          activeCelebration: null,
          celebrationsShownThisSession: 0,
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
        const [progress, miniGameProgress, gameRecords, conceptStats, journey, rewards] =
          await Promise.all([
            loadProgress(services.deps, profileId),
            loadMiniGameProgress(services.deps, profileId),
            loadGameRecords(services.deps, profileId),
            services.deps.progress.listConceptStats(profileId),
            loadJourney(services.deps, profileId),
            loadRewards(profileId),
          ]);
        set({
          profile,
          progress,
          miniGameProgress,
          gameRecords,
          conceptStats,
          journey,
          earnedBadges: rewards.earnedBadges,
          streak: rewards.streak ?? null,
          activeCelebration: null,
          celebrationsShownThisSession: 0,
          screen: 'home',
        });
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
        set({ screen: 'home', levelUpSuggestion: null });
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
        const [progress, miniGameProgress, gameRecords, conceptStats, journey, rewards] =
          await Promise.all([
            loadProgress(services.deps, profile.id),
            loadMiniGameProgress(services.deps, profile.id),
            loadGameRecords(services.deps, profile.id),
            services.deps.progress.listConceptStats(profile.id),
            loadJourney(services.deps, profile.id),
            loadRewards(profile.id),
          ]);
        set({
          progress,
          miniGameProgress,
          gameRecords,
          conceptStats,
          journey,
          earnedBadges: rewards.earnedBadges,
          streak: rewards.streak ?? null,
        });
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

      startFullGame(level: number) {
        set({ screen: 'full-game', fullGameLevel: level, levelUpSuggestion: null });
      },

      exitFullGame() {
        set({ screen: 'play' });
        void get().refreshProgress();
      },

      async updateAutomaticLevel(level: number) {
        const { profile, journey } = get();
        if (!profile || !journey) return;
        const records = await loadGameRecords(services.deps, profile.id);
        const statuses = computerLevelStatus(records, journey);
        const update = await updateSuggestedLevel(
          services.deps,
          profile.id,
          level as 1 | 2 | 3 | 4 | 5,
          records,
          statuses,
        );
        if (update?.leveledUp) {
          set({ levelUpSuggestion: { level: update.level } });
        }
      },

      goToFriendSetup() {
        set({
          screen: 'friend-setup',
          friendSetup: { ...DEFAULT_FRIEND_SETUP, boardMode: defaultFriendBoardMode() },
        });
      },

      updateFriendSetup(patch: Partial<FriendSetupState>) {
        set((state) => ({ friendSetup: { ...state.friendSetup, ...patch } }));
      },

      startFriendGame() {
        const { friendSetup } = get();
        if (!friendSetup.opponent || !friendSetup.gameId) return;
        set({ screen: 'friend-game' });
      },

      exitFriendGame() {
        set({ screen: 'play' });
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
          todaySessionStartedAt: Date.now(),
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
          todaySessionStartedAt: null,
          lessonId: null,
          miniGameId: null,
          screen: 'home',
        });
        void get().refreshProgress();
      },

      finishToday() {
        set({
          todayPlan: null,
          todayActivityIndex: 0,
          todaySessionStartedAt: null,
          screen: 'home',
        });
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

      async checkForCelebrations() {
        const { profile } = get();
        if (!profile) return;
        const rewards = await loadRewards(profile.id);
        set({ earnedBadges: rewards.earnedBadges, streak: rewards.streak ?? null });
        queueNextCelebration();
      },

      async dismissCelebration() {
        const { profile, activeCelebration, celebrationsShownThisSession, earnedBadges } = get();
        if (!profile || !activeCelebration) return;
        const seen = markSeen(activeCelebration, services.deps.clock.now());
        await services.deps.rewards?.saveEarnedBadge(seen);
        set({
          activeCelebration: null,
          celebrationsShownThisSession: celebrationsShownThisSession + 1,
          earnedBadges: earnedBadges.map((badge) => (badge.id === seen.id ? seen : badge)),
        });
        queueNextCelebration();
      },

      async markBadgeSeen(earnedBadgeId: string) {
        const { profile, earnedBadges } = get();
        const badge = earnedBadges.find((entry) => entry.id === earnedBadgeId);
        if (!profile || !badge || badge.seen) return;
        const seen = markSeen(badge, services.deps.clock.now());
        await services.deps.rewards?.saveEarnedBadge(seen);
        set({ earnedBadges: earnedBadges.map((entry) => (entry.id === seen.id ? seen : entry)) });
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

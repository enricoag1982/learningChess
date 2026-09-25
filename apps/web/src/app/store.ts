import { createContext, useContext } from 'react';
import { create } from 'zustand';
import type {
  AnimalFriend,
  AssessmentScope,
  AssessmentScore,
  ConceptStats,
  ConceptTask,
  ContentSource,
  EarnedBadge,
  GameRecord,
  Journey,
  Lesson,
  LessonProgress,
  MiniGameProgress,
  ParentUnlockTarget,
  PlacementWorldPlan,
  Profile,
  ProfileSettings,
  Streak,
  TimeLimitStatus,
  TodaySessionPlan,
} from '@chess-kids/core';
import {
  animalFriends,
  checkActivityGate,
  checkRewards,
  combinedSessionLog,
  computerLevelStatus,
  createProfile,
  DEFAULT_PROFILE_SETTINGS,
  getLessonProgress,
  getProfileSettings,
  grantExtraTime,
  grantHoursOverride,
  isFirstRun,
  lessonStatus,
  lessonSteps,
  listProfiles,
  loadGameRecords,
  loadJourney,
  loadMiniGameProgress,
  loadPracticeTasks,
  loadProgress,
  loadTodaySession,
  loadWarmUp,
  markSeen,
  markTimeWarning,
  minutesUntilEnd,
  parentUnlock,
  planPlacement,
  planTestOutLesson,
  planTestOutWorld,
  scorePlacementWorld,
  scoreTestOut,
  selectProfile,
  shouldWarn,
  submitAssessment,
  totalStars,
  updateSuggestedLevel,
} from '@chess-kids/core';
import { requestPersistentStorageIfNeeded } from '../adapters/persistent-storage.ts';
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
  | 'today-summary'
  | 'placement-offer'
  | 'placement'
  | 'assessment'
  | 'time-limit';

/** Screens the 5-minute warning (M7.1, app-structure.md §13 "5-min warning") may show on: every
 * screen listed here, plus the lesson screen but only on its own lesson-complete step (checked
 * separately below) — never mid-exercise/game/boss/assessment. */
const CALM_SCREENS: ReadonlySet<Screen> = new Set([
  'home',
  'journey',
  'play',
  'practice',
  'den',
  'today-summary',
]);

/** `true` while `screen` is one the 5-minute warning may show on right now (M7.1) — see
 * {@link CALM_SCREENS}; for `screen: 'lesson'`, only once `lessonId`/`stepIndex` land on that
 * lesson's own `'complete'` step (`lessonSteps`, same step `LessonScreen` renders as `CompleteStep`). */
function isCalmScreen(
  screen: Screen,
  lessonId: string | null,
  stepIndex: number,
  content: ContentSource,
): boolean {
  if (CALM_SCREENS.has(screen)) return true;
  if (screen !== 'lesson' || lessonId === null) return false;
  const lesson = content.lesson(lessonId);
  if (!lesson) return false;
  return lessonSteps(lesson, content.minigames())[stepIndex]?.kind === 'complete';
}

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
  /** `profile`'s own parent-set settings (M5.1, app-structure.md §11), loaded alongside it —
   * `ExerciseStep`'s Hint button and `PlayScreen`'s computer-level default both read this;
   * `DEFAULT_PROFILE_SETTINGS` outside a selected profile. Voice is applied as a side effect at
   * load time (`services.setVoiceEnabled`), not read from here (`gated-narrator.ts` owns it). */
  readonly activeProfileSettings: ProfileSettings;
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

  /** The test-out run in progress (screen `assessment`, M4.5: domain-model.md §3.2); `null` outside
   * one. Its own runner records each task locally and scores the whole run once done — see
   * `submitAssessmentRun`. */
  readonly assessmentRun: {
    readonly scope: AssessmentScope;
    readonly tasks: readonly ConceptTask[];
  } | null;
  /** The placement test's full plan (one run per Basics world, in order), loaded once by
   * `acceptPlacement`; `[]` outside a placement run (screen `placement`). */
  readonly placementPlan: readonly PlacementWorldPlan[];
  /** Index into `placementPlan` of the world currently running. */
  readonly placementIndex: number;

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

  /** The activity gate's last read (M5.2, domain-model.md §3.3), shown on the "See you tomorrow"
   * screen (screen `time-limit`); `null` outside one. */
  readonly timeLimitStatus: TimeLimitStatus | null;
  /** What the gate was about to do when it found the profile over its limit — replayed as-is
   * (no re-check) once the parent grants more time (`grantMoreTimeAndResume`). `null` outside a
   * `time-limit` screen. */
  readonly pendingActivity: (() => void | Promise<void>) | null;
  /** Which flow the password screen is for: the ordinary parent-area gate, or the "See you
   * tomorrow" screen's "Parent: more time" (M5.2) — decides what a correct password does next. */
  readonly passwordPurpose: 'parent-area' | 'more-time';

  /** The 5-minute warning banner (M7.1, `ui/AppNotice.tsx`): visible only on a calm screen, at
   * most once per child per day (`SessionLog.warnedAt`). */
  readonly timeNoticeVisible: boolean;
  /**
   * Re-evaluates the 5-minute warning (M7.1, app-structure.md §13 "5-min warning"):
   * `trigger: 'screen'` (every screen change, incl. the lesson-complete step) first hides it —
   * "gone on the next screen change" — then, same as `trigger: 'tick'` (`TimeTracker`'s own
   * minute tick), shows it when the current screen is calm and {@link shouldWarn} says so,
   * persisting `SessionLog.warnedAt` so it never shows twice the same day. A no-op without an
   * active profile.
   */
  readonly checkTimeNotice: (trigger: 'screen' | 'tick') => Promise<void>;

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
  /** Picker's "Grown-ups" button, and the "See you tomorrow" screen's "Parent: more time" button
   * (`purpose: 'more-time'`, M5.2) — decides what a correct password does next. Defaults to the
   * ordinary parent-area gate. */
  readonly goToPasswordScreen: (purpose?: 'parent-area' | 'more-time') => void;
  /** Password screen, once the password is verified (`passwordPurpose === 'parent-area'`). */
  readonly goToParentArea: () => Promise<void>;
  /** Password screen, once the password is verified with `passwordPurpose === 'more-time'`
   * (M5.2): grants more time for today, then replays `pendingActivity` (or Home, without one). */
  readonly grantMoreTimeAndResume: () => Promise<void>;
  /** "See you tomorrow" screen's "Switch player": abandons whatever was gated and opens the
   * picker (M5.2). */
  readonly switchPlayerFromTimeLimit: () => Promise<void>;
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
   * Journey locked-tap sheet "Yes, test me!" for a locked lesson (domain-model.md §3.2): plans a
   * lesson test-out run (`planTestOutLesson`) and opens the runner (screen `assessment`).
   */
  readonly startTestOutLesson: (lessonId: string, worldId: string) => void;
  /** Same, for a locked world (`planTestOutWorld`): all its lessons at once. */
  readonly startTestOutWorld: (worldId: string) => void;
  /**
   * The assessment runner's `onDone`: scores the run (`scoreTestOut`) and applies a pass
   * (`submitAssessment`) — masters every lesson in scope, unlocks it. Does not change screen; the
   * runner shows the pass/fail result itself, then calls `exitAssessment`.
   */
  readonly submitAssessmentRun: (results: readonly boolean[]) => Promise<AssessmentScore>;
  /** Leaves the assessment screen (Close, or the result screen's Continue) back to the Journey. */
  readonly exitAssessment: () => void;

  /** Placement offer screen "No, start at World 1": straight to Home, nothing tested. */
  readonly declinePlacement: () => void;
  /** Placement offer screen "Yes": plans the whole placement test (`planPlacement`) and opens the
   * first Basics world's run (screen `placement`); straight to Home if there is nothing to test. */
  readonly acceptPlacement: () => void;
  /**
   * One placement world's `onDone`: scores it (`scorePlacementWorld`) and applies a pass
   * (`submitAssessment`) — same effect as a world test-out, `masteredVia: 'placement'`. Does not
   * advance `placementIndex` itself; the screen reads the outcome and calls `advancePlacementWorld`
   * (pass, more worlds left) or `finishPlacement` (fail, or nothing left to test).
   */
  readonly submitPlacementWorldRun: (
    worldId: string,
    results: readonly boolean[],
  ) => Promise<AssessmentScore>;
  /** Moves the placement run to its next Basics world. */
  readonly advancePlacementWorld: () => void;
  /** Ends the placement run (all worlds done, a world failed, or the kid closed it early — "can be
   * skipped any time, keeps what passed") and returns Home, refreshing progress. */
  readonly finishPlacement: () => void;

  /** Parent area "Unlock" list: unlocks one lesson or world directly for `profileId`
   * (domain-model.md §3.2 "Parent unlock", `masteredVia: 'parent'`). */
  readonly parentUnlockTarget: (profileId: string, target: ParentUnlockTarget) => Promise<void>;

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
    /**
     * Time-limit gate (M5.2, domain-model.md §3.3 "checked between activities only"): runs
     * `enterActivity` (a plain `set(...)` closure, its whole point of entering the activity) if the
     * active profile is under its daily limit; otherwise shows "See you tomorrow" instead and
     * remembers `enterActivity` as `pendingActivity`, so granting more time
     * (`grantMoreTimeAndResume`) can resume exactly where the kid was headed, unchecked. A no-op
     * gate (straight to `enterActivity`) without an active profile — never blocks
     * first-run/picker/parent-area navigation, only kid-mode activities and Home.
     */
    async function gated(enterActivity: () => void | Promise<void>): Promise<void> {
      const { profile } = get();
      if (!profile) {
        await enterActivity();
        return;
      }
      const status = await checkActivityGate(services.deps, profile.id);
      if (status.overLimit) {
        set({ screen: 'time-limit', timeLimitStatus: status, pendingActivity: enterActivity });
        return;
      }
      await enterActivity();
    }

    /** `gated`, specialised to "returning to Home" (the gate's other checkpoint alongside entering
     * an activity — domain-model.md §3.3). */
    async function goHomeGated(): Promise<void> {
      await gated(() => {
        set({ screen: 'home' });
      });
    }

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
      await gated(() => {
        set({ screen: 'lesson', lessonId, stepIndex: startIndex, lessonOrigin: origin });
      });
    }

    /**
     * Opens a Today session's activity at `index` (`todayPlan.activities`), or the summary once
     * `index` runs past the end. Shared by `startToday`/`advanceToday`. Each activity is its own
     * gate checkpoint (`gated`) — the session pauses at "See you tomorrow" instead of continuing
     * once the limit is reached between two of its activities.
     */
    async function enterTodayActivity(index: number): Promise<void> {
      const plan = get().todayPlan;
      const activity = plan?.activities[index];
      if (!plan || !activity) {
        // rewards.md §4 "session ended" event: folds the session into the streak/badges one more
        // time (picks up anything only true once the whole session is done, e.g. Warm-up Champ) —
        // played minutes are already logged continuously by `TimeTracker`, not tallied here.
        const { profile } = get();
        if (profile) {
          await checkRewards(services.deps, profile.id);
        }
        set({ screen: 'today-summary', todayActivityIndex: index });
        await get().checkForCelebrations();
        return;
      }
      set({ todayActivityIndex: index });
      if (activity.kind === 'warmup') {
        await gated(() => {
          set({ screen: 'warmup' });
        });
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
      await gated(() => {
        set({ screen: 'minigame', miniGameId, miniGameOrigin: 'today' });
      });
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
      activeProfileSettings: DEFAULT_PROFILE_SETTINGS,
      progress: [],
      miniGameProgress: [],
      gameRecords: [],
      conceptStats: [],
      earnedBadges: [],
      streak: null,
      activeCelebration: null,
      celebrationsShownThisSession: 0,
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
      assessmentRun: null,
      placementPlan: [],
      placementIndex: 0,
      todayPlan: null,
      todayActivityIndex: 0,
      todaySessionStartTotalStars: 0,
      todaySessionStartFriends: [],
      todaySessionStartRankId: null,
      practiceConceptId: null,
      practiceTasks: [],
      timeLimitStatus: null,
      pendingActivity: null,
      passwordPurpose: 'parent-area',
      timeNoticeVisible: false,

      async checkTimeNotice(trigger) {
        if (trigger === 'screen') set({ timeNoticeVisible: false });
        const { profile, screen, lessonId, stepIndex } = get();
        if (!profile) return;
        if (!isCalmScreen(screen, lessonId, stepIndex, services.deps.content)) return;
        const now = services.deps.clock.now();
        const settings = await getProfileSettings(services.deps, profile.id);
        const log = await combinedSessionLog(services.deps, profile.id, now);
        const remaining = minutesUntilEnd(settings, log, now);
        if (shouldWarn(remaining, log, now)) {
          await markTimeWarning(services.deps, profile.id);
          set({ timeNoticeVisible: true });
        }
      },

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
          const [
            progress,
            miniGameProgress,
            gameRecords,
            conceptStats,
            journey,
            rewards,
            settings,
          ] = await Promise.all([
            loadProgress(services.deps, only.id),
            loadMiniGameProgress(services.deps, only.id),
            loadGameRecords(services.deps, only.id),
            services.deps.progress.listConceptStats(only.id),
            loadJourney(services.deps, only.id),
            loadRewards(only.id),
            getProfileSettings(services.deps, only.id),
          ]);
          services.setVoiceEnabled(settings.voice);
          services.setNickname(only.nickname);
          set({
            profile: only,
            activeProfileSettings: settings,
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
        // Storage eviction (non-functional.md §1, M5.4 decision table): asks once, on whichever
        // profile creation happens first on this device — a no-op every time after (see
        // `requestPersistentStorageIfNeeded`'s own doc comment).
        await requestPersistentStorageIfNeeded(services.deps);
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
        // A brand-new profile has no stored settings yet: DEFAULT_PROFILE_SETTINGS applies as-is
        // (voice on), no need to round-trip `getProfileSettings` for a row that cannot exist yet.
        services.setVoiceEnabled(DEFAULT_PROFILE_SETTINGS.voice);
        services.setNickname(profile.nickname);
        set({
          profile,
          activeProfileSettings: DEFAULT_PROFILE_SETTINGS,
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
          // app-structure.md §3 / domain-model.md §3.2: offered once, right after creating a new
          // player (not when a parent added a child from the parent area — that path stays on
          // `finishNewPlayer`'s own early return above, straight back to 'parent').
          screen: 'placement-offer',
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
        const [progress, miniGameProgress, gameRecords, conceptStats, journey, rewards, settings] =
          await Promise.all([
            loadProgress(services.deps, profileId),
            loadMiniGameProgress(services.deps, profileId),
            loadGameRecords(services.deps, profileId),
            services.deps.progress.listConceptStats(profileId),
            loadJourney(services.deps, profileId),
            loadRewards(profileId),
            getProfileSettings(services.deps, profileId),
          ]);
        // Settings effect now (app-structure.md §11): voice/hints/computer level take effect the
        // next time this profile is selected — voice is applied here as a side effect (gates the
        // shared narrator), the rest is read straight off `activeProfileSettings` by the screens
        // that need it (`ExerciseStep`'s Hint button, `PlayScreen`'s computer-level default).
        services.setVoiceEnabled(settings.voice);
        services.setNickname(profile.nickname);
        set({
          profile,
          activeProfileSettings: settings,
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

      goToPasswordScreen(purpose = 'parent-area') {
        set({ screen: 'password', passwordPurpose: purpose });
      },

      async goToParentArea() {
        const profiles = await listProfiles(services.deps);
        set({ profiles, screen: 'parent' });
      },

      async grantMoreTimeAndResume() {
        const { profile, pendingActivity, timeLimitStatus } = get();
        if (!profile) return;
        // M7.1: a late/early gate grants a 15-minute hours override instead of extending the
        // daily limit — `checkActivityGate` never over-reports "limit" once hours are also
        // blocking (`app/time-limit.ts`'s own priority), so `reason` alone decides which to grant.
        if (timeLimitStatus?.reason === 'late' || timeLimitStatus?.reason === 'early') {
          await grantHoursOverride(services.deps, profile.id);
        } else {
          await grantExtraTime(services.deps, profile.id);
        }
        set({ timeLimitStatus: null, pendingActivity: null });
        if (pendingActivity) {
          await pendingActivity();
        } else {
          set({ screen: 'home' });
        }
      },

      async switchPlayerFromTimeLimit() {
        set({
          timeLimitStatus: null,
          pendingActivity: null,
          todayPlan: null,
          todayActivityIndex: 0,
          lessonId: null,
          miniGameId: null,
        });
        await get().goToPicker();
      },

      async refreshProfiles() {
        const profiles = await listProfiles(services.deps);
        set({ profiles });
      },

      goToJourney() {
        set({ screen: 'journey' });
      },

      goToHome() {
        set({ levelUpSuggestion: null });
        void goHomeGated();
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
        if (origin === 'journey') {
          set({ screen: 'journey' });
        } else {
          void goHomeGated();
        }
        void get().refreshProgress();
      },

      async completeLessonActivity() {
        const origin = get().lessonOrigin;
        set({ lessonId: null, stepIndex: 0 });
        if (origin === 'today') {
          await get().advanceToday();
          return;
        }
        if (origin === 'journey') {
          set({ screen: 'journey' });
        } else {
          await goHomeGated();
        }
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
        void gated(() => {
          set({ screen: 'minigame', miniGameId, miniGameOrigin: origin });
        });
      },

      exitMiniGame() {
        const origin = get().miniGameOrigin;
        set({ miniGameId: null });
        if (origin === 'today') {
          get().leaveToday();
          return;
        }
        if (origin === 'home') {
          void goHomeGated();
        } else {
          set({ screen: origin === 'journey' ? 'journey' : 'play' });
        }
        void get().refreshProgress();
      },

      startFullGame(level: number) {
        void gated(() => {
          set({ screen: 'full-game', fullGameLevel: level, levelUpSuggestion: null });
        });
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
        void gated(() => {
          set({ screen: 'friend-game' });
        });
      },

      exitFriendGame() {
        set({ screen: 'play' });
        void get().refreshProgress();
      },

      startTestOutLesson(lessonId: string, worldId: string) {
        const { journey } = get();
        const lesson = journey?.lessons.find((entry) => entry.id === lessonId);
        if (!lesson) return;
        const tasks = planTestOutLesson(lesson, services.deps.random);
        if (tasks.length === 0) return;
        set({
          assessmentRun: { scope: { type: 'lesson', lessonId, worldId }, tasks },
          screen: 'assessment',
        });
      },

      startTestOutWorld(worldId: string) {
        const { journey } = get();
        if (!journey) return;
        const world = journey.worlds.find((entry) => entry.world.id === worldId)?.world;
        if (!world) return;
        const tasks = planTestOutWorld(world, journey.lessons, services.deps.random);
        if (tasks.length === 0) return;
        set({ assessmentRun: { scope: { type: 'world', worldId }, tasks }, screen: 'assessment' });
      },

      async submitAssessmentRun(results: readonly boolean[]) {
        const { profile, assessmentRun } = get();
        const score = scoreTestOut(results);
        if (!profile || !assessmentRun) return score;
        await submitAssessment(services.deps, {
          profileId: profile.id,
          kind: 'test-out',
          scope: assessmentRun.scope,
          results,
          score,
        });
        return score;
      },

      exitAssessment() {
        set({ assessmentRun: null, screen: 'journey' });
        void get().refreshProgress();
      },

      declinePlacement() {
        void goHomeGated();
      },

      acceptPlacement() {
        const { journey } = get();
        if (!journey) {
          set({ screen: 'home' });
          return;
        }
        const plan = planPlacement(journey.catalog, journey.lessons, services.deps.random);
        if (plan.length === 0) {
          set({ screen: 'home' });
          return;
        }
        set({ placementPlan: plan, placementIndex: 0, screen: 'placement' });
      },

      async submitPlacementWorldRun(worldId: string, results: readonly boolean[]) {
        const { profile } = get();
        const score = scorePlacementWorld(results);
        if (!profile) return score;
        await submitAssessment(services.deps, {
          profileId: profile.id,
          kind: 'placement',
          scope: { type: 'world', worldId },
          results,
          score,
        });
        return score;
      },

      advancePlacementWorld() {
        set((state) => ({ placementIndex: state.placementIndex + 1 }));
      },

      finishPlacement() {
        set({ placementPlan: [], placementIndex: 0 });
        void goHomeGated();
        void get().refreshProgress();
      },

      async parentUnlockTarget(profileId: string, target) {
        await parentUnlock(services.deps, profileId, target);
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
        });
        void goHomeGated();
        void get().refreshProgress();
      },

      finishToday() {
        set({
          todayPlan: null,
          todayActivityIndex: 0,
        });
        void goHomeGated();
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
        await gated(() => {
          set({ practiceConceptId: null, practiceTasks: tasks, screen: 'practice-run' });
        });
      },

      async startPracticeTopic(conceptId: string) {
        const { profile } = get();
        if (!profile) return;
        const tasks = await loadPracticeTasks(services.deps, profile.id, conceptId);
        await gated(() => {
          set({ practiceConceptId: conceptId, practiceTasks: tasks, screen: 'practice-run' });
        });
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

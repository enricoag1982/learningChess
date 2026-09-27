import type { ContentSource, TimeLimitStatus } from '@chess-kids/core';
import {
  checkActivityGate,
  combinedSessionLog,
  getProfileSettings,
  grantExtraTime,
  grantHoursOverride,
  lessonSteps,
  listProfiles,
  markTimeWarning,
  minutesUntilEnd,
  shouldWarn,
} from '@chess-kids/core';
import { ROUTE_META } from '../routes.ts';
import type { AppGet, AppSet, Screen } from '../store.ts';

export interface TimeSlice {
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
}

/** `true` while `screen` is one the 5-minute warning (M7.1) may show on right now — see
 * `ROUTE_META`'s `calm` flag; for `screen: 'lesson'`, only once `lessonId`/`stepIndex` land on that
 * lesson's own `'complete'` step (`lessonSteps`, same step `LessonScreen` renders as `CompleteStep`). */
function isCalmScreen(
  screen: Screen,
  lessonId: string | null,
  stepIndex: number,
  content: ContentSource,
): boolean {
  if (ROUTE_META[screen].calm) return true;
  if (screen !== 'lesson' || lessonId === null) return false;
  const lesson = content.lesson(lessonId);
  if (!lesson) return false;
  return lessonSteps(lesson, content.minigames())[stepIndex]?.kind === 'complete';
}

/**
 * Time-limit gate (M5.2, domain-model.md §3.3 "checked between activities only"): runs
 * `enterActivity` (a plain `set(...)` closure, its whole point of entering the activity) if the
 * active profile is under its daily limit; otherwise shows "See you tomorrow" instead and
 * remembers `enterActivity` as `pendingActivity`, so granting more time
 * (`grantMoreTimeAndResume`) can resume exactly where the kid was headed, unchecked. A no-op
 * gate (straight to `enterActivity`) without an active profile — never blocks
 * first-run/picker/parent-area navigation, only kid-mode activities and Home.
 */
export async function gated(
  set: AppSet,
  get: AppGet,
  enterActivity: () => void | Promise<void>,
): Promise<void> {
  const { profile, services } = get();
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

export function createTimeSlice(set: AppSet, get: AppGet): TimeSlice {
  return {
    timeLimitStatus: null,
    pendingActivity: null,
    passwordPurpose: 'parent-area',
    timeNoticeVisible: false,

    async checkTimeNotice(trigger) {
      const { services } = get();
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

    goToPasswordScreen(purpose = 'parent-area') {
      set({ screen: 'password', passwordPurpose: purpose });
    },

    async goToParentArea() {
      const { services } = get();
      const profiles = await listProfiles(services.deps);
      set({ profiles, screen: 'parent' });
    },

    async grantMoreTimeAndResume() {
      const { profile, pendingActivity, timeLimitStatus, services } = get();
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
  };
}

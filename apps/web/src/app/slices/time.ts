import type { ContentSource } from '@chess-kids/core';
import {
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
  /** The 5-minute warning banner (`ui/AppNotice.tsx`): visible only on a calm screen, at
   * most once per child per day (`SessionLog.warnedAt`). */
  readonly timeNoticeVisible: boolean;
  /**
   * Re-evaluates the 5-minute warning (app-structure.md §13 "5-min warning"):
   * `trigger: 'screen'` (every screen change, incl. the lesson-complete step) first hides it —
   * "gone on the next screen change" — then, same as `trigger: 'tick'` (`TimeTracker`'s own
   * minute tick), shows it when the current screen is calm and {@link shouldWarn} says so,
   * persisting `SessionLog.warnedAt` so it never shows twice the same day. A no-op without an
   * active profile.
   */
  readonly checkTimeNotice: (trigger: 'screen' | 'tick') => Promise<void>;
  /** Picker's "Grown-ups" button, and the "See you tomorrow" screen's "Parent: more time" button
   * (`purpose: 'more-time'`) — decides what a correct password does next. Defaults to the
   * ordinary parent-area gate. */
  readonly goToPasswordScreen: (purpose?: 'parent-area' | 'more-time') => void;
  /** Password screen, once the password is verified (`purpose === 'parent-area'`). */
  readonly goToParentArea: () => Promise<void>;
  /** Password screen, once the password is verified with `purpose === 'more-time'`: grants
   * more time for today, then replays the `time-limit` route's `resume` (or lands on Home, if for
   * some reason there is none) — unchecked, no re-gating. */
  readonly grantMoreTimeAndResume: () => Promise<void>;
  /** "See you tomorrow" screen's "Switch player": abandons whatever was gated and opens the
   * picker. */
  readonly switchPlayerFromTimeLimit: () => Promise<void>;
}

/** `true` while `screen` is one the 5-minute warning may show on right now — see
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

export function createTimeSlice(set: AppSet, get: AppGet): TimeSlice {
  return {
    timeNoticeVisible: false,

    async checkTimeNotice(trigger) {
      const { services } = get();
      if (trigger === 'screen') set({ timeNoticeVisible: false });
      const { profile, screen, stack, stepIndex } = get();
      if (!profile) return;
      const top = stack[stack.length - 1];
      const lessonId = top?.name === 'lesson' ? top.lessonId : null;
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
      void get().navigate({ name: 'password', purpose });
    },

    async goToParentArea() {
      const { services } = get();
      const profiles = await listProfiles(services.deps);
      set({ profiles });
      await get().replace({ name: 'parent' });
    },

    async grantMoreTimeAndResume() {
      const { profile, stack, services } = get();
      if (!profile) return;
      const timeLimitRoute = stack[stack.length - 2];
      if (!timeLimitRoute || timeLimitRoute.name !== 'time-limit') return;
      // A late/early gate grants a 15-minute hours override instead of extending the
      // daily limit — `checkActivityGate` never over-reports "limit" once hours are also
      // blocking (`app/time-limit.ts`'s own priority), so `reason` alone decides which to grant.
      if (timeLimitRoute.status?.reason === 'late' || timeLimitRoute.status?.reason === 'early') {
        await grantHoursOverride(services.deps, profile.id);
      } else {
        await grantExtraTime(services.deps, profile.id);
      }
      const { resume } = timeLimitRoute;
      await get().back(); // pop password
      await get().back(); // pop time-limit
      if (resume) {
        await get().applyResume(resume);
      }
    },

    async switchPlayerFromTimeLimit() {
      set({ todayPlan: null, todayActivityIndex: 0 });
      await get().goToPicker();
    },
  };
}

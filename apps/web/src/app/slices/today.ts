import type { AnimalFriend, TodaySessionPlan } from '@chess-kids/core';
import { animalFriends, checkRewards, loadTodaySession, totalStars } from '@chess-kids/core';
import type { AppGet, AppSet } from '../store.ts';
import { gated } from './time.ts';
import { goHomeGated } from './nav.ts';
import { enterLesson } from './learn.ts';

export interface TodaySlice {
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
}

export function createTodaySlice(set: AppSet, get: AppGet): TodaySlice {
  /**
   * Opens a Today session's activity at `index` (`todayPlan.activities`), or the summary once
   * `index` runs past the end. Shared by `startToday`/`advanceToday`. Each activity is its own
   * gate checkpoint (`gated`) — the session pauses at "See you tomorrow" instead of continuing
   * once the limit is reached between two of its activities.
   */
  async function enterTodayActivity(index: number): Promise<void> {
    const { services } = get();
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
      await gated(set, get, () => {
        set({ screen: 'warmup' });
      });
      return;
    }
    if (activity.kind === 'lesson') {
      await enterLesson(set, get, activity.lesson.id, 'today');
      return;
    }
    const miniGameId = activity.kind === 'world-boss' ? activity.world.boss : activity.miniGame.id;
    if (miniGameId === undefined) {
      // Defensive: `planTodaySession` only emits a `world-boss` activity once its boss mini-game
      // is set, so this never fires in practice.
      await enterTodayActivity(index + 1);
      return;
    }
    await gated(set, get, () => {
      set({ screen: 'minigame', miniGameId, miniGameOrigin: 'today' });
    });
  }

  return {
    todayPlan: null,
    todayActivityIndex: 0,
    todaySessionStartTotalStars: 0,
    todaySessionStartFriends: [],
    todaySessionStartRankId: null,

    async startToday() {
      const { profile, journey, progress } = get();
      if (!profile || !journey) return;
      const { services } = get();
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
      void goHomeGated(set, get);
      void get().refreshProgress();
    },

    finishToday() {
      set({
        todayPlan: null,
        todayActivityIndex: 0,
      });
      void goHomeGated(set, get);
      void get().refreshProgress();
    },
  };
}

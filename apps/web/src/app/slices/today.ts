import type { AnimalFriend, TodaySessionPlan } from '@chess-kids/core';
import { animalFriends, checkRewards, loadTodaySession, totalStars } from '@chess-kids/core';
import type { AppGet, AppSet } from '../store.ts';
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
   * `index` runs past the end. Shared by `startToday`/`advanceToday`. `index === 0` pushes (the
   * session's first activity, on top of Home); every later activity replaces the current one in
   * place, so "back" never unwinds through the whole session. Each activity is its own gate
   * checkpoint (`navigate`/`replace` both check `ROUTE_META`'s gated routes) — the session pauses
   * at "See you tomorrow" instead of continuing once the limit is reached between two activities.
   */
  async function enterTodayActivity(index: number): Promise<void> {
    const { services } = get();
    const plan = get().todayPlan;
    const activity = plan?.activities[index];
    const enter = index === 0 ? get().navigate : get().replace;
    if (!plan || !activity) {
      // rewards.md §4 "session ended" event: folds the session into the streak/badges one more
      // time (picks up anything only true once the whole session is done, e.g. Warm-up Champ) —
      // played minutes are already logged continuously by `TimeTracker`, not tallied here.
      const { profile } = get();
      if (profile) {
        await checkRewards(services.deps, profile.id);
      }
      set({ todayActivityIndex: index });
      await enter({ name: 'today-summary' });
      await get().checkForCelebrations();
      return;
    }
    set({ todayActivityIndex: index });
    if (activity.kind === 'warmup') {
      await enter({ name: 'warmup' });
      return;
    }
    if (activity.kind === 'lesson') {
      await enterLesson(get, activity.lesson.id, { today: true, enter });
      return;
    }
    const miniGameId = activity.kind === 'world-boss' ? activity.world.boss : activity.miniGame.id;
    if (miniGameId === undefined) {
      // Defensive: `planTodaySession` only emits a `world-boss` activity once its boss mini-game
      // is set, so this never fires in practice.
      await enterTodayActivity(index + 1);
      return;
    }
    await enter({ name: 'minigame', miniGameId, today: true });
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
        // Defensive: `advanceToday` is only ever called while a session is open. Straight to
        // Home, ungated, same as the "no plan" guard everywhere else in this slice.
        get().reset({ name: 'home' });
        return;
      }
      await get().refreshProgress();
      await enterTodayActivity(get().todayActivityIndex + 1);
    },

    leaveToday() {
      set({ todayPlan: null, todayActivityIndex: 0 });
      void get().back('home', { gate: true });
      void get().refreshProgress();
    },

    finishToday() {
      set({ todayPlan: null, todayActivityIndex: 0 });
      void get().back('home', { gate: true });
      void get().refreshProgress();
    },
  };
}

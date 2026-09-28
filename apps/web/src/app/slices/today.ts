import type { AnimalFriend } from '@chess-kids/core';
import { animalFriends, checkRewards, loadTodaySession, totalStars } from '@chess-kids/core';
import { CHESS_CHARACTERS, type TodaySessionPlan } from '@chess-kids/core/chess';
import { backAndRefresh, type SliceCreator } from '../store.ts';
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

  /** Home's "Start today" (domain-model.md §3.3): plans the session (`loadTodaySession`), snapshots
   * stars/friends/rank for the summary, and opens its first activity. No-op without a profile. */
  readonly startToday: () => Promise<void>;
  /** Moves to the Today session's next activity, or the summary once there is none left. */
  readonly advanceToday: () => Promise<void>;
  /** Abandons the Today session in progress (if any) and returns to Home, refreshing progress. */
  readonly leaveToday: () => void;
  /** The summary screen's closing action: clears the session and returns to Home. */
  readonly finishToday: () => void;
}

export const createTodaySlice: SliceCreator<TodaySlice> = (set, get) => {
  /** Opens the Today activity at `index`, or the summary past the end. `index === 0` pushes; every
   * later activity replaces, so "back" never unwinds the whole session. */
  async function enterTodayActivity(index: number): Promise<void> {
    const { services } = get();
    const plan = get().todayPlan;
    const activity = plan?.activities[index];
    const enter = index === 0 ? get().navigate : get().replace;
    if (!plan || !activity) {
      // rewards.md §4 "session ended": folds the session into streak/badges one more time; played
      // minutes are already logged continuously by `TimeTracker`, not tallied here.
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

  function exitToday(): void {
    set({ todayPlan: null, todayActivityIndex: 0 });
    backAndRefresh(get, 'home', { gate: true })();
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
        todaySessionStartFriends: animalFriends(journey.lessons, progress, CHESS_CHARACTERS),
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

    leaveToday: exitToday,
    finishToday: exitToday,
  };
};

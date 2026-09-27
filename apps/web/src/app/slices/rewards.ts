import type { EarnedBadge, Streak } from '@chess-kids/core';
import { markSeen } from '@chess-kids/core';
import type { AppGet, AppSet } from '../store.ts';

/** Rare celebrations (rewards.md §1): at most this many full-screen badge celebrations per app
 * sitting (reset when a profile is selected); every other newly earned badge still shows as a
 * "new" dot in My Den. */
const MAX_CELEBRATIONS_PER_SESSION = 2;

export interface RewardsSlice {
  /** This profile's earned badges (M4.4, My Den's grid + celebrations' "new" dot). */
  readonly earnedBadges: readonly EarnedBadge[];
  /** This profile's daily-play streak (M4.4); `null` before it has any counted day yet. */
  readonly streak: Streak | null;
  /** The badge celebration currently showing full-screen (M4.4, rewards.md §1); `null` when none is. */
  readonly activeCelebration: EarnedBadge | null;
  /** Celebrations already shown this app sitting (reset on profile select); caps at {@link MAX_CELEBRATIONS_PER_SESSION}. */
  readonly celebrationsShownThisSession: number;

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

/** This profile's earned badges + streak (M4.4), `[]`/`undefined` when `rewards` is not wired. */
export async function loadRewards(
  get: AppGet,
  profileId: string,
): Promise<{ readonly earnedBadges: EarnedBadge[]; readonly streak: Streak | undefined }> {
  const { services } = get();
  const [earnedBadges, streak] = await Promise.all([
    services.deps.rewards?.listEarnedBadges(profileId) ?? Promise.resolve([]),
    services.deps.rewards?.getStreak(profileId) ?? Promise.resolve(undefined),
  ]);
  return { earnedBadges, streak };
}

export function createRewardsSlice(set: AppSet, get: AppGet): RewardsSlice {
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
    earnedBadges: [],
    streak: null,
    activeCelebration: null,
    celebrationsShownThisSession: 0,

    async checkForCelebrations() {
      const { profile } = get();
      if (!profile) return;
      const rewards = await loadRewards(get, profile.id);
      set({ earnedBadges: rewards.earnedBadges, streak: rewards.streak ?? null });
      queueNextCelebration();
    },

    async dismissCelebration() {
      const { profile, activeCelebration, celebrationsShownThisSession, earnedBadges, services } =
        get();
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
      const { profile, earnedBadges, services } = get();
      const badge = earnedBadges.find((entry) => entry.id === earnedBadgeId);
      if (!profile || !badge || badge.seen) return;
      const seen = markSeen(badge, services.deps.clock.now());
      await services.deps.rewards?.saveEarnedBadge(seen);
      set({ earnedBadges: earnedBadges.map((entry) => (entry.id === seen.id ? seen : entry)) });
    },
  };
}

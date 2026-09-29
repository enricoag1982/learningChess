import { markSeen, type EarnedBadge, type Streak } from '@learn/platform-core';
import type { AppGet, SliceCreator } from '../store.ts';

/** Rare celebrations (rewards.md §1): at most this many full-screen ones per app sitting; every
 * other badge still shows as a "new" dot in My Den. */
const MAX_CELEBRATIONS_PER_SESSION = 2;

export interface RewardsSlice {
  readonly earnedBadges: readonly EarnedBadge[];
  readonly streak: Streak | null;
  readonly activeCelebration: EarnedBadge | null;
  /** Celebrations already shown this app sitting (reset on profile select); caps at {@link MAX_CELEBRATIONS_PER_SESSION}. */
  readonly celebrationsShownThisSession: number;

  /** Re-reads badges/streak and, under the session cap with nothing already showing, queues the
   * oldest unseen badge as `activeCelebration` (rewards.md §1). */
  readonly checkForCelebrations: () => Promise<void>;
  /** Marks `activeCelebration` seen, counts it against this session's cap, and clears it — then
   * queues the next one, if any and still under cap. */
  readonly dismissCelebration: () => Promise<void>;
  readonly markBadgeSeen: (earnedBadgeId: string) => Promise<void>;
}

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

export const createRewardsSlice: SliceCreator<RewardsSlice> = (set, get) => {
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
};

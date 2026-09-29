import type { EarnedBadge, RewardsRepository, SessionLog, Streak } from '@learn/platform-core';
import type { CappedList, KeyedCollection } from './collections.ts';
import { cappedList, keyedCollection, shapeGuard } from './collections.ts';
import type { LocalStore } from './local-store.ts';
import { STORAGE_KEYS } from './storage-keys.ts';

function sessionLogKey(profileId: string, date: string): string {
  return `${profileId}:${date}`;
}

const isEarnedBadgeShape = shapeGuard<EarnedBadge>({
  string: ['id', 'profileId', 'badgeId', 'at'],
  boolean: ['seen'],
});

const isStreakShape = shapeGuard<Streak>({
  string: ['id', 'profileId'],
  number: ['current', 'best', 'skipsUsedThisWeek'],
});

const isSessionLogShape = shapeGuard<SessionLog>({
  string: ['id', 'profileId', 'date'],
  number: ['minutes'],
});

/** `RewardsRepository` over one `LocalStore`: earned badges as an uncapped append-only list; one
 * streak per profile; one session log row per `"<profileId>:<date>"`. */
export class LocalStorageRewardsRepository implements RewardsRepository {
  private readonly store: LocalStore;
  private readonly earnedBadges: CappedList<EarnedBadge>;
  private readonly streaks: KeyedCollection<Streak>;
  private readonly sessionLogs: KeyedCollection<SessionLog>;

  constructor(store: LocalStore) {
    this.store = store;
    this.earnedBadges = cappedList(store, STORAGE_KEYS.earnedBadges, undefined, isEarnedBadgeShape);
    this.streaks = keyedCollection(
      store,
      STORAGE_KEYS.streaks,
      (streak) => streak.profileId,
      isStreakShape,
    );
    this.sessionLogs = keyedCollection(
      store,
      STORAGE_KEYS.sessionLogs,
      (log) => sessionLogKey(log.profileId, log.date),
      isSessionLogShape,
    );
  }

  addEarnedBadge(badge: EarnedBadge): Promise<void> {
    return this.earnedBadges.add(badge);
  }

  listEarnedBadges(profileId: string): Promise<EarnedBadge[]> {
    return this.earnedBadges.list((badge) => badge.profileId === profileId);
  }

  /** Updates a row in place (e.g. marking a badge seen) instead of appending a duplicate. */
  saveEarnedBadge(badge: EarnedBadge): Promise<void> {
    return this.earnedBadges.list().then((all) => {
      const index = all.findIndex((entry) => entry.id === badge.id);
      const next =
        index >= 0 ? all.map((entry, i) => (i === index ? badge : entry)) : [...all, badge];
      this.store.write(STORAGE_KEYS.earnedBadges, next);
    });
  }

  getStreak(profileId: string): Promise<Streak | undefined> {
    return this.streaks.get(profileId);
  }

  saveStreak(streak: Streak): Promise<void> {
    return this.streaks.put(streak);
  }

  getSessionLog(profileId: string, date: string): Promise<SessionLog | undefined> {
    return this.sessionLogs.get(sessionLogKey(profileId, date));
  }

  saveSessionLog(log: SessionLog): Promise<void> {
    return this.sessionLogs.put(log);
  }

  listSessionLogs(profileId: string): Promise<SessionLog[]> {
    return this.sessionLogs.list((log) => log.profileId === profileId);
  }

  deleteProfileData(profileId: string): Promise<void> {
    return Promise.all([
      this.earnedBadges.removeWhere((badge) => badge.profileId === profileId),
      this.streaks.remove(profileId),
      this.sessionLogs.removeWhere((log) => log.profileId === profileId),
    ]).then(() => undefined);
  }
}

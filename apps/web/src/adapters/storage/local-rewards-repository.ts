import type { EarnedBadge, RewardsRepository, SessionLog, Streak } from '@chess-kids/core';
import type { LocalStore } from './local-store.ts';
import { StorageError } from './local-store.ts';

const EARNED_BADGES_RECORD = 'earned-badges';
const STREAKS_RECORD = 'streaks';
const SESSION_LOGS_RECORD = 'session-logs';

function streakKey(profileId: string): string {
  return profileId;
}

function sessionLogKey(profileId: string, date: string): string {
  return `${profileId}:${date}`;
}

function isEarnedBadgeShape(value: unknown): value is EarnedBadge {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.profileId === 'string' &&
    typeof record.badgeId === 'string' &&
    typeof record.at === 'string' &&
    typeof record.seen === 'boolean'
  );
}

function isEarnedBadgeArray(value: unknown): value is EarnedBadge[] {
  return Array.isArray(value) && value.every(isEarnedBadgeShape);
}

function isStreakShape(value: unknown): value is Streak {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.profileId === 'string' &&
    typeof record.current === 'number' &&
    typeof record.best === 'number' &&
    typeof record.skipsUsedThisWeek === 'number'
  );
}

function isStreakRecord(value: unknown): value is Record<string, Streak> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every(isStreakShape);
}

function isSessionLogShape(value: unknown): value is SessionLog {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.profileId === 'string' &&
    typeof record.date === 'string' &&
    typeof record.minutes === 'number'
  );
}

function isSessionLogRecord(value: unknown): value is Record<string, SessionLog> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every(isSessionLogShape);
}

/**
 * Runs a synchronous computation and reports it as a settled promise, so a thrown `StorageError`
 * surfaces as a rejection instead of a synchronous throw (methods here have no `await` of their
 * own, so they are not declared `async`: `@typescript-eslint/require-await` would flag that).
 */
function toPromise<T>(compute: () => T): Promise<T> {
  try {
    return Promise.resolve(compute());
  } catch (error: unknown) {
    return Promise.reject<T>(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * `RewardsRepository` over one `LocalStore` (M4.4): earned badges as a single capped, append-only
 * list (newest last, same shape `Attempt`/`GameRecord` use); one streak per profile; one session
 * log row per `"<profileId>:<date>"`, same keying pattern `LocalStorageProgressRepository` uses.
 */
export class LocalStorageRewardsRepository implements RewardsRepository {
  private readonly store: LocalStore;

  constructor(store: LocalStore) {
    this.store = store;
  }

  private readEarnedBadges(): EarnedBadge[] {
    const raw = this.store.read(EARNED_BADGES_RECORD);
    if (raw === undefined) return [];
    if (!isEarnedBadgeArray(raw)) {
      throw new StorageError(`Corrupt earned badge data stored at "${EARNED_BADGES_RECORD}"`);
    }
    return raw;
  }

  private readStreaks(): Map<string, Streak> {
    const raw = this.store.read(STREAKS_RECORD);
    if (raw === undefined) return new Map();
    if (!isStreakRecord(raw)) {
      throw new StorageError(`Corrupt streak data stored at "${STREAKS_RECORD}"`);
    }
    return new Map(Object.entries(raw));
  }

  private readSessionLogs(): Map<string, SessionLog> {
    const raw = this.store.read(SESSION_LOGS_RECORD);
    if (raw === undefined) return new Map();
    if (!isSessionLogRecord(raw)) {
      throw new StorageError(`Corrupt session log data stored at "${SESSION_LOGS_RECORD}"`);
    }
    return new Map(Object.entries(raw));
  }

  addEarnedBadge(badge: EarnedBadge): Promise<void> {
    return toPromise(() => {
      const all = this.readEarnedBadges();
      all.push(badge);
      this.store.write(EARNED_BADGES_RECORD, all);
    });
  }

  listEarnedBadges(profileId: string): Promise<EarnedBadge[]> {
    return toPromise(() =>
      this.readEarnedBadges().filter((badge) => badge.profileId === profileId),
    );
  }

  saveEarnedBadge(badge: EarnedBadge): Promise<void> {
    return toPromise(() => {
      const all = this.readEarnedBadges();
      const index = all.findIndex((entry) => entry.id === badge.id);
      if (index >= 0) {
        all[index] = badge;
      } else {
        all.push(badge);
      }
      this.store.write(EARNED_BADGES_RECORD, all);
    });
  }

  getStreak(profileId: string): Promise<Streak | undefined> {
    return toPromise(() => this.readStreaks().get(streakKey(profileId)));
  }

  saveStreak(streak: Streak): Promise<void> {
    return toPromise(() => {
      const all = this.readStreaks();
      all.set(streakKey(streak.profileId), streak);
      this.store.write(STREAKS_RECORD, Object.fromEntries(all));
    });
  }

  getSessionLog(profileId: string, date: string): Promise<SessionLog | undefined> {
    return toPromise(() => this.readSessionLogs().get(sessionLogKey(profileId, date)));
  }

  saveSessionLog(log: SessionLog): Promise<void> {
    return toPromise(() => {
      const all = this.readSessionLogs();
      all.set(sessionLogKey(log.profileId, log.date), log);
      this.store.write(SESSION_LOGS_RECORD, Object.fromEntries(all));
    });
  }

  deleteProfileData(profileId: string): Promise<void> {
    return toPromise(() => {
      const badges = this.readEarnedBadges().filter((badge) => badge.profileId !== profileId);
      this.store.write(EARNED_BADGES_RECORD, badges);

      const streaks = this.readStreaks();
      streaks.delete(streakKey(profileId));
      this.store.write(STREAKS_RECORD, Object.fromEntries(streaks));

      const logs = this.readSessionLogs();
      for (const [key, log] of logs) {
        if (log.profileId === profileId) logs.delete(key);
      }
      this.store.write(SESSION_LOGS_RECORD, Object.fromEntries(logs));
    });
  }
}

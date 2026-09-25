import type {
  AppSettings,
  AssessmentResult,
  Attempt,
  BackupFile,
  BackupImporter,
  ConceptStats,
  EarnedBadge,
  GameRecord,
  LessonProgress,
  MiniGameProgress,
  Profile,
  ProfileSettings,
  SessionLog,
  Streak,
  Unlock,
} from '@chess-kids/core';
import type { LocalStore } from './local-store.ts';
import { SCHEMA_VERSION } from './local-store.ts';
import { StorageError } from './local-store.ts';

/** Every record name a backup import replaces — every one of these repositories' own `RECORD_NAME`
 * constants, deliberately never `parent-lock` (see `BackupImporter`'s own doc: a restored backup
 * never touches the parent password). */
const RECORD_NAMES = [
  'profiles',
  'settings',
  'lesson-progress',
  'attempts',
  'minigame-progress',
  'concept-stats',
  'game-records',
  'earned-badges',
  'streaks',
  'session-logs',
  'assessment-results',
  'unlocks',
] as const;

/** Mirrors each repository's own cap (`local-progress-repository.ts`/`local-game-record-repository.ts`/
 * `local-assessment-repository.ts`) — newest kept, oldest dropped, same "keep it from growing
 * forever" reasoning, so an import lands in exactly the state ordinary play would have produced. */
const MAX_ATTEMPTS = 2000;
const MAX_GAME_RECORDS = 500;
const MAX_ASSESSMENT_RESULTS = 500;

function byCreatedAtAsc(
  a: { readonly createdAt: string },
  b: { readonly createdAt: string },
): number {
  return a.createdAt.localeCompare(b.createdAt);
}

function capped<T extends { readonly createdAt: string }>(items: readonly T[], max: number): T[] {
  const sorted = [...items].sort(byCreatedAtAsc);
  return sorted.length > max ? sorted.slice(sorted.length - max) : sorted;
}

/** This device's own current `AppSettings` fields a merge import must carry through unchanged
 * (M7.2 device sharing) instead of the blank slate a plain "replace" writes — see `writeMerged`'s
 * own doc on `BackupImporter` (`app/ports.ts`). */
type DeviceOnlySettings = Pick<
  AppSettings,
  'lastProfileId' | 'suggestedLevels' | 'storagePersisted' | 'deviceId'
>;

/** Options only `writeMerged` passes (`toRawRecords`' plain `replaceAll` call omits both, matching
 * its pre-M7.2 behaviour exactly: every session-log row keyed bare, `AppSettings` blanked). */
interface MergeWriteOptions {
  readonly localDeviceId?: string;
  readonly deviceSettings?: DeviceOnlySettings;
}

/** `${profileId}:${date}` for this device's own row (`log.deviceId` absent, or equal to
 * `localDeviceId`) — the exact key `LocalStorageRewardsRepository`'s `getSessionLog`/
 * `saveSessionLog` already read/write, so this device's live minute-by-minute tracking keeps
 * finding the same row after a merge import. Any other `deviceId` is a foreign device's own row
 * (M7.2 device sharing): suffixed so it is stored *alongside* this device's row for the same date,
 * never overwriting it — `RewardsRepository.listSessionLogs`/`totalMinutesForDate` then sum both. */
function sessionLogStorageKey(log: SessionLog, localDeviceId: string | undefined): string {
  const isLocal = log.deviceId === undefined || log.deviceId === localDeviceId;
  return isLocal ? `${log.profileId}:${log.date}` : `${log.profileId}:${log.date}:${log.deviceId}`;
}

/** `file`'s data, reshaped into the exact raw value each `RECORD_NAMES` entry is stored as — same
 * shapes `LocalStorageXRepository`'s own private `readAll`/`writeAll` build and read. */
function toRawRecords(
  file: BackupFile,
  options: MergeWriteOptions = {},
): Readonly<Record<(typeof RECORD_NAMES)[number], unknown>> {
  const profiles: Record<string, Profile> = {};
  const lessonProgress: Record<string, LessonProgress> = {};
  const miniGameProgress: Record<string, MiniGameProgress> = {};
  const conceptStats: Record<string, ConceptStats> = {};
  const streaks: Record<string, Streak> = {};
  const sessionLogs: Record<string, SessionLog> = {};
  const profileSettings: Record<string, ProfileSettings> = {};
  let attempts: Attempt[] = [];
  let gameRecords: GameRecord[] = [];
  let earnedBadges: EarnedBadge[] = [];
  let assessmentResults: AssessmentResult[] = [];
  let unlocks: Unlock[] = [];

  for (const profile of file.profiles) {
    profiles[profile.id] = profile;
    const data = file.data[profile.id];
    if (data === undefined) continue;

    profileSettings[profile.id] = data.settings;
    for (const progress of data.lessonProgress) {
      lessonProgress[`${progress.profileId}:${progress.lessonId}`] = progress;
    }
    for (const progress of data.miniGameProgress) {
      miniGameProgress[`${progress.profileId}:${progress.miniGameId}`] = progress;
    }
    for (const stats of data.conceptStats) {
      conceptStats[`${stats.profileId}:${stats.conceptId}`] = stats;
    }
    for (const log of data.sessionLogs) {
      sessionLogs[sessionLogStorageKey(log, options.localDeviceId)] = log;
    }
    if (data.streak !== undefined) {
      streaks[profile.id] = data.streak;
    }
    attempts = attempts.concat(data.attempts);
    gameRecords = gameRecords.concat(data.gameRecords);
    earnedBadges = earnedBadges.concat(data.earnedBadges);
    assessmentResults = assessmentResults.concat(data.assessmentResults);
    unlocks = unlocks.concat(data.unlocks);
  }

  const settings: AppSettings = {
    lastProfileId: options.deviceSettings?.lastProfileId ?? null,
    suggestedLevels: options.deviceSettings?.suggestedLevels ?? {},
    profileSettings,
    ...(options.deviceSettings?.storagePersisted === undefined
      ? {}
      : { storagePersisted: options.deviceSettings.storagePersisted }),
    ...(options.deviceSettings?.deviceId === undefined
      ? {}
      : { deviceId: options.deviceSettings.deviceId }),
  };

  return {
    profiles,
    settings,
    'lesson-progress': lessonProgress,
    attempts: capped(attempts, MAX_ATTEMPTS),
    'minigame-progress': miniGameProgress,
    'concept-stats': conceptStats,
    'game-records': capped(gameRecords, MAX_GAME_RECORDS),
    'earned-badges': earnedBadges,
    streaks,
    'session-logs': sessionLogs,
    'assessment-results': capped(assessmentResults, MAX_ASSESSMENT_RESULTS),
    unlocks,
  };
}

const STAGING_PREFIX = 'backup-staging:';

/**
 * Runs a synchronous computation and reports it as a settled promise, so a thrown `StorageError`
 * surfaces as a rejection instead of a synchronous throw (this class's own method has no `await`
 * of its own, so it is not declared `async`: `@typescript-eslint/require-await` would flag that —
 * same reasoning every `LocalStorageXRepository` already documents for its own methods).
 */
function toPromise<T>(compute: () => T): Promise<T> {
  try {
    return Promise.resolve(compute());
  } catch (error: unknown) {
    return Promise.reject<T>(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * `BackupImporter` for the web (M5.1, `docs/architecture.md` §11): writes every replaced record to
 * a staging key set first (`backup-staging:<name>`), and only once every one of them has written
 * successfully copies them over the real keys and clears the staging ones — so a failure partway
 * (e.g. a quota error) leaves every real key untouched instead of a mix of old and new data.
 * `localStorage` has no real transactions, so this is a best-effort, not a database-grade guarantee
 * — but the window where a real key could be left half-written shrinks to the final copy loop,
 * after every byte of the new data is already known to fit and parse.
 */
export class LocalStorageBackupImporter implements BackupImporter {
  private readonly store: LocalStore;

  constructor(store: LocalStore) {
    this.store = store;
  }

  replaceAll(file: BackupFile): Promise<void> {
    return toPromise(() => {
      this.checkSchemaVersion(file);
      this.stageThenSwap(toRawRecords(file));
    });
  }

  writeMerged(
    file: BackupFile,
    options: {
      readonly localDeviceId?: string;
      readonly deviceSettings: DeviceOnlySettings;
    },
  ): Promise<void> {
    return toPromise(() => {
      this.checkSchemaVersion(file);
      this.stageThenSwap(
        toRawRecords(file, {
          localDeviceId: options.localDeviceId,
          deviceSettings: options.deviceSettings,
        }),
      );
    });
  }

  private checkSchemaVersion(file: BackupFile): void {
    if (file.schemaVersion > SCHEMA_VERSION) {
      throw new StorageError(
        `Backup schema version ${String(file.schemaVersion)} is newer than supported version ${String(SCHEMA_VERSION)}`,
      );
    }
  }

  /** Writes every `raw` record to its staging key first, and only once every one of them has
   * written successfully copies them over the real keys and clears the staging ones — shared by
   * `replaceAll` and `writeMerged` (this class's own module doc). */
  private stageThenSwap(raw: Readonly<Record<(typeof RECORD_NAMES)[number], unknown>>): void {
    const staged: (typeof RECORD_NAMES)[number][] = [];
    try {
      for (const name of RECORD_NAMES) {
        this.store.write(`${STAGING_PREFIX}${name}`, raw[name]);
        staged.push(name);
      }
    } catch (error: unknown) {
      for (const name of staged) {
        this.store.remove(`${STAGING_PREFIX}${name}`);
      }
      throw error instanceof Error ? error : new Error(String(error));
    }

    for (const name of RECORD_NAMES) {
      this.store.write(name, this.store.read(`${STAGING_PREFIX}${name}`));
      this.store.remove(`${STAGING_PREFIX}${name}`);
    }
  }
}

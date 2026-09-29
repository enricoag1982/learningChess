import type { AssessmentResult, Unlock } from '../domain/assessment.ts';
import type { BadgeDef, EarnedBadge } from '../domain/badges.ts';
import type { TracksCatalog } from '../domain/journey.ts';
import type { Lesson } from '../domain/lesson.ts';
import type { MiniGameBase } from '../domain/subject.ts';
import type { ParentLock } from '../domain/parent-lock.ts';
import type { Profile } from '../domain/profile.ts';
import type { ProfileSettings } from '../domain/profile-settings.ts';
import type { Attempt, GameRecord, LessonProgress, MiniGameProgress } from '../domain/progress.ts';
import type { ConceptStats } from '../domain/review.ts';
import type { SessionLog } from '../domain/session-log.ts';
import type { Streak } from '../domain/streak.ts';
import type { BackupFile } from './backup.ts';

/** Persistence of child profiles. Async so cloud adapters can replace local ones. */
export interface ProfileRepository {
  list(): Promise<Profile[]>;
  get(id: string): Promise<Profile | undefined>;
  save(profile: Profile): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface ProgressRepository {
  listLessons(profileId: string): Promise<LessonProgress[]>;
  getLesson(profileId: string, lessonId: string): Promise<LessonProgress | undefined>;
  saveLesson(progress: LessonProgress): Promise<void>;
  addAttempt(attempt: Attempt): Promise<void>;
  listAttempts(profileId: string): Promise<Attempt[]>;
  getMiniGame(profileId: string, miniGameId: string): Promise<MiniGameProgress | undefined>;
  listMiniGames(profileId: string): Promise<MiniGameProgress[]>;
  saveMiniGame(progress: MiniGameProgress): Promise<void>;
  getConceptStats(profileId: string, conceptId: string): Promise<ConceptStats | undefined>;
  listConceptStats(profileId: string): Promise<ConceptStats[]>;
  saveConceptStats(stats: ConceptStats): Promise<void>;
  deleteProfileData(profileId: string): Promise<void>;
}

/** Full games and versus mini-games vs the computer or a friend; an append-only log, separate from mastery state. */
export interface GameRecordRepository {
  add(record: GameRecord): Promise<void>;
  listByProfile(profileId: string): Promise<GameRecord[]>;
  deleteProfileData(profileId: string): Promise<void>;
}

export interface RewardsRepository {
  addEarnedBadge(badge: EarnedBadge): Promise<void>;
  listEarnedBadges(profileId: string): Promise<EarnedBadge[]>;
  saveEarnedBadge(badge: EarnedBadge): Promise<void>;
  getStreak(profileId: string): Promise<Streak | undefined>;
  saveStreak(streak: Streak): Promise<void>;
  getSessionLog(profileId: string, date: string): Promise<SessionLog | undefined>;
  saveSessionLog(log: SessionLog): Promise<void>;
  listSessionLogs(profileId: string): Promise<SessionLog[]>;
  deleteProfileData(profileId: string): Promise<void>;
}

/** Optional on `AppDeps`: `app/assessment.ts` throws a clear error without it. */
export interface AssessmentRepository {
  addAssessmentResult(result: AssessmentResult): Promise<void>;
  listAssessmentResults(profileId: string): Promise<AssessmentResult[]>;
  addUnlock(unlock: Unlock): Promise<void>;
  listUnlocks(profileId: string): Promise<Unlock[]>;
  deleteProfileData(profileId: string): Promise<void>;
}

export interface ParentLockRepository {
  get(): Promise<ParentLock | undefined>;
  save(lock: ParentLock): Promise<void>;
}

export interface PasswordFileWriter {
  write(password: string): Promise<{ location: string }>;
}

/** Device-wide; `suggestedLevels` / `profileSettings` are keyed per profile within the one record. */
export interface AppSettings {
  readonly lastProfileId: string | null;
  /** Automatic-level suggestion (`BotLevel.level`) per profile id; absent until one exists (`games.ts`'s `suggestedLevel`). */
  readonly suggestedLevels: Readonly<Record<string, number>>;
  /** Parent "Settings per child", by profile id; absent reads back as `DEFAULT_PROFILE_SETTINGS`. */
  readonly profileSettings: Readonly<Record<string, ProfileSettings>>;
  /** Result of the one `navigator.storage.persist()` request; `undefined` until it settles or when unavailable. */
  readonly storagePersisted?: boolean;
  /** This device's random id (`getOrCreateDeviceId`), created lazily, never regenerated; stamps its `SessionLog` rows so a
   * merge import can tell them from a foreign device's. */
  readonly deviceId?: string;
}

export interface SettingsRepository {
  get(): Promise<AppSettings>;
  save(settings: AppSettings): Promise<void>;
}

export interface IdGenerator {
  next(): string;
}

/** Speaks text aloud; a no-op adapter when speech is unavailable. */
export interface Narrator {
  readonly available: boolean;
  speak(text: string): Promise<void>;
  cancel(): void;
}

/** Compiled lesson content at the platform's base shapes; a subject's concrete adapter (chess: `ChessContentSource`)
 * widens here with no cast, chess UI reads it via `services.subject.content`. */
export interface ContentSource {
  lessons(): readonly Lesson[];
  lesson(id: string): Lesson | undefined;
  minigames(): readonly MiniGameBase[];
  minigame(id: string): MiniGameBase | undefined;
  /** Tracks/worlds/ranks for `loadJourney`; optional so existing `ContentSource` fixtures keep typechecking. */
  catalog?(): TracksCatalog;
  badges?(): readonly BadgeDef[];
}

export interface Clock {
  now(): Date;
}

/** Writes a backup file where the parent can find it (web: download; Capacitor: Documents). */
export interface BackupFileWriter {
  write(filename: string, contents: string): Promise<void>;
}

export type DeviceOnlySettings = Pick<
  AppSettings,
  'lastProfileId' | 'suggestedLevels' | 'storagePersisted' | 'deviceId'
>;

export interface MergeWriteOptions {
  readonly localDeviceId?: string;
  readonly deviceSettings: DeviceOnlySettings;
}

/** Atomically writes `file` as the device's entire new dataset (staged, then swapped; never touches the parent password).
 * `options.localDeviceId` marks this device's session-log rows so a foreign row for the same day is kept beside it. */
export interface BackupImporter {
  writeMerged(file: BackupFile, options: MergeWriteOptions): Promise<void>;
}

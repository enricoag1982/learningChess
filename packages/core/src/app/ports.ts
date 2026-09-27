import type { AssessmentResult, Unlock } from '../domain/assessment.ts';
import type { BadgeDef, EarnedBadge } from '../domain/badges.ts';
import type { Move } from '../domain/chess/rules.ts';
import type { GameState } from '../domain/game/types.ts';
import type { TracksCatalog } from '../domain/journey.ts';
import type { Lesson, MiniGame } from '../domain/lesson.ts';
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

/** Persistence of lesson progress, attempts, and standalone mini-game progress (Play screen). */
export interface ProgressRepository {
  listLessons(profileId: string): Promise<LessonProgress[]>;
  getLesson(profileId: string, lessonId: string): Promise<LessonProgress | undefined>;
  saveLesson(progress: LessonProgress): Promise<void>;
  addAttempt(attempt: Attempt): Promise<void>;
  listAttempts(profileId: string): Promise<Attempt[]>;
  getMiniGame(profileId: string, miniGameId: string): Promise<MiniGameProgress | undefined>;
  listMiniGames(profileId: string): Promise<MiniGameProgress[]>;
  saveMiniGame(progress: MiniGameProgress): Promise<void>;
  /** One concept's mastery + review state (Leitner scheduler), if any attempt has touched it. */
  getConceptStats(profileId: string, conceptId: string): Promise<ConceptStats | undefined>;
  listConceptStats(profileId: string): Promise<ConceptStats[]>;
  saveConceptStats(stats: ConceptStats): Promise<void>;
  /** Deletes every lesson-progress, attempt, mini-game, and concept-stats record for a profile (parent area "Delete"). */
  deleteProfileData(profileId: string): Promise<void>;
}

/** Persistence of `GameRecord`: full games and versus mini-games, vs the computer or a friend
 * (same device). Kept separate from `ProgressRepository` — an append-only log, not mastery state. */
export interface GameRecordRepository {
  add(record: GameRecord): Promise<void>;
  listByProfile(profileId: string): Promise<GameRecord[]>;
  /** Deletes every game record for a profile (parent area "Delete"). */
  deleteProfileData(profileId: string): Promise<void>;
}

/** Persistence of `EarnedBadge` / `Streak` / `SessionLog`: reward/habit records, not mastery state. */
export interface RewardsRepository {
  addEarnedBadge(badge: EarnedBadge): Promise<void>;
  listEarnedBadges(profileId: string): Promise<EarnedBadge[]>;
  saveEarnedBadge(badge: EarnedBadge): Promise<void>;
  getStreak(profileId: string): Promise<Streak | undefined>;
  saveStreak(streak: Streak): Promise<void>;
  getSessionLog(profileId: string, date: string): Promise<SessionLog | undefined>;
  saveSessionLog(log: SessionLog): Promise<void>;
  /** Every session-log row for a profile (parent report `minutesByDay`, the daily limit). */
  listSessionLogs(profileId: string): Promise<SessionLog[]>;
  /** Deletes every earned badge, the streak, and every session-log row for a profile (parent area "Delete"). */
  deleteProfileData(profileId: string): Promise<void>;
}

/** Persistence of `AssessmentResult` / `Unlock`. Optional on `AppDeps`: `app/assessment.ts`'s use
 * cases throw a clear error if used without it wired up. */
export interface AssessmentRepository {
  addAssessmentResult(result: AssessmentResult): Promise<void>;
  listAssessmentResults(profileId: string): Promise<AssessmentResult[]>;
  addUnlock(unlock: Unlock): Promise<void>;
  listUnlocks(profileId: string): Promise<Unlock[]>;
  /** Deletes every assessment result and unlock row for a profile (parent area "Delete"). */
  deleteProfileData(profileId: string): Promise<void>;
}

/** Persistence of the single parent gate. One lock per device. */
export interface ParentLockRepository {
  get(): Promise<ParentLock | undefined>;
  save(lock: ParentLock): Promise<void>;
}

/** Writes the parent password somewhere the parent can find again. */
export interface PasswordFileWriter {
  write(password: string): Promise<{ location: string }>;
}

/** Device-wide settings; `suggestedLevels`/`profileSettings` are each keyed per profile within it
 * (still one record per device — a second profile on the same device gets its own entry). */
export interface AppSettings {
  /** Profile to show first at the next app start (picker orders it first); `null` if none yet. */
  readonly lastProfileId: string | null;
  /** Play's vs Computer "Automatic level": each profile's own suggested `BotLevel.level`, by
   * profile id. Absent for a profile with no suggestion yet (`games.ts`'s `suggestedLevel`). */
  readonly suggestedLevels: Readonly<Record<string, number>>;
  /** Parent area "Settings per child", by profile id. Absent for a profile with none saved yet —
   * reads back as `DEFAULT_PROFILE_SETTINGS`. */
  readonly profileSettings: Readonly<Record<string, ProfileSettings>>;
  /** Result of the one `navigator.storage.persist()` request, made after the first profile is
   * created; `undefined` until it settles or when unavailable. */
  readonly storagePersisted?: boolean;
  /** This device's own random id (`app/device.ts`'s `getOrCreateDeviceId`), created once lazily and
   * never regenerated. Stamps this device's `SessionLog` rows and lets a merge import tell its own
   * rows apart from a foreign device's. Absent until first created. */
  readonly deviceId?: string;
}

/** Persistence of `AppSettings`. Async so cloud adapters can replace local ones. */
export interface SettingsRepository {
  get(): Promise<AppSettings>;
  save(settings: AppSettings): Promise<void>;
}

/** New record ids (UUID v4). */
export interface IdGenerator {
  next(): string;
}

/** Speaks text aloud; a no-op adapter when speech is unavailable. */
export interface Narrator {
  readonly available: boolean;
  speak(text: string): Promise<void>;
  cancel(): void;
}

/** Loads compiled lesson content (built from `packages/content`). */
export interface ContentSource {
  lessons(): readonly Lesson[];
  lesson(id: string): Lesson | undefined;
  minigames(): readonly MiniGame[];
  minigame(id: string): MiniGame | undefined;
  /** Tracks/worlds/ranks catalog, used by `loadJourney`. Optional so an existing `ContentSource`
   * fixture keeps typechecking unchanged. */
  catalog?(): TracksCatalog;
  /** The badge catalogue. Optional for the same reason `catalog` is. */
  badges?(): readonly BadgeDef[];
}

/** Current time; injected for deterministic tests. */
export interface Clock {
  now(): Date;
}

/** Randomness in [0, 1); seeded in tests. */
export interface Random {
  next(): number;
}

/** The computer opponent for `versus` mini-games. Runs in a Web Worker so search never blocks the
 * UI thread; same position + level + seed always replies with the same move (deterministic `Random`). */
export interface BotPlayer {
  chooseMove(state: GameState, level: number, seed: number): Promise<Move | null>;
}

/** Writes a backup file somewhere the parent can find again — web downloads it, a Capacitor adapter
 * could write to Documents. `filename`/`contents` are computed by `app/backup.ts`. */
export interface BackupFileWriter {
  write(filename: string, contents: string): Promise<void>;
}

/** Parent area "Import": replaces every locally stored record with `file`'s own, atomically (a web
 * adapter stages the full write, then swaps it in) so a failure partway never leaves mixed data.
 * Never touches the parent password or `AppSettings.lastProfileId`/`suggestedLevels`. */
export interface BackupImporter {
  replaceAll(file: BackupFile): Promise<void>;
  /** Device sharing (`app/merge.ts`'s `importMerged`): atomically writes `file` as this device's
   * entire new dataset. Session-log rows are keyed by (profile, date, device) —
   * `options.localDeviceId` says which rows are this device's own, so a foreign device's row for
   * the same day is stored alongside it, never overwritten; `options.deviceSettings` is carried
   * through unchanged rather than reset. Optional: `requireBackupImporter` throws without it. */
  writeMerged?(
    file: BackupFile,
    options: {
      readonly localDeviceId?: string;
      readonly deviceSettings: Pick<
        AppSettings,
        'lastProfileId' | 'suggestedLevels' | 'storagePersisted' | 'deviceId'
      >;
    },
  ): Promise<void>;
}

export type * from './domain/profile.ts';
export { validateNickname } from './domain/profile.ts';

export type { Avatar } from './domain/avatars.ts';
export { AVATARS } from './domain/avatars.ts';

export { stripNickname, voiceKey } from './domain/voice-text.ts';

export type { ParentLock } from './domain/parent-lock.ts';
export { isValidPassword } from './domain/parent-lock.ts';

export type { Lesson, MiniGame, CompiledContent } from './domain/lesson.ts';
export type {
  Stars,
  LessonProgress,
  Attempt,
  MiniGameProgress,
  GameRecord,
} from './domain/progress.ts';
export { withResumeStep, lessonStatus, lessonStars, totalStars } from './domain/progress.ts';

export type { AnimalFriend, RankLadderEntry } from './domain/rewards.ts';
export { animalFriends, rankLadder } from './domain/rewards.ts';

export type { BadgeCategory, BadgeTier, BadgeDef, EarnedBadge } from './domain/badges.ts';
export { markSeen } from './domain/badges.ts';

export type { Streak } from './domain/streak.ts';
export { localDayString } from './domain/streak.ts';

export type { SessionLog } from './domain/session-log.ts';

export { minutesUntilEnd, shouldWarn } from './domain/time-policy.ts';

export type { ProfileSettings } from './domain/profile-settings.ts';
export {
  DAILY_LIMIT_OPTIONS,
  PLAY_UNTIL_OPTIONS,
  PLAY_FROM_OPTIONS,
} from './domain/profile-settings.ts';

export type { ConceptStats, ConceptTask } from './domain/review.ts';
export { isWeak, isDue } from './domain/review.ts';

export { unlockedMiniGames } from './domain/play.ts';

export type {
  AssessmentScope,
  AssessmentScore,
  AssessmentResult,
  PlacementWorldPlan,
  Unlock,
} from './domain/assessment.ts';
export {
  TEST_OUT_LESSON_TASKS,
  PLACEMENT_TASKS_PER_WORLD,
  planTestOutLesson,
  planTestOutWorld,
  planPlacement,
  scoreTestOut,
  scorePlacementWorld,
} from './domain/assessment.ts';

export type { LessonPhase, SkippablePhase } from './domain/lesson-session.ts';
export {
  EASIER_VARIANT_STARS,
  lessonSteps,
  stepPhase,
  isSkippablePhase,
  phaseEndIndex,
  easierVariant,
  shouldOfferEasier,
} from './domain/lesson-session.ts';

export type {
  Habitat,
  Track,
  World,
  RankDef,
  TracksCatalog,
  JourneyLessonStatus,
  WorldStatus,
  WorldBossStatus,
} from './domain/journey.ts';
export {
  HABITATS,
  worldLessons,
  nextLesson,
  mainTrackLessons,
  findWorld,
} from './domain/journey.ts';

export type {
  ProfileRepository,
  ProgressRepository,
  GameRecordRepository,
  RewardsRepository,
  AssessmentRepository,
  ParentLockRepository,
  PasswordFileWriter,
  BackupFileWriter,
  BackupImporter,
  AppSettings,
  SettingsRepository,
  IdGenerator,
  Narrator,
  ContentSource,
  Clock,
  Random,
} from './app/ports.ts';

export type { AppDeps } from './app/use-cases.ts';
export {
  loadProgress,
  getLessonProgress,
  recordAttempt,
  recordExerciseResult,
  recordBossResult,
  recordReviewResult,
  skipLessonPhase,
  advanceLessonPhase,
} from './app/use-cases.ts';

export { loadMiniGameProgress, recordMiniGameResult } from './app/minigames.ts';

export type { Journey } from './app/journey.ts';
export { loadJourney } from './app/journey.ts';

export type { ParentUnlockTarget } from './app/assessment.ts';
export { submitAssessment, parentUnlock } from './app/assessment.ts';

export { recordSessionMinutes, starsToday, checkRewards } from './app/rewards.ts';

export type { TimeLimitReason, TimeLimitStatus } from './app/time-limit.ts';
export {
  checkActivityGate,
  combinedSessionLog,
  grantExtraTime,
  grantHoursOverride,
  markTimeWarning,
} from './app/time-limit.ts';

export type { ChildOverview, ChildReport } from './app/report.ts';
export { buildChildOverview, buildChildReport } from './app/report.ts';

export type { BackupFile } from './app/backup.ts';
// Backup/merge values (zod validation) live behind `@chess-kids/core/backup`/`/merge` so zod stays
// out of the main bundle and the bot worker; only the parent area imports them.

export { getProfileSettings, updateProfileSettings } from './app/settings.ts';

export type { TodaySessionPlan } from './app/session.ts';
export { loadWarmUp, loadPracticeTasks, loadTodaySession } from './app/session.ts';

export {
  isFirstRun,
  setupParentPassword,
  changeParentPassword,
  downloadParentCodeFile,
  verifyParentPassword,
  listProfiles,
  createProfile,
  renameProfile,
  changeAvatar,
  deleteProfile,
  resetProfileData,
  selectProfile,
} from './app/profiles.ts';

// Exercise-kind base abstraction (subject-free): every subject's kind registry is built on this;
// the chess kinds and their registry live behind `./chess` (`@chess-kids/core/chess`).
export type {
  ExerciseProgress,
  ExerciseKind,
  Step,
  TextKeyRef,
  KindInput,
} from './domain/exercise/kind.ts';

// The `series` mini-game mode: subject-free, rounds of any exercise type.
export type { SeriesGameState } from './domain/exercise/modes/series/def.ts';
export {
  startSeries,
  currentRound,
  completeRound,
  seriesResult,
  seriesStars,
} from './domain/exercise/modes/series/engine.ts';

// `SubjectCore`/`AppConfig` and `createSubjectRuntime`: a subject's kind/mode registries + app
// identifiers, injected via `AppDeps.subject`/`AppDeps.app`, never imported directly.
export type { AnyKind, AnyMode, SubjectCore, AppConfig } from './domain/subject.ts';
export type { SubjectRuntime } from './domain/runtime.ts';
export { createSubjectRuntime } from './domain/runtime.ts';

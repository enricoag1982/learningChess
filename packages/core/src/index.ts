export type * from './domain/profile.ts';
export { validateNickname } from './domain/profile.ts';

export type { Avatar } from './domain/avatars.ts';
export { AVATARS } from './domain/avatars.ts';

export { stripNickname, voiceKey } from './domain/voice-text.ts';

export type { ParentLock } from './domain/parent-lock.ts';
export { isValidPassword } from './domain/parent-lock.ts';

export type {
  DemoHighlight,
  Lesson,
  MiniGame,
  StaticMiniGame,
  SeriesMiniGame,
  VersusMiniGame,
  CompiledContent,
} from './domain/lesson.ts';
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

export type { PieceStyleSetting, ProfileSettings } from './domain/profile-settings.ts';
export {
  DAILY_LIMIT_OPTIONS,
  PLAY_UNTIL_OPTIONS,
  PLAY_FROM_OPTIONS,
  DEFAULT_PROFILE_SETTINGS,
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
  BotPlayer,
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

export type { ComputerLevelCondition, ComputerLevelStatus } from './app/games.ts';
export {
  recordGame,
  loadGameRecords,
  computerLevelStatus,
  suggestedLevel,
  updateSuggestedLevel,
  versusGameRecordResult,
} from './app/games.ts';

export type { LocalPlayer } from './app/friend-play.ts';
export { friendGameOptions, friendGamesPlayed, recordLocalMatch } from './app/friend-play.ts';

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

export type {
  Color,
  PieceType,
  File,
  Rank,
  Square,
  Piece,
  Position,
  Move,
  MoveInput,
} from './domain/chess/index.ts';
export {
  SQUARES,
  parseDiagram,
  DiagramError,
  parseFen,
  toFen,
  FenError,
  chessJsRules,
  PIECE_BY_LETTER,
} from './domain/chess/index.ts';

// Chess facts: pure predicates/derivations shared by the exercise engine, solver and content build.
export type { Goal, ReplayedLine, FailedReplay, ReplayResult } from './domain/chess/index.ts';
export {
  enemyCount,
  piecesEqual,
  hasKing,
  hasPieceOf,
  normalizeSan,
  sameSan,
  findMoveBySan,
  givesCheck,
  castlingMoves,
  enPassantMoves,
  doubleStepBefore,
  replaySanLine,
} from './domain/chess/index.ts';

export type { VariantRules } from './domain/variant/index.ts';
export { createVariantRules } from './domain/variant/index.ts';

export type {
  CollectStarsDef,
  CaptureDef,
  SelectSquaresDef,
  YesNoDef,
  ChoiceOption,
  ChoiceDef,
  BestMoveDef,
  SetupDef,
  MateInNDef,
  ExerciseDef,
  ExerciseState,
  PalettePiece,
  Hint,
  GameState,
  SeriesGameState,
  VersusState,
  StaticGoalSource,
  ExerciseFeedback,
  ExerciseNoteKind,
  ExerciseNoteCtx,
  ExerciseNote,
  Resolve,
  ModeType,
  MiniGameState,
  MoveOutcome,
  UndoAction,
  UndoOutcome,
} from './domain/exercise/index.ts';
export {
  EXERCISE_NOTES,
  exerciseNote,
  isEasierOfferNote,
  MINI_GAME_MODES,
  modeOf,
} from './domain/exercise/index.ts';

// Exercise-kind registry: the only exercise-type dispatch (`domain/exercise/kinds/index.ts`).
export type {
  ExerciseProgress,
  ExerciseKind,
  Step,
  TextKeyRef,
  KindInput,
  ExerciseStateOf,
  ExerciseType,
  DefOf,
  ExerciseAction,
  ChessKind,
  ActionOf,
  OutcomeOf,
  AnyExerciseKind,
  MoveAction,
  AnswerOutcome,
  ToggleAction,
  SubmitAction,
  SelectSquaresAction,
  SelectOutcome,
  AnswerYesNoAction,
  AnswerChoiceAction,
  PlaceAction,
} from './domain/exercise/index.ts';
export { EXERCISE_KINDS, kindOf } from './domain/exercise/index.ts';

export {
  staticGoalExercise,
  startExercise,
  selectSquaresAnswer,
  setupPalette,
  requestHint,
  starsFor,
  solve,
  optimalMoves,
  kingSquare,
  isAttacked,
  isDefended,
  isHanging,
  isSafe,
  pieceValue,
  isInCheck,
  isCheckmate,
  isStalemate,
  isInsufficientMaterial,
  canCastle,
  canEnPassant,
  startStaticCaptureGame,
  playGameMove,
  gameResult,
  gameStars,
  startSeries,
  currentRound,
  completeRound,
  seriesResult,
  seriesStars,
  startVersus,
  versusPosition,
  versusEndReason,
  versusGameState,
  isKidTurn,
  kidMoveCount,
  playVersusMove,
  canTakeBack,
  takeBackVersusMove,
  versusStars,
} from './domain/exercise/index.ts';

// Variant game rules and the computer opponent. Namespaced: both reuse names already taken by the
// static-capture mini-game API above (`GameState`, `playGameMove`, `gameResult`).
export * as game from './domain/game/index.ts';
export * as bot from './domain/bot/index.ts';

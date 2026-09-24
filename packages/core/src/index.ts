export type * from './domain/profile.ts';
export { validateNickname, newProfile } from './domain/profile.ts';

export type { Avatar } from './domain/avatars.ts';
export { AVATARS, isAvatar } from './domain/avatars.ts';

export type { ParentLock, CheckPasswordResult } from './domain/parent-lock.ts';
export {
  isValidPassword,
  newParentLock,
  changePassword,
  checkPassword,
} from './domain/parent-lock.ts';

export type {
  DemoHighlight,
  LessonDemo,
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
  LessonStatus,
  MiniGameProgress,
  GameRecord,
  GameRecordResult,
} from './domain/progress.ts';
export {
  newLessonProgress,
  recordExerciseStars,
  recordBossStars,
  withResumeStep,
  lessonStatus,
  lessonStars,
  totalStars,
  recordMiniGamePlay,
} from './domain/progress.ts';

export type { AnimalFriend, RankState, RankLadderEntry } from './domain/rewards.ts';
export { animalFriends, rankLadder } from './domain/rewards.ts';

export type { ReviewBox, ConceptStats, ConceptPoolEntry, ConceptTask } from './domain/review.ts';
export {
  newConceptStats,
  appendResult,
  accuracy,
  isWeak,
  enterReview,
  applyReviewResult,
  isDue,
  conceptPool,
  pickWarmUp,
  pickPracticeTasks,
} from './domain/review.ts';

export type { UnlockedMiniGame } from './domain/play.ts';
export { unlockedMiniGames } from './domain/play.ts';

export type { LessonStep, LessonPhase } from './domain/lesson-session.ts';
export {
  EASIER_AFTER_ERRORS,
  EASIER_VARIANT_STARS,
  lessonSteps,
  stepPhase,
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
  NextStep,
} from './domain/journey.ts';
export {
  HABITATS,
  isHabitat,
  worldLessons,
  worldStatus,
  worldBossStatus,
  lessonAvailability,
  nextLesson,
  nextStep,
  currentRank,
} from './domain/journey.ts';

export type {
  ProfileRepository,
  ProgressRepository,
  GameRecordRepository,
  ParentLockRepository,
  PasswordFileWriter,
  AppSettings,
  SettingsRepository,
  IdGenerator,
  Narrator,
  ContentSource,
  Clock,
  Random,
  FeatureFlags,
  BotPlayer,
} from './app/ports.ts';
export { v1FeatureFlags } from './app/ports.ts';

export type {
  AppDeps,
  RecordAttemptInput,
  RecordExerciseResultInput,
  RecordBossResultInput,
  RecordReviewResultInput,
} from './app/use-cases.ts';
export {
  loadProgress,
  getLessonProgress,
  getConceptStats,
  recordAttempt,
  recordExerciseResult,
  recordBossResult,
  recordReviewResult,
  saveResumeStep,
} from './app/use-cases.ts';

export type { RecordMiniGameResultInput } from './app/minigames.ts';
export { loadMiniGameProgress, recordMiniGameResult } from './app/minigames.ts';

export type { RecordGameInput, ComputerLevelCondition, ComputerLevelStatus } from './app/games.ts';
export {
  recordGame,
  loadGameRecords,
  computerLevelStatus,
  versusGameRecordResult,
} from './app/games.ts';

export type { Journey, JourneyWorld } from './app/journey.ts';
export { loadJourney } from './app/journey.ts';

export type { TodayActivity, TodaySessionPlan } from './app/session.ts';
export {
  PRACTICE_TASK_COUNT,
  planWarmUp,
  loadWarmUp,
  loadPracticeTasks,
  planTodaySession,
  loadTodaySession,
} from './app/session.ts';

export type { PasswordFileLocation, VerifyPasswordResult } from './app/profiles.ts';
export {
  isFirstRun,
  setupParentPassword,
  changeParentPassword,
  verifyParentPassword,
  listProfiles,
  createProfile,
  renameProfile,
  changeAvatar,
  deleteProfile,
  selectProfile,
} from './app/profiles.ts';

export type {
  Color,
  PieceType,
  File,
  Rank,
  Square,
  Piece,
  Markers,
  Position,
  Move,
  MoveInput,
  PositionStatus,
  ChessRules,
  SearchBoard,
} from './domain/chess/index.ts';
export {
  SQUARES,
  isSquare,
  parseDiagram,
  toDiagram,
  DiagramError,
  parseFen,
  toFen,
  FenError,
  InvalidPositionError,
  chessJsRules,
} from './domain/chess/index.ts';

export type { VariantOptions, VariantRules } from './domain/variant/index.ts';
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
  MoveOutcome,
  SelectionResult,
  PlaceOutcome,
  PalettePiece,
  Hint,
  MateInNOutcome,
  SolverMove,
  StaticCaptureGameDef,
  MiniGameGoal,
  GameState,
  GameOutcome,
  SeriesGameDef,
  SeriesGameState,
  VersusGameDef,
  VersusState,
  VersusStatus,
  VersusMoveOutcome,
  BossResultSummary,
} from './domain/exercise/index.ts';
export {
  startExercise,
  exerciseMoves,
  playMove,
  toggleSquare,
  submitSelection,
  selectSquaresAnswer,
  answerYesNo,
  answerChoice,
  placePiece,
  setupPalette,
  undo,
  requestHint,
  starsFor,
  playMateInN,
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
  summarizeBossResult,
  isBossResultWin,
} from './domain/exercise/index.ts';

// Variant game rules (standard chess and kingless mini-games, played against the bot below) and
// the computer opponent. Namespaced: both reuse names already taken by the static-capture
// mini-game API above (`GameState`, `playGameMove`, `gameResult`), for a different kind of game.
export * as game from './domain/game/index.ts';
export * as bot from './domain/bot/index.ts';

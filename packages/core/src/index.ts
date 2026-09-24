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
  CompiledContent,
} from './domain/lesson.ts';
export type { Stars, LessonProgress, Attempt, LessonStatus } from './domain/progress.ts';
export {
  newLessonProgress,
  recordExerciseStars,
  recordBossStars,
  withResumeStep,
  lessonStatus,
  lessonStars,
  totalStars,
} from './domain/progress.ts';

export type { LessonStep, LessonPhase } from './domain/lesson-session.ts';
export { lessonSteps, stepPhase } from './domain/lesson-session.ts';

export type {
  ProfileRepository,
  ProgressRepository,
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
} from './app/ports.ts';
export { v1FeatureFlags } from './app/ports.ts';

export type { AppDeps, RecordExerciseResultInput, RecordBossResultInput } from './app/use-cases.ts';
export {
  loadProgress,
  getLessonProgress,
  recordExerciseResult,
  recordBossResult,
  saveResumeStep,
} from './app/use-cases.ts';

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
  ExerciseDef,
  ExerciseState,
  MoveOutcome,
  SelectionResult,
  Hint,
  SolverMove,
  StaticCaptureGameDef,
  GameState,
  GameOutcome,
} from './domain/exercise/index.ts';
export {
  startExercise,
  exerciseMoves,
  playMove,
  toggleSquare,
  submitSelection,
  undo,
  requestHint,
  starsFor,
  solve,
  optimalMoves,
  startStaticCaptureGame,
  playGameMove,
  gameResult,
  gameStars,
} from './domain/exercise/index.ts';

import type { Lesson } from '../domain/lesson.ts';
import { EASIER_AFTER_ERRORS, EASIER_VARIANT_STARS } from '../domain/lesson-session.ts';
import type { SkippablePhase } from '../domain/lesson-session.ts';
import type { GameRecord, LessonProgress } from '../domain/progress.ts';
import type { AppConfig, ExerciseStateBase, MiniGameStateBase } from '../domain/subject.ts';
import type { SubjectRuntime } from '../domain/runtime.ts';
import {
  newLessonProgress,
  recordBossStars,
  recordExerciseStars,
  withoutSkippedPhase,
  withResumeStep,
  withSkippedPhase,
} from '../domain/progress.ts';
import type { ConceptStats, ConceptTask } from '../domain/review.ts';
import { appendResult, applyReviewResult, enterReview, newConceptStats } from '../domain/review.ts';
import { saveMiniGamePlay } from './minigames.ts';
import type {
  AssessmentRepository,
  BackupFileWriter,
  BackupImporter,
  ContentSource,
  GameRecordRepository,
  IdGenerator,
  ParentLockRepository,
  PasswordFileWriter,
  ProfileRepository,
  ProgressRepository,
  RewardsRepository,
  SettingsRepository,
} from './ports.ts';
import type { Random } from '../domain/random.ts';
import type { Clock } from './ports.ts';
import { checkRewards } from './rewards.ts';

export interface AppDeps {
  readonly profiles: ProfileRepository;
  readonly progress: ProgressRepository;
  readonly gameRecords: GameRecordRepository;
  /** Optional so `AppDeps` fixtures keep typechecking; `checkRewards` no-ops without it. */
  readonly rewards?: RewardsRepository;
  readonly assessment?: AssessmentRepository;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly content: ContentSource;
  readonly parentLock: ParentLockRepository;
  readonly passwordFile: PasswordFileWriter;
  readonly settings: SettingsRepository;
  readonly random: Random;
  /** Optional: `exportBackup` throws without it. */
  readonly backupFileWriter?: BackupFileWriter;
  readonly backupImporter?: BackupImporter;
  /** Current storage schema version, injected so `app/backup.ts` stamps / validates backups without importing a web adapter constant. */
  readonly storageSchemaVersion?: number;
  /** Kind + mode registries via `createSubjectRuntime`: the only way platform code reaches an exercise kind or mini-game mode. */
  readonly subject: SubjectRuntime;
  readonly app: AppConfig;
}

function starsFor(subject: SubjectRuntime, state: ExerciseStateBase): 0 | 1 | 2 | 3 {
  if (!state.solved) {
    return 0;
  }
  return subject.kinds[state.def.type]?.stars(state) ?? 0;
}

export async function getConceptStats(
  deps: AppDeps,
  profileId: string,
  conceptId: string,
): Promise<ConceptStats> {
  const existing = await deps.progress.getConceptStats(profileId, conceptId);
  if (existing !== undefined) {
    return existing;
  }
  return newConceptStats(deps.ids.next(), profileId, conceptId, deps.clock.now());
}

/** Appends `correct` to `recent`; `EASIER_AFTER_ERRORS`+ errors also put the concept in review, due immediately. */
async function recordConceptOutcome(
  deps: AppDeps,
  profileId: string,
  conceptId: string,
  correct: boolean,
  errors: number,
  now: Date,
): Promise<void> {
  let stats = await getConceptStats(deps, profileId, conceptId);
  stats = appendResult(stats, correct, now);
  if (errors >= EASIER_AFTER_ERRORS) {
    stats = enterReview(stats, now, true);
  }
  await deps.progress.saveConceptStats(stats);
}

export async function loadProgress(deps: AppDeps, profileId: string): Promise<LessonProgress[]> {
  return deps.progress.listLessons(profileId);
}

export function loadGameRecords(deps: AppDeps, profileId: string): Promise<GameRecord[]> {
  return deps.gameRecords.listByProfile(profileId);
}

export async function getLessonProgress(
  deps: AppDeps,
  profileId: string,
  lessonId: string,
): Promise<LessonProgress> {
  const existing = await deps.progress.getLesson(profileId, lessonId);
  if (existing !== undefined) {
    return existing;
  }
  return newLessonProgress(deps.ids.next(), profileId, lessonId, deps.clock.now());
}

export interface RecordAttemptInput {
  readonly profileId: string;
  readonly lesson: Lesson;
  readonly state: ExerciseStateBase;
  /** `false` for guided tries and the demo: recorded as an attempt but never scored. */
  readonly scored: boolean;
  readonly durationMs: number;
}

/** Logs one `Attempt` without touching lesson progress (alone when an unsolved exercise is left for its easier variant);
 * a scored attempt also folds into concept stats. */
export async function recordAttempt(deps: AppDeps, input: RecordAttemptInput): Promise<void> {
  const { profileId, lesson, state, scored, durationMs } = input;
  const now = deps.clock.now();
  const stars = starsFor(deps.subject, state);
  const correct = state.solved && state.errors === 0 && state.hintLevel === 0;

  await deps.progress.addAttempt({
    id: deps.ids.next(),
    profileId,
    lessonId: lesson.id,
    exerciseId: state.def.id,
    conceptId: state.def.concept,
    scored,
    correct,
    stars,
    hints: state.hintLevel,
    errors: state.errors,
    moves: state.moves,
    durationMs,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });

  if (scored) {
    await recordConceptOutcome(deps, profileId, state.def.concept, correct, state.errors, now);
  }
}

export interface RecordExerciseResultInput {
  readonly profileId: string;
  readonly lesson: Lesson;
  readonly state: ExerciseStateBase;
  readonly scored: boolean;
  readonly durationMs: number;
  readonly nextStep: number;
  /** Set for an easier variant: the scored exercise it replaces; solving credits it `EASIER_VARIANT_STARS`. */
  readonly standsInFor?: string;
  /** Set when this solve leaves a skippable phase normally (`LessonScreen`): unmarks a previous "Skip" of it. */
  readonly completesPhase?: SkippablePhase;
}

/** Always saves an `Attempt`; when solved, updates best stars (`standsInFor` else this exercise if `scored`) and
 * `resumeStep`. The call that first completes the lesson also enters its concept into review, due in 1 day. */
export async function recordExerciseResult(
  deps: AppDeps,
  input: RecordExerciseResultInput,
): Promise<LessonProgress> {
  const { profileId, lesson, state, scored, durationMs, nextStep, standsInFor, completesPhase } =
    input;
  const now = deps.clock.now();
  const stars = starsFor(deps.subject, state);

  await recordAttempt(deps, { profileId, lesson, state, scored, durationMs });

  let progress = await getLessonProgress(deps, profileId, lesson.id);
  if (completesPhase !== undefined) {
    progress = withoutSkippedPhase(progress, completesPhase, now);
  }
  const wasComplete = progress.completedAt !== undefined;
  if (state.solved && stars !== 0) {
    if (standsInFor !== undefined) {
      progress = recordExerciseStars(progress, standsInFor, EASIER_VARIANT_STARS, lesson, now);
    } else if (scored) {
      progress = recordExerciseStars(progress, state.def.id, stars, lesson, now);
    }
  }
  progress = withResumeStep(progress, nextStep, now);
  await deps.progress.saveLesson(progress);

  if (!wasComplete && progress.completedAt !== undefined) {
    const stats = await getConceptStats(deps, profileId, lesson.concept);
    await deps.progress.saveConceptStats(enterReview(stats, now, false));
  }

  // "exercise completed" event: only a real completion counts, never a guided try or an unsolved
  // attempt logged on the way to an easier variant.
  if (state.solved && stars !== 0 && (scored || standsInFor !== undefined)) {
    await checkRewards(deps, profileId);
  }

  return progress;
}

export interface RecordBossResultInput {
  readonly profileId: string;
  readonly lesson: Lesson;
  readonly state: MiniGameStateBase;
  readonly durationMs: number;
  readonly nextStep: number;
}

/** Always saves an `Attempt`; updates the lesson's best boss stars and `resumeStep`; also folds the play into the boss's
 * `MiniGameProgress` (`saveMiniGamePlay`) so the Play tile reflects an in-lesson win. */
export async function recordBossResult(
  deps: AppDeps,
  input: RecordBossResultInput,
): Promise<LessonProgress> {
  const { profileId, lesson, state, durationMs, nextStep } = input;
  const now = deps.clock.now();
  const mode = deps.subject.modes[state.mode];
  if (mode === undefined) {
    throw new Error(`recordBossResult: no mode registered for "${state.mode}"`);
  }
  const summary = mode.summarise(state);

  await deps.progress.addAttempt({
    id: deps.ids.next(),
    profileId,
    lessonId: lesson.id,
    exerciseId: state.def.id,
    conceptId: summary.conceptId,
    scored: true,
    correct: summary.correct,
    stars: summary.stars,
    hints: summary.hints,
    errors: summary.errors,
    moves: summary.moves,
    durationMs,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });

  let progress = await getLessonProgress(deps, profileId, lesson.id);
  progress = recordBossStars(progress, summary.stars, now);
  progress = withResumeStep(progress, nextStep, now);
  await deps.progress.saveLesson(progress);

  const minigame = lesson.boss !== undefined ? deps.content.minigame(lesson.boss) : undefined;
  if (minigame !== undefined) {
    await saveMiniGamePlay(deps, { profileId, game: minigame, state });
  }

  await checkRewards(deps, profileId);

  return progress;
}

export interface RecordReviewResultInput {
  readonly profileId: string;
  readonly task: ConceptTask;
  readonly state: ExerciseStateBase;
  readonly durationMs: number;
  /** `'warmup'`: Today's warm-up or Practice's "Daily warm-up" card; `'practice'`: a Practice topic run. */
  readonly reviewSource: 'warmup' | 'practice';
}

/** Records a warm-up or Practice review task: saves a scored, `review: true` `Attempt` (never
 * touching lesson `bestStars`), then moves the concept's Leitner box (`applyReviewResult`). */
export async function recordReviewResult(
  deps: AppDeps,
  input: RecordReviewResultInput,
): Promise<ConceptStats> {
  const { profileId, task, state, durationMs, reviewSource } = input;
  const now = deps.clock.now();
  const stars = starsFor(deps.subject, state);
  const correct = state.solved && state.errors === 0 && state.hintLevel === 0;

  await deps.progress.addAttempt({
    id: deps.ids.next(),
    profileId,
    lessonId: task.lessonId,
    exerciseId: task.exercise.id,
    conceptId: task.conceptId,
    scored: true,
    review: true,
    reviewSource,
    correct,
    stars,
    hints: state.hintLevel,
    errors: state.errors,
    moves: state.moves,
    durationMs,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });

  let stats = await getConceptStats(deps, profileId, task.conceptId);
  stats = appendResult(stats, correct, now);
  stats = applyReviewResult(stats, correct, task.exercise.id, now);
  await deps.progress.saveConceptStats(stats);

  await checkRewards(deps, profileId);

  return stats;
}

/** Marks `phase` skipped (kid tapped "Skip" on Story/Demo/Try) and moves the resume point past it.
 * No attempt logged: Story/Demo never track one. */
export async function skipLessonPhase(
  deps: AppDeps,
  profileId: string,
  lessonId: string,
  phase: SkippablePhase,
  nextStep: number,
): Promise<LessonProgress> {
  const now = deps.clock.now();
  let progress = await getLessonProgress(deps, profileId, lessonId);
  progress = withSkippedPhase(progress, phase, now);
  progress = withResumeStep(progress, nextStep, now);
  await deps.progress.saveLesson(progress);
  return progress;
}

/** Moves the resume point and unmarks `completedPhase` if it was previously skipped — a "Play
 * again" replay that this time plays the phase through. */
export async function advanceLessonPhase(
  deps: AppDeps,
  profileId: string,
  lessonId: string,
  completedPhase: SkippablePhase,
  nextStep: number,
): Promise<LessonProgress> {
  const now = deps.clock.now();
  let progress = await getLessonProgress(deps, profileId, lessonId);
  progress = withoutSkippedPhase(progress, completedPhase, now);
  progress = withResumeStep(progress, nextStep, now);
  await deps.progress.saveLesson(progress);
  return progress;
}

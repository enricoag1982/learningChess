import type { ExerciseState } from '../domain/exercise/state.ts';
import { starsFor } from '../domain/exercise/kinds/index.ts';
import { modeOf } from '../domain/exercise/modes/index.ts';
import type { GameState } from '../domain/exercise/modes/static/def.ts';
import type { SeriesGameState } from '../domain/exercise/modes/series/def.ts';
import type { VersusState } from '../domain/exercise/modes/versus/def.ts';
import type { Lesson } from '../domain/lesson.ts';
import { EASIER_AFTER_ERRORS, EASIER_VARIANT_STARS } from '../domain/lesson-session.ts';
import type { SkippablePhase } from '../domain/lesson-session.ts';
import type { LessonProgress } from '../domain/progress.ts';
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
  Random,
  RewardsRepository,
  SettingsRepository,
} from './ports.ts';
import type { Clock } from './ports.ts';
import { checkRewards } from './rewards.ts';

/** Everything a use case needs, gathered in one place so call sites pass a single `deps` object. */
export interface AppDeps {
  readonly profiles: ProfileRepository;
  readonly progress: ProgressRepository;
  /** Full games and versus mini-games played vs the computer. */
  readonly gameRecords: GameRecordRepository;
  /** Earned badges, streak, session log. Optional so an `AppDeps` fixture keeps typechecking
   * unchanged; `checkRewards` simply no-ops without it. */
  readonly rewards?: RewardsRepository;
  /** Assessment results + unlocked lesson/world ids. Optional, same reason `rewards` is. */
  readonly assessment?: AssessmentRepository;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly content: ContentSource;
  readonly parentLock: ParentLockRepository;
  readonly passwordFile: PasswordFileWriter;
  readonly settings: SettingsRepository;
  /** Seeded in tests; drives warm-up/practice task selection. */
  readonly random: Random;
  /** Backup export's file destination. Optional: `app/backup.ts`'s `exportBackup` throws without it. */
  readonly backupFileWriter?: BackupFileWriter;
  /** Backup import's atomic replace, same optional-port reasoning as `backupFileWriter`. */
  readonly backupImporter?: BackupImporter;
  /** Current local storage schema version, injected so `app/backup.ts` can stamp/validate a backup
   * file without `packages/core` importing a web adapter constant. Optional, same reason as above. */
  readonly storageSchemaVersion?: number;
}

/** Existing concept stats, or fresh (unsaved) ones if this profile has no attempt for it yet. */
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

/** Folds one scored attempt's outcome into its concept's stats: always appends `correct` to
 * `recent`; `EASIER_AFTER_ERRORS`-or-more errors also puts the concept in review, due immediately. */
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

/** All saved lesson progress for a profile. */
export async function loadProgress(deps: AppDeps, profileId: string): Promise<LessonProgress[]> {
  return deps.progress.listLessons(profileId);
}

/** Saved progress for one lesson, or fresh (unsaved) progress if the kid has not started it. */
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

/** Input to log one exercise attempt (see `recordAttempt`). */
export interface RecordAttemptInput {
  readonly profileId: string;
  readonly lesson: Lesson;
  readonly state: ExerciseState;
  /** `false` for guided tries and the demo: recorded as an attempt but never scored. */
  readonly scored: boolean;
  readonly durationMs: number;
}

/** Logs one `Attempt` without touching lesson progress. Used on its own when the kid leaves an
 * unsolved exercise for its easier variant (that failed attempt always has `errors >=
 * EASIER_AFTER_ERRORS`); also folds a scored attempt's outcome into concept stats. */
export async function recordAttempt(deps: AppDeps, input: RecordAttemptInput): Promise<void> {
  const { profileId, lesson, state, scored, durationMs } = input;
  const now = deps.clock.now();
  const stars = starsFor(state);
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

/** Result of an exercise attempt (guided try or scored exercise). */
export interface RecordExerciseResultInput {
  readonly profileId: string;
  readonly lesson: Lesson;
  readonly state: ExerciseState;
  /** `false` for guided tries and the demo: recorded as an attempt but never scored. */
  readonly scored: boolean;
  readonly durationMs: number;
  /** Step index to resume at next (see `lessonSteps`). */
  readonly nextStep: number;
  /** Set when `state` is an easier variant: the scored exercise id it replaces; solving credits that
   * exercise `EASIER_VARIANT_STARS`. */
  readonly standsInFor?: string;
  /** Set when this solve leaves a skippable phase normally (`LessonScreen` computes it): unmarks it
   * from `skippedPhases` if a previous "Skip" had set it — a "Play again" playing it through. */
  readonly completesPhase?: SkippablePhase;
}

/** Records an exercise attempt: always saves an `Attempt`; when solved, updates the lesson's best
 * stars (`standsInFor` if set, else this exercise when `scored`); advances `resumeStep`. The call
 * that first completes the lesson also enters its concept into review, due in 1 day. */
export async function recordExerciseResult(
  deps: AppDeps,
  input: RecordExerciseResultInput,
): Promise<LessonProgress> {
  const { profileId, lesson, state, scored, durationMs, nextStep, standsInFor, completesPhase } =
    input;
  const now = deps.clock.now();
  const stars = starsFor(state);

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

/** Result of playing a lesson's boss mini-game: `static`, `series`, or `versus` (vs the bot). */
export interface RecordBossResultInput {
  readonly profileId: string;
  readonly lesson: Lesson;
  readonly state: GameState | SeriesGameState | VersusState;
  readonly durationMs: number;
  /** Step index to resume at next (see `lessonSteps`). */
  readonly nextStep: number;
}

/** Records a boss mini-game attempt: always saves an `Attempt`, updates the lesson's best boss
 * stars, advances `resumeStep`. Also folds the play into the boss's own `MiniGameProgress`
 * (`saveMiniGamePlay`), so the Play screen's tile reflects a win made from inside the lesson too. */
export async function recordBossResult(
  deps: AppDeps,
  input: RecordBossResultInput,
): Promise<LessonProgress> {
  const { profileId, lesson, state, durationMs, nextStep } = input;
  const now = deps.clock.now();
  const summary = modeOf(state).summarise(state);

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

/** Result of one warm-up/practice review task (see `recordReviewResult`). */
export interface RecordReviewResultInput {
  readonly profileId: string;
  readonly task: ConceptTask;
  readonly state: ExerciseState;
  readonly durationMs: number;
  /** `'warmup'` for Today's inline warm-up or Practice's "Daily warm-up" card, `'practice'` for a
   * Practice topic run. */
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
  const stars = starsFor(state);
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

/** Moves the resume point for a lesson without recording an attempt (e.g. leaving mid-story). */
export async function saveResumeStep(
  deps: AppDeps,
  profileId: string,
  lessonId: string,
  step: number,
): Promise<LessonProgress> {
  const progress = await getLessonProgress(deps, profileId, lessonId);
  const saved = withResumeStep(progress, step, deps.clock.now());
  await deps.progress.saveLesson(saved);
  return saved;
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

/** Moves the resume point like `saveResumeStep`, and unmarks `completedPhase` if it was previously
 * skipped — a "Play again" replay that this time plays the phase through. */
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

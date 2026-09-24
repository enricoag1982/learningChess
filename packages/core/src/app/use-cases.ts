import type { ExerciseState } from '../domain/exercise/engine.ts';
import { starsFor } from '../domain/exercise/engine.ts';
import { summarizeBossResult } from '../domain/exercise/boss-result.ts';
import type { GameState, SeriesGameState } from '../domain/exercise/minigame.ts';
import type { VersusState } from '../domain/exercise/versus.ts';
import type { Lesson } from '../domain/lesson.ts';
import { EASIER_AFTER_ERRORS, EASIER_VARIANT_STARS } from '../domain/lesson-session.ts';
import type { LessonProgress } from '../domain/progress.ts';
import {
  newLessonProgress,
  recordBossStars,
  recordExerciseStars,
  withResumeStep,
} from '../domain/progress.ts';
import type { ConceptStats, ConceptTask } from '../domain/review.ts';
import { appendResult, applyReviewResult, enterReview, newConceptStats } from '../domain/review.ts';
import { saveMiniGamePlay } from './minigames.ts';
import type {
  ContentSource,
  IdGenerator,
  ParentLockRepository,
  PasswordFileWriter,
  ProfileRepository,
  ProgressRepository,
  Random,
  SettingsRepository,
} from './ports.ts';
import type { Clock } from './ports.ts';

/** Everything a use case needs, gathered in one place so call sites pass a single `deps` object. */
export interface AppDeps {
  readonly profiles: ProfileRepository;
  readonly progress: ProgressRepository;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly content: ContentSource;
  readonly parentLock: ParentLockRepository;
  readonly passwordFile: PasswordFileWriter;
  readonly settings: SettingsRepository;
  /** Seeded in tests; drives warm-up/practice task selection (M3.4). */
  readonly random: Random;
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

/**
 * Folds one scored attempt's outcome into its concept's stats (domain-model.md §3.1): always
 * appends `correct` to `recent`; an attempt that needed `EASIER_AFTER_ERRORS` errors or more —
 * the same threshold the easier-variant offer uses, "the kid needed the easier variant / failed
 * an exercise twice" — also puts the concept in review, due immediately. A single stray error (or
 * a hint used with no error) still counts against accuracy but does not, on its own, schedule a
 * review task for the very next session.
 */
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

/**
 * Logs one `Attempt` without touching lesson progress. Used on its own when the kid leaves an
 * unsolved exercise for its easier variant: that failed attempt always has `errors >=
 * EASIER_AFTER_ERRORS` by construction (the offer only appears past that threshold), which is
 * what the M3.4 review scheduler reads to put the concept back into review, due immediately. Also
 * folds a scored attempt's outcome into that concept's stats (`recordConceptOutcome`) — the single
 * place both this and `recordExerciseResult` (which calls it) go through.
 */
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
  /**
   * Set when `state` is an easier variant: the scored exercise id it replaces; solving credits that
   * exercise `EASIER_VARIANT_STARS` (domain-model.md §3.4).
   */
  readonly standsInFor?: string;
}

/**
 * Records an exercise attempt: always saves an `Attempt`; when solved, also updates the lesson's
 * best stars — for `standsInFor` if set, else for this exercise when `scored`. Always advances
 * `resumeStep` and saves progress. The moment this call is what first completes the lesson (every
 * exercise now >= 1 star — whether directly or via an easier variant crediting the original), the
 * lesson's concept enters review (domain-model.md §3.1), due in 1 day unless an earlier
 * `EASIER_AFTER_ERRORS`-or-more attempt already put it in sooner (`enterReview`'s non-immediate
 * case never delays that).
 */
export async function recordExerciseResult(
  deps: AppDeps,
  input: RecordExerciseResultInput,
): Promise<LessonProgress> {
  const { profileId, lesson, state, scored, durationMs, nextStep, standsInFor } = input;
  const now = deps.clock.now();
  const stars = starsFor(state);

  await recordAttempt(deps, { profileId, lesson, state, scored, durationMs });

  let progress = await getLessonProgress(deps, profileId, lesson.id);
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

/**
 * Records a boss mini-game attempt: always saves an `Attempt` (bosses are always scored), updates
 * the lesson's best boss stars, advances `resumeStep`, and saves progress. A boss is always also
 * one mini-game in content (`lesson.boss`'s id): this also folds the play into that mini-game's
 * own `MiniGameProgress` (`saveMiniGamePlay`, no second attempt), so the Play screen's tile reflects a win made
 * from inside the lesson too, not only from a standalone Play session.
 */
export async function recordBossResult(
  deps: AppDeps,
  input: RecordBossResultInput,
): Promise<LessonProgress> {
  const { profileId, lesson, state, durationMs, nextStep } = input;
  const now = deps.clock.now();
  const summary = summarizeBossResult(state);

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

  return progress;
}

/** Result of one warm-up/practice review task (see `recordReviewResult`). */
export interface RecordReviewResultInput {
  readonly profileId: string;
  readonly task: ConceptTask;
  readonly state: ExerciseState;
  readonly durationMs: number;
}

/**
 * Records a warm-up or Practice review task (domain-model.md §3.1, §3.3): always saves a scored,
 * `review: true` `Attempt` against the task's own lesson id — never touching that lesson's
 * `bestStars` — then moves the concept's Leitner box (`applyReviewResult`): up on a first-try
 * correct answer, back to box 1 otherwise, always rescheduling `dueAt` and remembering the task's
 * exercise id so the next pick avoids repeating it.
 */
export async function recordReviewResult(
  deps: AppDeps,
  input: RecordReviewResultInput,
): Promise<ConceptStats> {
  const { profileId, task, state, durationMs } = input;
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

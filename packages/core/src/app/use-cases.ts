import type { ExerciseState } from '../domain/exercise/engine.ts';
import { starsFor } from '../domain/exercise/engine.ts';
import { summarizeBossResult } from '../domain/exercise/boss-result.ts';
import type { GameState, SeriesGameState } from '../domain/exercise/minigame.ts';
import type { VersusState } from '../domain/exercise/versus.ts';
import type { Lesson } from '../domain/lesson.ts';
import { EASIER_VARIANT_STARS } from '../domain/lesson-session.ts';
import type { LessonProgress } from '../domain/progress.ts';
import {
  newLessonProgress,
  recordBossStars,
  recordExerciseStars,
  withResumeStep,
} from '../domain/progress.ts';
import { saveMiniGamePlay } from './minigames.ts';
import type {
  ContentSource,
  IdGenerator,
  ParentLockRepository,
  PasswordFileWriter,
  ProfileRepository,
  ProgressRepository,
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
 * unsolved exercise for its easier variant: the failed attempt (`correct: false`) is what the M3
 * review scheduler reads to put the concept back into review.
 */
export async function recordAttempt(deps: AppDeps, input: RecordAttemptInput): Promise<void> {
  const { profileId, lesson, state, scored, durationMs } = input;
  const now = deps.clock.now();
  const stars = starsFor(state);

  await deps.progress.addAttempt({
    id: deps.ids.next(),
    profileId,
    lessonId: lesson.id,
    exerciseId: state.def.id,
    conceptId: state.def.concept,
    scored,
    correct: state.solved && state.errors === 0 && state.hintLevel === 0,
    stars,
    hints: state.hintLevel,
    errors: state.errors,
    moves: state.moves,
    durationMs,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });
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
 * `resumeStep` and saves progress.
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
  if (state.solved && stars !== 0) {
    if (standsInFor !== undefined) {
      progress = recordExerciseStars(progress, standsInFor, EASIER_VARIANT_STARS, lesson, now);
    } else if (scored) {
      progress = recordExerciseStars(progress, state.def.id, stars, lesson, now);
    }
  }
  progress = withResumeStep(progress, nextStep, now);
  await deps.progress.saveLesson(progress);
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

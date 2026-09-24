import type { ExerciseState } from '../domain/exercise/engine.ts';
import { starsFor } from '../domain/exercise/engine.ts';
import type { GameState } from '../domain/exercise/minigame.ts';
import { gameStars } from '../domain/exercise/minigame.ts';
import type { Lesson } from '../domain/lesson.ts';
import type { Profile } from '../domain/profile.ts';
import type { LessonProgress } from '../domain/progress.ts';
import {
  newLessonProgress,
  recordBossStars,
  recordExerciseStars,
  withResumeStep,
} from '../domain/progress.ts';
import type { ContentSource, IdGenerator, ProfileRepository, ProgressRepository } from './ports.ts';
import type { Clock } from './ports.ts';

/** Everything a use case needs, gathered in one place so call sites pass a single `deps` object. */
export interface AppDeps {
  readonly profiles: ProfileRepository;
  readonly progress: ProgressRepository;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly content: ContentSource;
}

/** First stored profile, or a fresh local one (M1 has exactly one profile per device). */
export async function ensureProfile(deps: AppDeps): Promise<Profile> {
  const [first] = await deps.profiles.list();
  if (first !== undefined) {
    return first;
  }
  const now = deps.clock.now().toISOString();
  const profile: Profile = {
    id: deps.ids.next(),
    accountId: 'local',
    nickname: 'Player',
    avatar: 'fox',
    locale: 'en',
    createdAt: now,
    updatedAt: now,
  };
  await deps.profiles.save(profile);
  return profile;
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
}

/**
 * Records an exercise attempt: always saves an `Attempt`; when `scored` and solved, also updates
 * the lesson's best stars for that exercise. Always advances `resumeStep` and saves progress.
 */
export async function recordExerciseResult(
  deps: AppDeps,
  input: RecordExerciseResultInput,
): Promise<LessonProgress> {
  const { profileId, lesson, state, scored, durationMs, nextStep } = input;
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

  let progress = await getLessonProgress(deps, profileId, lesson.id);
  if (scored && state.solved && stars !== 0) {
    progress = recordExerciseStars(progress, state.def.id, stars, lesson, now);
  }
  progress = withResumeStep(progress, nextStep, now);
  await deps.progress.saveLesson(progress);
  return progress;
}

/** Result of playing a lesson's boss mini-game. */
export interface RecordBossResultInput {
  readonly profileId: string;
  readonly lesson: Lesson;
  readonly state: GameState;
  readonly durationMs: number;
  /** Step index to resume at next (see `lessonSteps`). */
  readonly nextStep: number;
}

/**
 * Records a boss mini-game attempt: always saves an `Attempt` (bosses are always scored), updates
 * the lesson's best boss stars, advances `resumeStep`, and saves progress.
 */
export async function recordBossResult(
  deps: AppDeps,
  input: RecordBossResultInput,
): Promise<LessonProgress> {
  const { profileId, lesson, state, durationMs, nextStep } = input;
  const now = deps.clock.now();
  const stars = gameStars(state);
  const { exercise } = state;

  await deps.progress.addAttempt({
    id: deps.ids.next(),
    profileId,
    lessonId: lesson.id,
    exerciseId: state.def.id,
    conceptId: state.def.concept,
    scored: true,
    correct: exercise.solved && exercise.errors === 0 && exercise.hintLevel === 0,
    stars,
    hints: exercise.hintLevel,
    errors: exercise.errors,
    moves: exercise.moves,
    durationMs,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });

  let progress = await getLessonProgress(deps, profileId, lesson.id);
  progress = recordBossStars(progress, stars, now);
  progress = withResumeStep(progress, nextStep, now);
  await deps.progress.saveLesson(progress);
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

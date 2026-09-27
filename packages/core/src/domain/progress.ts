import type { Lesson } from './lesson.ts';
import type { SkippablePhase } from './lesson-session.ts';
import type { StoredRecord } from './profile.ts';

/** Star rating shown to the kid: `0` = not solved yet. */
export type Stars = 0 | 1 | 2 | 3;

/** How a lesson reached `mastered`: `'test-out'`/`'placement'` passed an assessment; `'parent'` is
 * a direct unlock. Absent (or `'play'`, never actually stored) means the ordinary `bestStars` path. */
export type MasteredVia = 'play' | 'test-out' | 'placement' | 'parent';

/** One profile's saved progress on one lesson. */
export interface LessonProgress extends StoredRecord {
  readonly profileId: string;
  readonly lessonId: string;
  /** Best stars per scored exercise id (guided tries are not scored). */
  readonly bestStars: Readonly<Record<string, 1 | 2 | 3>>;
  /** Best stars on the lesson's boss mini-game; `0` if never played. */
  readonly bossStars: Stars;
  /** Index into `lessonSteps(...)` where the kid resumes; `0` = story. */
  readonly resumeStep: number;
  /** First time every exercise had ≥ 1 star. */
  readonly completedAt?: string;
  /** Set by a passed test-out/placement or a parent unlock; see {@link MasteredVia}. */
  readonly masteredVia?: MasteredVia;
  /** Story/Demo/Try phases the kid tapped "Skip" past; absent = none. Removed the next time the
   * phase is completed normally instead — see `withSkippedPhase`/`withoutSkippedPhase`. */
  readonly skippedPhases?: readonly SkippablePhase[];
}

/** One recorded try at an exercise or mini-game, scored or not. */
export interface Attempt extends StoredRecord {
  readonly profileId: string;
  readonly lessonId: string;
  readonly exerciseId: string;
  readonly conceptId: string;
  /** `false` for guided tries and the demo: not counted towards mastery. */
  readonly scored: boolean;
  /** `true` for a warm-up/practice review task; absent/`false` for a lesson exercise or mini-game. */
  readonly review?: boolean;
  /** Set alongside `review`: which screen the task came from — Today's inline warm-up / Practice's
   * "Daily warm-up" card (`'warmup'`), or a Practice topic run (`'practice'`). */
  readonly reviewSource?: 'warmup' | 'practice';
  /** First-try correct: solved with no error and no hint. */
  readonly correct: boolean;
  readonly stars: Stars;
  readonly hints: number;
  readonly errors: number;
  readonly moves: number;
  readonly durationMs: number;
}

export type LessonStatus = 'new' | 'in-progress' | 'complete' | 'mastered';

/** Fresh, unsaved progress for a profile starting a lesson. */
export function newLessonProgress(
  id: string,
  profileId: string,
  lessonId: string,
  now: Date,
): LessonProgress {
  const nowIso = now.toISOString();
  return {
    id,
    profileId,
    lessonId,
    bestStars: {},
    bossStars: 0,
    resumeStep: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/** True once every exercise in `lesson` has ≥ 1 best star recorded in `bestStars`. */
function isLessonComplete(lesson: Lesson, bestStars: Readonly<Record<string, 1 | 2 | 3>>): boolean {
  return lesson.exercises.every((exercise) => (bestStars[exercise.id] ?? 0) >= 1);
}

/**
 * Records `stars` for `exerciseId`, keeping the previous best if it was higher. Sets
 * `completedAt` the first time this makes every exercise in `lesson` ≥ 1 star.
 */
export function recordExerciseStars(
  progress: LessonProgress,
  exerciseId: string,
  stars: 1 | 2 | 3,
  lesson: Lesson,
  now: Date,
): LessonProgress {
  const previous = progress.bestStars[exerciseId] ?? 0;
  const bestStars =
    stars > previous ? { ...progress.bestStars, [exerciseId]: stars } : progress.bestStars;
  const completedAt =
    progress.completedAt ?? (isLessonComplete(lesson, bestStars) ? now.toISOString() : undefined);
  return {
    ...progress,
    bestStars,
    updatedAt: now.toISOString(),
    ...(completedAt === undefined ? {} : { completedAt }),
  };
}

/** Records boss mini-game stars, keeping the previous best if it was higher. */
export function recordBossStars(progress: LessonProgress, stars: Stars, now: Date): LessonProgress {
  const bossStars = stars > progress.bossStars ? stars : progress.bossStars;
  return { ...progress, bossStars, updatedAt: now.toISOString() };
}

/** Moves the resume point (index into `lessonSteps(...)`). */
export function withResumeStep(progress: LessonProgress, step: number, now: Date): LessonProgress {
  return { ...progress, resumeStep: step, updatedAt: now.toISOString() };
}

/** Adds `phase` to `skippedPhases` (no duplicate) — the kid tapped "Skip". A no-op (same object)
 * if already marked. */
export function withSkippedPhase(
  progress: LessonProgress,
  phase: SkippablePhase,
  now: Date,
): LessonProgress {
  const existing = progress.skippedPhases ?? [];
  if (existing.includes(phase)) {
    return progress;
  }
  return { ...progress, skippedPhases: [...existing, phase], updatedAt: now.toISOString() };
}

/** Removes `phase` from `skippedPhases`, if present — `phase` was just completed normally
 * (not skipped), e.g. a "Play again" replay playing it through this time. A no-op (same object)
 * if it was not marked. */
export function withoutSkippedPhase(
  progress: LessonProgress,
  phase: SkippablePhase,
  now: Date,
): LessonProgress {
  if (progress.skippedPhases === undefined || !progress.skippedPhases.includes(phase)) {
    return progress;
  }
  const skippedPhases = progress.skippedPhases.filter((entry) => entry !== phase);
  return { ...progress, skippedPhases, updatedAt: now.toISOString() };
}

/** `new` without progress; `mastered` when best-stars sum is ≥ 80% of the 3-star max, or
 * `masteredVia` is a non-`'play'` value; `complete` when every exercise has ≥ 1 star; else `in-progress`. */
export function lessonStatus(lesson: Lesson, progress?: LessonProgress): LessonStatus {
  if (progress === undefined) {
    return 'new';
  }
  if (progress.masteredVia !== undefined && progress.masteredVia !== 'play') {
    return 'mastered';
  }
  const max = 3 * lesson.exercises.length;
  const earned = lesson.exercises.reduce(
    (sum, exercise) => sum + (progress.bestStars[exercise.id] ?? 0),
    0,
  );
  if (max > 0 && earned >= 0.8 * max) {
    return 'mastered';
  }
  return isLessonComplete(lesson, progress.bestStars) ? 'complete' : 'in-progress';
}

/** Stars earned vs. the maximum for a lesson: exercises, plus the boss when the lesson has one. */
export function lessonStars(
  lesson: Lesson,
  progress?: LessonProgress,
): { earned: number; max: number } {
  const exerciseMax = 3 * lesson.exercises.length;
  const bossMax = lesson.boss === undefined ? 0 : 3;
  const exerciseEarned = lesson.exercises.reduce(
    (sum, exercise) => sum + (progress?.bestStars[exercise.id] ?? 0),
    0,
  );
  const bossEarned = lesson.boss === undefined ? 0 : (progress?.bossStars ?? 0);
  return { earned: exerciseEarned + bossEarned, max: exerciseMax + bossMax };
}

/** Total stars (exercises + boss) across every given lesson progress. */
export function totalStars(progresses: readonly LessonProgress[]): number {
  return progresses.reduce((sum, progress) => {
    const exerciseStars = Object.values(progress.bestStars).reduce(
      (s: number, stars) => s + stars,
      0,
    );
    return sum + exerciseStars + progress.bossStars;
  }, 0);
}

/** One profile's saved progress on one mini-game, played from the Play screen. Kept separate from
 * `LessonProgress.bossStars`; a boss win also updates this record (`recordBossResult`). */
export interface MiniGameProgress extends StoredRecord {
  readonly profileId: string;
  readonly miniGameId: string;
  readonly bestStars: Stars;
  /** Times played, from the Play screen or as a lesson boss. */
  readonly plays: number;
  /** Times ended in a win (a finished `series` mini-game always counts, it has no losing state). */
  readonly wins: number;
}

/** Outcome of one finished (or left) game vs the computer or a friend, from the kid's side. */
export type GameRecordResult = 'win' | 'loss' | 'draw' | 'abandoned';

/** One played (or abandoned) game vs the computer or a friend (same device). Saved for a full game
 * (`game: 'full'`) and every `versus` mini-game, standalone or as a lesson boss. */
export interface GameRecord extends StoredRecord {
  readonly profileId: string;
  /** `'full'` for a full standard game, else the `versus` mini-game's content id (Pawn Wars, …). */
  readonly game: string;
  /** `computer:<level>` vs the computer; `profile:<id>` / `guest` vs a friend (same device). */
  readonly opponent: string;
  readonly result: GameRecordResult;
  /** A `GameResult.reason` (checkmate, stalemate, threefold-repetition, fifty-move, …), or `left` when abandoned. */
  readonly reason: string;
  /** SAN moves played, in order (both sides). */
  readonly moves: readonly string[];
  /** Colour this profile played; absent = White (every game vs the computer in v1). */
  readonly color?: 'w' | 'b';
}

/** Folds one more play into `existing` (or starts a fresh record): keeps the higher `bestStars`,
 * bumps `plays` (+ `wins` when `won`). */
export function recordMiniGamePlay(
  existing: MiniGameProgress | undefined,
  id: string,
  profileId: string,
  miniGameId: string,
  stars: Stars,
  won: boolean,
  now: Date,
): MiniGameProgress {
  const nowIso = now.toISOString();
  const bestStars = Math.max(existing?.bestStars ?? 0, stars) as Stars;
  return {
    id: existing?.id ?? id,
    profileId,
    miniGameId,
    bestStars,
    plays: (existing?.plays ?? 0) + 1,
    wins: (existing?.wins ?? 0) + (won ? 1 : 0),
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
  };
}

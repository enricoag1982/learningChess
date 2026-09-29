import type { TracksCatalog, World } from './journey.ts';
import { worldLessons } from './journey.ts';
import type { Lesson } from './lesson.ts';
import type { StoredRecord } from './profile.ts';
import type { Random } from './random.ts';
import { shuffle } from './random.ts';
import type { ConceptTask } from './review.ts';
import type { ExerciseDefBase } from './subject.ts';

/** `'test-out'`: the kid taps a locked lesson or world. `'placement'`: offered once after creating a player. */
export type AssessmentKind = 'test-out' | 'placement';

/** One locked lesson (`worldId` = its world, for the UI's return panel) or a whole world (test-out or one placement world). */
export type AssessmentScope =
  | { readonly type: 'lesson'; readonly lessonId: string; readonly worldId: string }
  | { readonly type: 'world'; readonly worldId: string };

export const TEST_OUT_LESSON_TASKS = 5;
export const TEST_OUT_WORLD_TASKS = 8;
export const PLACEMENT_TASKS_PER_WORLD = 4;

function poolOf<E extends ExerciseDefBase>(lesson: Lesson<E>): readonly ConceptTask<E>[] {
  return lesson.exercises.map((exercise) => ({
    conceptId: exercise.concept,
    lessonId: lesson.id,
    exercise,
  }));
}

function samplePool<E extends ExerciseDefBase>(
  pool: readonly ConceptTask<E>[],
  count: number,
  random: Random,
): readonly ConceptTask<E>[] {
  if (count <= 0 || pool.length === 0) return [];
  return shuffle(pool, random).slice(0, Math.min(count, pool.length));
}

/** Spreads `total` task slots across lessons whose exercise-pool sizes are `sizes`: at least 1 per
 * lesson with any exercises, extra slots at random to lessons with pool room left. */
function spreadQuota(sizes: readonly number[], total: number, random: Random): readonly number[] {
  const quotas = sizes.map((size) => Math.min(1, size));
  let remaining = total - quotas.reduce((sum, quota) => sum + quota, 0);
  while (remaining > 0) {
    const candidates = quotas
      .map((quota, index) => ({ index, room: (sizes[index] ?? 0) - quota }))
      .filter((candidate) => candidate.room > 0);
    if (candidates.length === 0) break;
    const pick = candidates[Math.floor(random.next() * candidates.length)];
    if (pick === undefined) break;
    quotas[pick.index] = (quotas[pick.index] ?? 0) + 1;
    remaining -= 1;
  }
  return quotas;
}

export function planTestOutLesson<E extends ExerciseDefBase>(
  lesson: Lesson<E>,
  random: Random,
): readonly ConceptTask<E>[] {
  return samplePool(poolOf(lesson), TEST_OUT_LESSON_TASKS, random);
}

/** At least 1 task per lesson that has exercises; see `spreadQuota`. */
export function planTestOutWorld<E extends ExerciseDefBase>(
  world: World,
  lessons: readonly Lesson<E>[],
  random: Random,
): readonly ConceptTask<E>[] {
  const worldLessonsList = worldLessons(world, lessons);
  if (worldLessonsList.length === 0) return [];
  const quotas = spreadQuota(
    worldLessonsList.map((lesson) => lesson.exercises.length),
    TEST_OUT_WORLD_TASKS,
    random,
  );
  return worldLessonsList.flatMap((lesson, index) =>
    samplePool(poolOf(lesson), quotas[index] ?? 0, random),
  );
}

export interface PlacementWorldPlan<E extends ExerciseDefBase = ExerciseDefBase> {
  readonly world: World;
  readonly tasks: readonly ConceptTask<E>[];
}

/** One run per Basics world, in order; skips worlds without lessons; `[]` without a main track. */
export function planPlacement<E extends ExerciseDefBase>(
  catalog: TracksCatalog,
  lessons: readonly Lesson<E>[],
  random: Random,
): readonly PlacementWorldPlan<E>[] {
  const mainTrack = catalog.tracks.find((track) => track.kind === 'main');
  if (mainTrack === undefined) return [];
  const sortedWorlds = [...mainTrack.worlds].sort((a, b) => a.order - b.order);
  const plans: PlacementWorldPlan<E>[] = [];
  for (const world of sortedWorlds) {
    const worldLessonsList = worldLessons(world, lessons);
    if (worldLessonsList.length === 0) continue;
    const pool = worldLessonsList.flatMap(poolOf);
    plans.push({ world, tasks: samplePool(pool, PLACEMENT_TASKS_PER_WORLD, random) });
  }
  return plans;
}

export interface AssessmentScore {
  readonly correct: number;
  readonly total: number;
  readonly passed: boolean;
}

/** Test-out pass mark: ≥ 80% correct, rounded up (lesson 4/5, world 7/8). */
export function scoreTestOut(results: readonly boolean[]): AssessmentScore {
  const total = results.length;
  const correct = results.filter(Boolean).length;
  return { correct, total, passed: total > 0 && correct >= Math.ceil(total * 0.8) };
}

/** Placement pass mark per world: ≥ 3/4 (75%, rounded up). */
export function scorePlacementWorld(results: readonly boolean[]): AssessmentScore {
  const total = results.length;
  const correct = results.filter(Boolean).length;
  return { correct, total, passed: total > 0 && correct >= Math.ceil(total * 0.75) };
}

/** Kept for the parent report; placement stores one row per world attempted. */
export interface AssessmentResult extends StoredRecord {
  readonly profileId: string;
  readonly kind: AssessmentKind;
  readonly scope: AssessmentScope;
  readonly correct: number;
  readonly total: number;
  readonly passed: boolean;
  readonly at: string;
}

export function newAssessmentResult(
  id: string,
  profileId: string,
  kind: AssessmentKind,
  scope: AssessmentScope,
  score: AssessmentScore,
  now: Date,
): AssessmentResult {
  const nowIso = now.toISOString();
  return {
    id,
    profileId,
    kind,
    scope,
    correct: score.correct,
    total: score.total,
    passed: score.passed,
    at: nowIso,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/** A lesson/world unlocked out of order (test-out, placement or parent); `targetId`s feed `journey.ts`'s `unlocked`. */
export interface Unlock extends StoredRecord {
  readonly profileId: string;
  readonly targetType: 'lesson' | 'world';
  readonly targetId: string;
  readonly via: 'test-out' | 'placement' | 'parent';
}

export function newUnlock(
  id: string,
  profileId: string,
  targetType: 'lesson' | 'world',
  targetId: string,
  via: Unlock['via'],
  now: Date,
): Unlock {
  const nowIso = now.toISOString();
  return { id, profileId, targetType, targetId, via, createdAt: nowIso, updatedAt: nowIso };
}

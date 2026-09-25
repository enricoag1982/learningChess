import type { TracksCatalog, World } from './journey.ts';
import { worldLessons } from './journey.ts';
import type { Lesson } from './lesson.ts';
import type { StoredRecord } from './profile.ts';
import type { Random } from './random.ts';
import type { ConceptTask } from './review.ts';

/**
 * Test-out / placement (domain-model.md §3.2). `'test-out'`: the kid taps a locked lesson or world
 * on the Journey. `'placement'`: offered once after creating a new player, one run per Basics world
 * in order.
 */
export type AssessmentKind = 'test-out' | 'placement';

/**
 * What one assessment run covers: one locked lesson (`worldId` is that lesson's world, kept
 * alongside for the UI — which world panel to return to), or a whole world (test-out of a locked
 * world, or one placement world).
 */
export type AssessmentScope =
  | { readonly type: 'lesson'; readonly lessonId: string; readonly worldId: string }
  | { readonly type: 'world'; readonly worldId: string };

/** Lesson test-out: this many tasks, all from that lesson's own scored exercises. */
export const TEST_OUT_LESSON_TASKS = 5;
/** World test-out: this many tasks, spread over the world's lessons (≥ 1 per lesson where possible). */
export const TEST_OUT_WORLD_TASKS = 8;
/** Placement: this many tasks per Basics world. */
export const PLACEMENT_TASKS_PER_WORLD = 4;

/** Deterministic Fisher–Yates shuffle driven by `random` (mutates nothing; returns a new array). */
function shuffle<T>(items: readonly T[], random: Random): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random.next() * (i + 1));
    const a = shuffled[i];
    const b = shuffled[j];
    if (a !== undefined && b !== undefined) {
      shuffled[i] = b;
      shuffled[j] = a;
    }
  }
  return shuffled;
}

/** One task per lesson exercise, for sampling into an assessment run. */
function poolOf(lesson: Lesson): readonly ConceptTask[] {
  return lesson.exercises.map((exercise) => ({
    conceptId: exercise.concept,
    lessonId: lesson.id,
    exercise,
  }));
}

/** `count` tasks picked at random from `pool` (no repeats); every task in `pool` when it has fewer. */
function samplePool(
  pool: readonly ConceptTask[],
  count: number,
  random: Random,
): readonly ConceptTask[] {
  if (count <= 0 || pool.length === 0) return [];
  return shuffle(pool, random).slice(0, Math.min(count, pool.length));
}

/**
 * Spreads `total` task slots across lessons whose exercise-pool sizes are `sizes`, one array index
 * per lesson: at least 1 per lesson with any exercises (world test-out's "≥ 1 per lesson"), extra
 * slots handed out at random to lessons with pool room left — stops early if `total` exceeds what
 * every lesson's own pool can hold. Same length/order as `sizes`.
 */
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

/** Plans a lesson test-out (domain-model.md §3.2): up to {@link TEST_OUT_LESSON_TASKS} tasks from
 * `lesson`'s own scored exercises, picked with `random`. */
export function planTestOutLesson(lesson: Lesson, random: Random): readonly ConceptTask[] {
  return samplePool(poolOf(lesson), TEST_OUT_LESSON_TASKS, random);
}

/** Plans a world test-out (domain-model.md §3.2): up to {@link TEST_OUT_WORLD_TASKS} tasks spread
 * over every lesson of `world` (≥ 1 each where the lesson has exercises), picked with `random`. */
export function planTestOutWorld(
  world: World,
  lessons: readonly Lesson[],
  random: Random,
): readonly ConceptTask[] {
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

/** One Basics world's placement run: its {@link PLACEMENT_TASKS_PER_WORLD} tasks. */
export interface PlacementWorldPlan {
  readonly world: World;
  readonly tasks: readonly ConceptTask[];
}

/**
 * Plans the whole placement test (domain-model.md §3.2): one run per Basics world, in order,
 * `PLACEMENT_TASKS_PER_WORLD` tasks each, sampled from that world's lessons' scored exercises. Skips
 * a `coming-soon` Basics world (no authored lessons yet) — none exist as of M4.5, but this keeps the
 * planner from crashing if content is ever authored out of order. `[]` when the catalog has no main
 * (Basics) track.
 */
export function planPlacement(
  catalog: TracksCatalog,
  lessons: readonly Lesson[],
  random: Random,
): readonly PlacementWorldPlan[] {
  const mainTrack = catalog.tracks.find((track) => track.kind === 'main');
  if (mainTrack === undefined) return [];
  const sortedWorlds = [...mainTrack.worlds].sort((a, b) => a.order - b.order);
  const plans: PlacementWorldPlan[] = [];
  for (const world of sortedWorlds) {
    const worldLessonsList = worldLessons(world, lessons);
    if (worldLessonsList.length === 0) continue;
    const pool = worldLessonsList.flatMap(poolOf);
    plans.push({ world, tasks: samplePool(pool, PLACEMENT_TASKS_PER_WORLD, random) });
  }
  return plans;
}

/** One assessment run's score. */
export interface AssessmentScore {
  readonly correct: number;
  readonly total: number;
  readonly passed: boolean;
}

/** Test-out pass mark (domain-model.md §3.2): ≥ 80% correct, rounded up (lesson 4/5, world 7/8). */
export function scoreTestOut(results: readonly boolean[]): AssessmentScore {
  const total = results.length;
  const correct = results.filter(Boolean).length;
  return { correct, total, passed: total > 0 && correct >= Math.ceil(total * 0.8) };
}

/** Placement pass mark per world (domain-model.md §3.2): ≥ 3/4 (75%, rounded up). */
export function scorePlacementWorld(results: readonly boolean[]): AssessmentScore {
  const total = results.length;
  const correct = results.filter(Boolean).length;
  return { correct, total, passed: total > 0 && correct >= Math.ceil(total * 0.75) };
}

/**
 * One taken assessment's result (domain-model.md §2 `Assessment`, §3.2), kept for the parent report.
 * Placement stores one row per world attempted, `scope: { type: 'world', worldId }`.
 */
export interface AssessmentResult extends StoredRecord {
  readonly profileId: string;
  readonly kind: AssessmentKind;
  readonly scope: AssessmentScope;
  readonly correct: number;
  readonly total: number;
  readonly passed: boolean;
  readonly at: string;
}

/** Fresh `AssessmentResult` for `score`, ready to persist. */
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

/**
 * One lesson/world unlocked out of the normal Journey order (domain-model.md §3.2 "the scope's ids
 * join the unlocked set"): a passed test-out/placement, or a direct parent unlock. Read back as
 * `journey.ts`'s `unlocked` parameter (`targetId`s only — `targetType` is for display/bookkeeping).
 */
export interface Unlock extends StoredRecord {
  readonly profileId: string;
  readonly targetType: 'lesson' | 'world';
  readonly targetId: string;
  readonly via: 'test-out' | 'placement' | 'parent';
}

/** Fresh `Unlock` row, ready to persist. */
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

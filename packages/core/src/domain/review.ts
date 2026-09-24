import type { Lesson } from './lesson.ts';
import type { ExerciseDef } from './exercise/types.ts';
import type { StoredRecord } from './profile.ts';
import type { Random } from './random.ts';

/** Review box 1–5 (Leitner), or absent = the concept has not entered review yet. */
export type ReviewBox = 1 | 2 | 3 | 4 | 5;

/**
 * One profile's mastery + review state for one concept (domain-model.md §2, §3.1). `recent` holds
 * up to the last 10 first-try results (`true` = correct), newest last. `box`/`dueAt` are both unset
 * until the concept first enters review (`enterReview`); `lastExerciseId` is the last task shown for
 * this concept, from a lesson exercise or a review task, so the picker can avoid repeating it.
 */
export interface ConceptStats extends StoredRecord {
  readonly profileId: string;
  readonly conceptId: string;
  readonly recent: readonly boolean[];
  readonly box?: ReviewBox;
  /** ISO timestamp; set together with `box`. */
  readonly dueAt?: string;
  readonly lastExerciseId?: string;
}

/** Fresh, unsaved stats for a profile + concept with no attempts yet. */
export function newConceptStats(
  id: string,
  profileId: string,
  conceptId: string,
  now: Date,
): ConceptStats {
  const nowIso = now.toISOString();
  return { id, profileId, conceptId, recent: [], createdAt: nowIso, updatedAt: nowIso };
}

/** `recent` keeps at most this many results (domain-model.md §2). */
const RECENT_MAX = 10;

/** Appends one first-try result to `recent` (newest last), dropping the oldest past 10. */
export function appendResult(stats: ConceptStats, correct: boolean, now: Date): ConceptStats {
  const recent = [...stats.recent, correct].slice(-RECENT_MAX);
  return { ...stats, recent, updatedAt: now.toISOString() };
}

/** First-try correct ratio over `recent`; `0` with no results yet. */
export function accuracy(stats: ConceptStats): number {
  if (stats.recent.length === 0) {
    return 0;
  }
  return stats.recent.filter(Boolean).length / stats.recent.length;
}

/** Weak concept (domain-model.md §3): at least 3 results and accuracy below 60%. */
export function isWeak(stats: ConceptStats): boolean {
  return stats.recent.length >= 3 && accuracy(stats) < 0.6;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Puts `stats` into review (domain-model.md §3.1, §3.4): box 1, due in 1 day, or due immediately
 * (`immediate`) when the kid needed the easier variant / answered a scored exercise wrong. A
 * concept already in review only moves when `immediate` — a lesson completing again (`immediate:
 * false`) must never push a due date further out than one already earned by an earlier failure.
 */
export function enterReview(stats: ConceptStats, now: Date, immediate: boolean): ConceptStats {
  if (stats.box !== undefined && !immediate) {
    return stats;
  }
  const dueAt = (immediate ? now : addDays(now, 1)).toISOString();
  return { ...stats, box: 1, dueAt, updatedAt: now.toISOString() };
}

/** Review interval by box (domain-model.md §3.1): 1→1 day … 5→16 days. */
const REVIEW_INTERVAL_DAYS: Readonly<Record<ReviewBox, number>> = {
  1: 1,
  2: 2,
  3: 4,
  4: 8,
  5: 16,
};

/**
 * Applies a warm-up/practice review task's result (domain-model.md §3.1): correct (first try, no
 * hint) moves the box up (max 5); anything else resets it to box 1. Always reschedules `dueAt` and
 * remembers `exerciseId` as the last one shown for this concept.
 */
export function applyReviewResult(
  stats: ConceptStats,
  correct: boolean,
  exerciseId: string,
  now: Date,
): ConceptStats {
  const currentBox = stats.box ?? 1;
  const box = (correct ? Math.min(5, currentBox + 1) : 1) as ReviewBox;
  const dueAt = addDays(now, REVIEW_INTERVAL_DAYS[box]).toISOString();
  return { ...stats, box, dueAt, lastExerciseId: exerciseId, updatedAt: now.toISOString() };
}

/** True once `stats` is in review and its `dueAt` has passed (or is now). */
export function isDue(stats: ConceptStats, now: Date): boolean {
  return stats.box !== undefined && stats.dueAt !== undefined && stats.dueAt <= now.toISOString();
}

/** One lesson exercise available for a concept's review pool, alongside the lesson it belongs to. */
export interface ConceptPoolEntry {
  readonly lessonId: string;
  readonly exercise: ExerciseDef;
}

/**
 * `conceptId`'s scored exercise pool (domain-model.md §3.1 "task source"): every scored exercise
 * (never a guided try or an easier variant) of every lesson whose exercise concept matches, across
 * the whole curriculum — not only the lesson that first taught it.
 */
export function conceptPool(
  lessons: readonly Lesson[],
  conceptId: string,
): readonly ConceptPoolEntry[] {
  return lessons.flatMap((lesson) =>
    lesson.exercises
      .filter((exercise) => exercise.concept === conceptId)
      .map((exercise) => ({ lessonId: lesson.id, exercise })),
  );
}

/** One task picked for warm-up or practice: a concept's pool exercise, alongside its lesson id. */
export interface ConceptTask {
  readonly conceptId: string;
  readonly lessonId: string;
  readonly exercise: ExerciseDef;
}

/** Warm-up is always exactly this many tasks (or fewer when review has fewer concepts to draw on). */
const WARM_UP_SIZE = 3;

/** One random pick from `entries`, avoiding `avoidExerciseId` when another candidate exists. */
function pickOne(
  entries: readonly ConceptPoolEntry[],
  avoidExerciseId: string | undefined,
  random: Random,
): ConceptPoolEntry | undefined {
  const filtered =
    entries.length > 1 ? entries.filter((entry) => entry.exercise.id !== avoidExerciseId) : entries;
  const pool = filtered.length > 0 ? filtered : entries;
  if (pool.length === 0) {
    return undefined;
  }
  const index = Math.min(pool.length - 1, Math.floor(random.next() * pool.length));
  return pool[index];
}

/**
 * Picks the warm-up's tasks (domain-model.md §3.1): concepts in review due oldest-`dueAt`-first,
 * max 1 task per concept, up to {@link WARM_UP_SIZE}; short of that, fills with the weakest
 * concepts still in review (lowest accuracy, then oldest `dueAt`). No concept in review → `[]`.
 * `pool` gives each concept's exercise pool (see `conceptPool`), keyed by concept id.
 */
export function pickWarmUp(
  stats: readonly ConceptStats[],
  pool: ReadonlyMap<string, readonly ConceptPoolEntry[]>,
  now: Date,
  random: Random,
): readonly ConceptTask[] {
  const inReview = stats.filter((entry) => entry.box !== undefined);
  if (inReview.length === 0) {
    return [];
  }

  const nowIso = now.toISOString();
  const due = inReview
    .filter((entry) => entry.dueAt !== undefined && entry.dueAt <= nowIso)
    .sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''));

  const chosen = due.slice(0, WARM_UP_SIZE);
  if (chosen.length < WARM_UP_SIZE) {
    const chosenIds = new Set(chosen.map((entry) => entry.conceptId));
    const rest = inReview
      .filter((entry) => !chosenIds.has(entry.conceptId))
      .sort((a, b) => {
        const accuracyDiff = accuracy(a) - accuracy(b);
        return accuracyDiff !== 0 ? accuracyDiff : (a.dueAt ?? '').localeCompare(b.dueAt ?? '');
      });
    for (const entry of rest) {
      if (chosen.length >= WARM_UP_SIZE) break;
      chosen.push(entry);
    }
  }

  const tasks: ConceptTask[] = [];
  for (const entry of chosen) {
    const picked = pickOne(pool.get(entry.conceptId) ?? [], entry.lastExerciseId, random);
    if (picked !== undefined) {
      tasks.push({
        conceptId: entry.conceptId,
        lessonId: picked.lessonId,
        exercise: picked.exercise,
      });
    }
  }
  return tasks;
}

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

/**
 * Picks `count` practice tasks for one concept (Practice screen's topic run), shuffled by `random`;
 * cycles through the pool again when `count` exceeds it. Avoids opening on `lastExerciseId` when
 * another candidate exists, by moving it to the end of the shuffled order. `[]` for an empty pool.
 */
export function pickPracticeTasks(
  conceptId: string,
  pool: readonly ConceptPoolEntry[],
  lastExerciseId: string | undefined,
  count: number,
  random: Random,
): readonly ConceptTask[] {
  if (pool.length === 0) {
    return [];
  }
  const shuffled = shuffle(pool, random);
  const ordered =
    lastExerciseId !== undefined && shuffled.length > 1
      ? [
          ...shuffled.filter((entry) => entry.exercise.id !== lastExerciseId),
          ...shuffled.filter((entry) => entry.exercise.id === lastExerciseId),
        ]
      : shuffled;

  const tasks: ConceptTask[] = [];
  for (let i = 0; i < count; i += 1) {
    const entry = ordered[i % ordered.length];
    if (entry !== undefined) {
      tasks.push({ conceptId, lessonId: entry.lessonId, exercise: entry.exercise });
    }
  }
  return tasks;
}

import type { Attempt, LessonProgress, ProgressRepository } from '@chess-kids/core';
import type { LocalStore } from './local-store.ts';
import { StorageError } from './local-store.ts';

const LESSON_RECORD = 'lesson-progress';
const ATTEMPTS_RECORD = 'attempts';
/** Oldest attempts are dropped once storage holds more than this many. */
const MAX_ATTEMPTS = 2000;

function lessonKey(profileId: string, lessonId: string): string {
  return `${profileId}:${lessonId}`;
}

function isLessonProgressShape(value: unknown): value is LessonProgress {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.profileId === 'string' &&
    typeof record.lessonId === 'string' &&
    typeof record.bestStars === 'object' &&
    record.bestStars !== null
  );
}

function isLessonProgressRecord(value: unknown): value is Record<string, LessonProgress> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every(isLessonProgressShape);
}

function isAttemptShape(value: unknown): value is Attempt {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.profileId === 'string' &&
    typeof record.lessonId === 'string' &&
    typeof record.exerciseId === 'string'
  );
}

function isAttemptArray(value: unknown): value is Attempt[] {
  return Array.isArray(value) && value.every(isAttemptShape);
}

/**
 * Runs a synchronous computation and reports it as a settled promise, so a thrown `StorageError`
 * surfaces as a rejection instead of a synchronous throw (methods here have no `await` of their
 * own, so they are not declared `async`: `@typescript-eslint/require-await` would flag that).
 */
function toPromise<T>(compute: () => T): Promise<T> {
  try {
    return Promise.resolve(compute());
  } catch (error: unknown) {
    return Promise.reject<T>(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * `ProgressRepository` over one `LocalStore`: lesson progress keyed by `"<profileId>:<lessonId>"`,
 * attempts as a single capped, append-only list (newest last).
 */
export class LocalStorageProgressRepository implements ProgressRepository {
  private readonly store: LocalStore;

  constructor(store: LocalStore) {
    this.store = store;
  }

  private readLessons(): Map<string, LessonProgress> {
    const raw = this.store.read(LESSON_RECORD);
    if (raw === undefined) return new Map();
    if (!isLessonProgressRecord(raw)) {
      throw new StorageError(`Corrupt lesson progress data stored at "${LESSON_RECORD}"`);
    }
    return new Map(Object.entries(raw));
  }

  private writeLessons(lessons: ReadonlyMap<string, LessonProgress>): void {
    this.store.write(LESSON_RECORD, Object.fromEntries(lessons));
  }

  private readAttempts(): Attempt[] {
    const raw = this.store.read(ATTEMPTS_RECORD);
    if (raw === undefined) return [];
    if (!isAttemptArray(raw)) {
      throw new StorageError(`Corrupt attempt data stored at "${ATTEMPTS_RECORD}"`);
    }
    return raw;
  }

  listLessons(profileId: string): Promise<LessonProgress[]> {
    return toPromise(() =>
      [...this.readLessons().values()].filter((progress) => progress.profileId === profileId),
    );
  }

  getLesson(profileId: string, lessonId: string): Promise<LessonProgress | undefined> {
    return toPromise(() => this.readLessons().get(lessonKey(profileId, lessonId)));
  }

  saveLesson(progress: LessonProgress): Promise<void> {
    return toPromise(() => {
      const all = this.readLessons();
      all.set(lessonKey(progress.profileId, progress.lessonId), progress);
      this.writeLessons(all);
    });
  }

  addAttempt(attempt: Attempt): Promise<void> {
    return toPromise(() => {
      const all = this.readAttempts();
      all.push(attempt);
      const capped = all.length > MAX_ATTEMPTS ? all.slice(all.length - MAX_ATTEMPTS) : all;
      this.store.write(ATTEMPTS_RECORD, capped);
    });
  }

  listAttempts(profileId: string): Promise<Attempt[]> {
    return toPromise(() =>
      this.readAttempts().filter((attempt) => attempt.profileId === profileId),
    );
  }
}

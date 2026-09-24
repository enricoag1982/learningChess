import type {
  Attempt,
  ConceptStats,
  LessonProgress,
  MiniGameProgress,
  ProgressRepository,
} from '@chess-kids/core';
import type { LocalStore } from './local-store.ts';
import { StorageError } from './local-store.ts';

const LESSON_RECORD = 'lesson-progress';
const ATTEMPTS_RECORD = 'attempts';
const MINIGAME_RECORD = 'minigame-progress';
/** Concept mastery + review state (M3.4 Leitner scheduler), keyed like lesson progress. */
const CONCEPT_STATS_RECORD = 'concept-stats';
/** Oldest attempts are dropped once storage holds more than this many. */
const MAX_ATTEMPTS = 2000;

function lessonKey(profileId: string, lessonId: string): string {
  return `${profileId}:${lessonId}`;
}

function miniGameKey(profileId: string, miniGameId: string): string {
  return `${profileId}:${miniGameId}`;
}

function conceptStatsKey(profileId: string, conceptId: string): string {
  return `${profileId}:${conceptId}`;
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

function isMiniGameProgressShape(value: unknown): value is MiniGameProgress {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.profileId === 'string' &&
    typeof record.miniGameId === 'string' &&
    typeof record.bestStars === 'number'
  );
}

function isMiniGameProgressRecord(value: unknown): value is Record<string, MiniGameProgress> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every(isMiniGameProgressShape);
}

function isConceptStatsShape(value: unknown): value is ConceptStats {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.profileId === 'string' &&
    typeof record.conceptId === 'string' &&
    Array.isArray(record.recent)
  );
}

function isConceptStatsRecord(value: unknown): value is Record<string, ConceptStats> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every(isConceptStatsShape);
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

  private readMiniGames(): Map<string, MiniGameProgress> {
    const raw = this.store.read(MINIGAME_RECORD);
    if (raw === undefined) return new Map();
    if (!isMiniGameProgressRecord(raw)) {
      throw new StorageError(`Corrupt mini-game progress data stored at "${MINIGAME_RECORD}"`);
    }
    return new Map(Object.entries(raw));
  }

  private writeMiniGames(minigames: ReadonlyMap<string, MiniGameProgress>): void {
    this.store.write(MINIGAME_RECORD, Object.fromEntries(minigames));
  }

  private readConceptStats(): Map<string, ConceptStats> {
    const raw = this.store.read(CONCEPT_STATS_RECORD);
    if (raw === undefined) return new Map();
    if (!isConceptStatsRecord(raw)) {
      throw new StorageError(`Corrupt concept stats data stored at "${CONCEPT_STATS_RECORD}"`);
    }
    return new Map(Object.entries(raw));
  }

  private writeConceptStats(stats: ReadonlyMap<string, ConceptStats>): void {
    this.store.write(CONCEPT_STATS_RECORD, Object.fromEntries(stats));
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

  getMiniGame(profileId: string, miniGameId: string): Promise<MiniGameProgress | undefined> {
    return toPromise(() => this.readMiniGames().get(miniGameKey(profileId, miniGameId)));
  }

  listMiniGames(profileId: string): Promise<MiniGameProgress[]> {
    return toPromise(() =>
      [...this.readMiniGames().values()].filter((progress) => progress.profileId === profileId),
    );
  }

  saveMiniGame(progress: MiniGameProgress): Promise<void> {
    return toPromise(() => {
      const all = this.readMiniGames();
      all.set(miniGameKey(progress.profileId, progress.miniGameId), progress);
      this.writeMiniGames(all);
    });
  }

  getConceptStats(profileId: string, conceptId: string): Promise<ConceptStats | undefined> {
    return toPromise(() => this.readConceptStats().get(conceptStatsKey(profileId, conceptId)));
  }

  listConceptStats(profileId: string): Promise<ConceptStats[]> {
    return toPromise(() =>
      [...this.readConceptStats().values()].filter((stats) => stats.profileId === profileId),
    );
  }

  saveConceptStats(stats: ConceptStats): Promise<void> {
    return toPromise(() => {
      const all = this.readConceptStats();
      all.set(conceptStatsKey(stats.profileId, stats.conceptId), stats);
      this.writeConceptStats(all);
    });
  }

  deleteProfileData(profileId: string): Promise<void> {
    return toPromise(() => {
      const lessons = this.readLessons();
      for (const [key, progress] of lessons) {
        if (progress.profileId === profileId) lessons.delete(key);
      }
      this.writeLessons(lessons);

      const attempts = this.readAttempts().filter((attempt) => attempt.profileId !== profileId);
      this.store.write(ATTEMPTS_RECORD, attempts);

      const minigames = this.readMiniGames();
      for (const [key, progress] of minigames) {
        if (progress.profileId === profileId) minigames.delete(key);
      }
      this.writeMiniGames(minigames);

      const conceptStats = this.readConceptStats();
      for (const [key, stats] of conceptStats) {
        if (stats.profileId === profileId) conceptStats.delete(key);
      }
      this.writeConceptStats(conceptStats);
    });
  }
}

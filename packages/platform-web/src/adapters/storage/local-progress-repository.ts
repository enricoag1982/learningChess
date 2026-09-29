import type {
  Attempt,
  ConceptStats,
  LessonProgress,
  MiniGameProgress,
  ProgressRepository,
} from '@learn/platform-core';
import type { CappedList, KeyedCollection } from './collections.ts';
import { cappedList, keyedCollection, shapeGuard } from './collections.ts';
import type { LocalStore } from './local-store.ts';
import { STORAGE_KEYS } from './storage-keys.ts';

/** Oldest attempts are dropped once storage holds more than this many (also used by the importer's
 * merge, so an import lands in exactly the state ordinary play would have produced). */
export const MAX_ATTEMPTS = 2000;

function lessonKey(profileId: string, lessonId: string): string {
  return `${profileId}:${lessonId}`;
}

function miniGameKey(profileId: string, miniGameId: string): string {
  return `${profileId}:${miniGameId}`;
}

function conceptStatsKey(profileId: string, conceptId: string): string {
  return `${profileId}:${conceptId}`;
}

const isLessonProgressShape = shapeGuard<LessonProgress>({
  string: ['id', 'profileId', 'lessonId'],
  object: ['bestStars'],
});

const isAttemptShape = shapeGuard<Attempt>({
  string: ['id', 'profileId', 'lessonId', 'exerciseId'],
});

const isMiniGameProgressShape = shapeGuard<MiniGameProgress>({
  string: ['id', 'profileId', 'miniGameId'],
  number: ['bestStars'],
});

const isConceptStatsShape = shapeGuard<ConceptStats>({
  string: ['id', 'profileId', 'conceptId'],
  array: ['recent'],
});

export class LocalStorageProgressRepository implements ProgressRepository {
  private readonly lessons: KeyedCollection<LessonProgress>;
  private readonly attempts: CappedList<Attempt>;
  private readonly minigames: KeyedCollection<MiniGameProgress>;
  private readonly conceptStats: KeyedCollection<ConceptStats>;

  constructor(store: LocalStore) {
    this.lessons = keyedCollection(
      store,
      STORAGE_KEYS.lessonProgress,
      (progress) => lessonKey(progress.profileId, progress.lessonId),
      isLessonProgressShape,
    );
    this.attempts = cappedList(store, STORAGE_KEYS.attempts, MAX_ATTEMPTS, isAttemptShape);
    this.minigames = keyedCollection(
      store,
      STORAGE_KEYS.minigameProgress,
      (progress) => miniGameKey(progress.profileId, progress.miniGameId),
      isMiniGameProgressShape,
    );
    this.conceptStats = keyedCollection(
      store,
      STORAGE_KEYS.conceptStats,
      (stats) => conceptStatsKey(stats.profileId, stats.conceptId),
      isConceptStatsShape,
    );
  }

  listLessons(profileId: string): Promise<LessonProgress[]> {
    return this.lessons.list((progress) => progress.profileId === profileId);
  }

  getLesson(profileId: string, lessonId: string): Promise<LessonProgress | undefined> {
    return this.lessons.get(lessonKey(profileId, lessonId));
  }

  saveLesson(progress: LessonProgress): Promise<void> {
    return this.lessons.put(progress);
  }

  addAttempt(attempt: Attempt): Promise<void> {
    return this.attempts.add(attempt);
  }

  listAttempts(profileId: string): Promise<Attempt[]> {
    return this.attempts.list((attempt) => attempt.profileId === profileId);
  }

  getMiniGame(profileId: string, miniGameId: string): Promise<MiniGameProgress | undefined> {
    return this.minigames.get(miniGameKey(profileId, miniGameId));
  }

  listMiniGames(profileId: string): Promise<MiniGameProgress[]> {
    return this.minigames.list((progress) => progress.profileId === profileId);
  }

  saveMiniGame(progress: MiniGameProgress): Promise<void> {
    return this.minigames.put(progress);
  }

  getConceptStats(profileId: string, conceptId: string): Promise<ConceptStats | undefined> {
    return this.conceptStats.get(conceptStatsKey(profileId, conceptId));
  }

  listConceptStats(profileId: string): Promise<ConceptStats[]> {
    return this.conceptStats.list((stats) => stats.profileId === profileId);
  }

  saveConceptStats(stats: ConceptStats): Promise<void> {
    return this.conceptStats.put(stats);
  }

  deleteProfileData(profileId: string): Promise<void> {
    return Promise.all([
      this.lessons.removeWhere((progress) => progress.profileId === profileId),
      this.attempts.removeWhere((attempt) => attempt.profileId === profileId),
      this.minigames.removeWhere((progress) => progress.profileId === profileId),
      this.conceptStats.removeWhere((stats) => stats.profileId === profileId),
    ]).then(() => undefined);
  }
}

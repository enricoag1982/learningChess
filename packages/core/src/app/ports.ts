import type { Lesson, MiniGame } from '../domain/lesson.ts';
import type { Profile } from '../domain/profile.ts';
import type { Attempt, LessonProgress } from '../domain/progress.ts';

/** Persistence of child profiles. Async so cloud adapters can replace local ones. */
export interface ProfileRepository {
  list(): Promise<Profile[]>;
  get(id: string): Promise<Profile | undefined>;
  save(profile: Profile): Promise<void>;
  delete(id: string): Promise<void>;
}

/** Persistence of lesson progress and attempts. Async so cloud adapters can replace local ones. */
export interface ProgressRepository {
  listLessons(profileId: string): Promise<LessonProgress[]>;
  getLesson(profileId: string, lessonId: string): Promise<LessonProgress | undefined>;
  saveLesson(progress: LessonProgress): Promise<void>;
  addAttempt(attempt: Attempt): Promise<void>;
  listAttempts(profileId: string): Promise<Attempt[]>;
}

/** New record ids (UUID v4). */
export interface IdGenerator {
  next(): string;
}

/** Speaks text aloud; a no-op adapter when speech is unavailable. */
export interface Narrator {
  readonly available: boolean;
  speak(text: string): Promise<void>;
  cancel(): void;
}

/** Loads compiled lesson content (built from `packages/content`). */
export interface ContentSource {
  lessons(): readonly Lesson[];
  lesson(id: string): Lesson | undefined;
  minigames(): readonly MiniGame[];
  minigame(id: string): MiniGame | undefined;
}

/** Current time; injected for deterministic tests. */
export interface Clock {
  now(): Date;
}

/** Randomness in [0, 1); seeded in tests. */
export interface Random {
  next(): number;
}

/** Online features are off in v1. */
export interface FeatureFlags {
  readonly login: boolean;
  readonly online: boolean;
}

export const v1FeatureFlags: FeatureFlags = { login: false, online: false };

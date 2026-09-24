import type { Lesson, MiniGame } from '../domain/lesson.ts';
import type { ParentLock } from '../domain/parent-lock.ts';
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
  /** Deletes every lesson-progress and attempt record for a profile (parent area "Delete"). */
  deleteProfileData(profileId: string): Promise<void>;
}

/** Persistence of the single parent gate (non-functional.md §3). One lock per device. */
export interface ParentLockRepository {
  get(): Promise<ParentLock | undefined>;
  save(lock: ParentLock): Promise<void>;
}

/** Writes the parent password somewhere the parent can find again (app-structure.md §2). */
export interface PasswordFileWriter {
  write(password: string): Promise<{ location: string }>;
}

/** Device-wide settings, not tied to one profile. */
export interface AppSettings {
  /** Profile to show first at the next app start (picker orders it first); `null` if none yet. */
  readonly lastProfileId: string | null;
}

/** Persistence of `AppSettings`. Async so cloud adapters can replace local ones. */
export interface SettingsRepository {
  get(): Promise<AppSettings>;
  save(settings: AppSettings): Promise<void>;
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

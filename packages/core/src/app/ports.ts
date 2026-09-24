import type { Move } from '../domain/chess/rules.ts';
import type { GameState } from '../domain/game/types.ts';
import type { TracksCatalog } from '../domain/journey.ts';
import type { Lesson, MiniGame } from '../domain/lesson.ts';
import type { ParentLock } from '../domain/parent-lock.ts';
import type { Profile } from '../domain/profile.ts';
import type { Attempt, GameRecord, LessonProgress, MiniGameProgress } from '../domain/progress.ts';
import type { ConceptStats } from '../domain/review.ts';

/** Persistence of child profiles. Async so cloud adapters can replace local ones. */
export interface ProfileRepository {
  list(): Promise<Profile[]>;
  get(id: string): Promise<Profile | undefined>;
  save(profile: Profile): Promise<void>;
  delete(id: string): Promise<void>;
}

/**
 * Persistence of lesson progress, attempts, and standalone mini-game progress (Play screen).
 * Async so cloud adapters can replace local ones.
 */
export interface ProgressRepository {
  listLessons(profileId: string): Promise<LessonProgress[]>;
  getLesson(profileId: string, lessonId: string): Promise<LessonProgress | undefined>;
  saveLesson(progress: LessonProgress): Promise<void>;
  addAttempt(attempt: Attempt): Promise<void>;
  listAttempts(profileId: string): Promise<Attempt[]>;
  getMiniGame(profileId: string, miniGameId: string): Promise<MiniGameProgress | undefined>;
  listMiniGames(profileId: string): Promise<MiniGameProgress[]>;
  saveMiniGame(progress: MiniGameProgress): Promise<void>;
  /** One concept's mastery + review state (M3.4 Leitner scheduler), if any attempt has touched it. */
  getConceptStats(profileId: string, conceptId: string): Promise<ConceptStats | undefined>;
  listConceptStats(profileId: string): Promise<ConceptStats[]>;
  saveConceptStats(stats: ConceptStats): Promise<void>;
  /** Deletes every lesson-progress, attempt, mini-game, and concept-stats record for a profile (parent area "Delete"). */
  deleteProfileData(profileId: string): Promise<void>;
}

/**
 * Persistence of `GameRecord` (domain-model.md §2): full games and versus mini-games, vs the
 * computer (v1) or a friend (v2). Kept separate from `ProgressRepository` — records here are an
 * append-only game log, not lesson/mastery state.
 */
export interface GameRecordRepository {
  add(record: GameRecord): Promise<void>;
  listByProfile(profileId: string): Promise<GameRecord[]>;
  /** Deletes every game record for a profile (parent area "Delete"). */
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
  /**
   * Tracks/worlds/ranks catalog (built from `packages/content/tracks.yaml`), used by
   * `loadJourney` (`app/journey.ts`). Optional so every existing `ContentSource` (real or test
   * fixture) keeps typechecking unchanged.
   * TODO(M2.5a): wire this into `apps/web/src/adapters/content/bundled-content-source.ts`
   * (`import tracks from '@chess-kids/content/tracks.json'`) and into its test fixtures.
   */
  catalog?(): TracksCatalog;
}

/** Current time; injected for deterministic tests. */
export interface Clock {
  now(): Date;
}

/** Randomness in [0, 1); seeded in tests. */
export interface Random {
  next(): number;
}

/**
 * The computer opponent for `versus` mini-games (Pawn Wars, …). Runs in a Web Worker on the web
 * (`docs/architecture.md` §2) so the search never blocks the UI thread; `level` is a `BotLevel.level`
 * (1 Mouse .. 5 Bear) and `seed` drives `domain/bot`'s deterministic `Random`, so the same position
 * + level + seed always replies with the same move. `null` only when the side to move has none.
 */
export interface BotPlayer {
  chooseMove(state: GameState, level: number, seed: number): Promise<Move | null>;
}

/** Online features are off in v1. */
export interface FeatureFlags {
  readonly login: boolean;
  readonly online: boolean;
}

export const v1FeatureFlags: FeatureFlags = { login: false, online: false };

/**
 * In-memory fakes for every port `AppDeps` needs, plus `makeDeps(overrides)` wiring the required
 * ones together with sensible defaults. `@chess-kids/core/testing` only, see `builders.ts`'s own
 * header. Optional `AppDeps` ports (`rewards`, `assessment`, `backupFileWriter`, `backupImporter`,
 * `storageSchemaVersion`) are left unset by `makeDeps` — pass them in `overrides` where a use case
 * needs them wired up.
 */
import type { BadgeDef, EarnedBadge } from '../domain/badges.ts';
import type { TracksCatalog } from '../domain/journey.ts';
import type { Lesson, MiniGame } from '../domain/lesson.ts';
import type { ParentLock } from '../domain/parent-lock.ts';
import type { Profile } from '../domain/profile.ts';
import type { Attempt, GameRecord, LessonProgress, MiniGameProgress } from '../domain/progress.ts';
import { seededRandom } from '../domain/random.ts';
import type { ConceptStats } from '../domain/review.ts';
import type { SessionLog } from '../domain/session-log.ts';
import type { Streak } from '../domain/streak.ts';
import type { AssessmentResult, Unlock } from '../domain/assessment.ts';
import type { BackupFile } from '../app/backup.ts';
import type {
  AppSettings,
  AssessmentRepository,
  BackupFileWriter,
  BackupImporter,
  Clock,
  ContentSource,
  GameRecordRepository,
  IdGenerator,
  ParentLockRepository,
  PasswordFileWriter,
  ProfileRepository,
  ProgressRepository,
  RewardsRepository,
  SettingsRepository,
} from '../app/ports.ts';
import type { AppDeps } from '../app/use-cases.ts';

export { seededRandom } from '../domain/random.ts';

/* -------------------------------------------------------------------- ContentSource -------- */

export interface ContentSourceSeed {
  readonly lessons?: readonly Lesson[];
  readonly minigames?: readonly MiniGame[];
  readonly catalog?: TracksCatalog;
  readonly badges?: readonly BadgeDef[];
}

/** In-memory `ContentSource`. `catalog`/`badges` are present on the result only when seeded —
 * both are optional on the real port, and a fixture that never wires one up should keep whatever
 * "not implemented" behaviour the production code has for it. */
export function makeContentSource(seed: ContentSourceSeed = {}): ContentSource {
  const { lessons = [], minigames = [], catalog, badges } = seed;
  const lessonsById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const minigamesById = new Map(minigames.map((game) => [game.id, game]));
  return {
    lessons: () => lessons,
    lesson: (id) => lessonsById.get(id),
    minigames: () => minigames,
    minigame: (id) => minigamesById.get(id),
    ...(catalog === undefined ? {} : { catalog: () => catalog }),
    ...(badges === undefined ? {} : { badges: () => badges }),
  };
}

/** Content-less `ContentSource`, for use cases that never touch it. */
export const stubContent: ContentSource = makeContentSource();

/* -------------------------------------------------------------------- Clock ---------------- */

export interface TestClock extends Clock {
  /** Moves the fake clock forward by `ms` (or backward, for a negative value). */
  advance(ms: number): void;
  /** Jumps the fake clock straight to a new instant. */
  set(date: Date | string): void;
}

/** Fixed `Clock`, mutable via `advance`/`set` for a test that needs time to move mid-test. */
export function makeClock(initial: Date | string = '2026-01-01T00:00:00.000Z'): TestClock {
  let current = typeof initial === 'string' ? new Date(initial) : initial;
  return {
    now: () => current,
    advance: (ms) => {
      current = new Date(current.getTime() + ms);
    },
    set: (date) => {
      current = typeof date === 'string' ? new Date(date) : date;
    },
  };
}

/* -------------------------------------------------------------------- IdGenerator ---------- */

/** Sequential ids: `${prefix}-1`, `${prefix}-2`, … */
export function makeIds(prefix = 'id'): IdGenerator {
  let count = 0;
  return {
    next: () => {
      count += 1;
      return `${prefix}-${String(count)}`;
    },
  };
}

/* -------------------------------------------------------------------- ProfileRepository ---- */

export function makeProfileRepo(initial: readonly Profile[] = []): ProfileRepository {
  const store = new Map(initial.map((profile) => [profile.id, profile]));
  return {
    list: () =>
      Promise.resolve([...store.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt))),
    get: (id) => Promise.resolve(store.get(id)),
    save: (profile) => {
      store.set(profile.id, profile);
      return Promise.resolve();
    },
    delete: (id) => {
      store.delete(id);
      return Promise.resolve();
    },
  };
}

/* -------------------------------------------------------------------- ProgressRepository --- */

export interface ProgressRepoSeed {
  readonly lessons?: readonly LessonProgress[];
  readonly miniGames?: readonly MiniGameProgress[];
  readonly conceptStats?: readonly ConceptStats[];
  readonly attempts?: readonly Attempt[];
}

export function makeProgressRepo(
  seed: ProgressRepoSeed = {},
): ProgressRepository & { readonly deletedFor: readonly string[] } {
  const key = (profileId: string, id: string): string => `${profileId}:${id}`;
  const lessons = new Map((seed.lessons ?? []).map((p) => [key(p.profileId, p.lessonId), p]));
  const miniGames = new Map((seed.miniGames ?? []).map((p) => [key(p.profileId, p.miniGameId), p]));
  const conceptStats = new Map(
    (seed.conceptStats ?? []).map((s) => [key(s.profileId, s.conceptId), s]),
  );
  const attempts: Attempt[] = [...(seed.attempts ?? [])];
  const deletedFor: string[] = [];
  return {
    listLessons: (profileId) =>
      Promise.resolve([...lessons.values()].filter((p) => p.profileId === profileId)),
    getLesson: (profileId, lessonId) => Promise.resolve(lessons.get(key(profileId, lessonId))),
    saveLesson: (progress) => {
      lessons.set(key(progress.profileId, progress.lessonId), progress);
      return Promise.resolve();
    },
    addAttempt: (attempt) => {
      attempts.push(attempt);
      return Promise.resolve();
    },
    listAttempts: (profileId) => Promise.resolve(attempts.filter((a) => a.profileId === profileId)),
    getMiniGame: (profileId, miniGameId) =>
      Promise.resolve(miniGames.get(key(profileId, miniGameId))),
    listMiniGames: (profileId) =>
      Promise.resolve([...miniGames.values()].filter((p) => p.profileId === profileId)),
    saveMiniGame: (progress) => {
      miniGames.set(key(progress.profileId, progress.miniGameId), progress);
      return Promise.resolve();
    },
    getConceptStats: (profileId, conceptId) =>
      Promise.resolve(conceptStats.get(key(profileId, conceptId))),
    listConceptStats: (profileId) =>
      Promise.resolve([...conceptStats.values()].filter((s) => s.profileId === profileId)),
    saveConceptStats: (stats) => {
      conceptStats.set(key(stats.profileId, stats.conceptId), stats);
      return Promise.resolve();
    },
    deleteProfileData: (profileId) => {
      deletedFor.push(profileId);
      for (const [k, p] of lessons) if (p.profileId === profileId) lessons.delete(k);
      for (const [k, p] of miniGames) if (p.profileId === profileId) miniGames.delete(k);
      for (const [k, s] of conceptStats) if (s.profileId === profileId) conceptStats.delete(k);
      for (let i = attempts.length - 1; i >= 0; i -= 1) {
        if (attempts[i]?.profileId === profileId) attempts.splice(i, 1);
      }
      return Promise.resolve();
    },
    deletedFor,
  };
}

/* -------------------------------------------------------------------- GameRecordRepository - */

export function makeGameRecordRepo(
  initial: readonly GameRecord[] = [],
): GameRecordRepository & { readonly deletedFor: readonly string[] } {
  const records: GameRecord[] = [...initial];
  const deletedFor: string[] = [];
  return {
    add: (record) => {
      records.push(record);
      return Promise.resolve();
    },
    listByProfile: (profileId) =>
      Promise.resolve(records.filter((record) => record.profileId === profileId)),
    deleteProfileData: (profileId) => {
      deletedFor.push(profileId);
      for (let i = records.length - 1; i >= 0; i -= 1) {
        if (records[i]?.profileId === profileId) records.splice(i, 1);
      }
      return Promise.resolve();
    },
    deletedFor,
  };
}

/* -------------------------------------------------------------------- RewardsRepository ---- */

export interface RewardsRepoSeed {
  readonly badges?: readonly EarnedBadge[];
  readonly streaks?: readonly Streak[];
  readonly sessionLogs?: readonly SessionLog[];
}

export function makeRewardsRepo(
  seed: RewardsRepoSeed = {},
): RewardsRepository & { readonly deletedFor: readonly string[] } {
  const badges: EarnedBadge[] = [...(seed.badges ?? [])];
  const streaks = new Map((seed.streaks ?? []).map((s) => [s.profileId, s]));
  const logs = new Map(
    (seed.sessionLogs ?? []).map((log) => [`${log.profileId}:${log.date}`, log]),
  );
  const deletedFor: string[] = [];
  return {
    addEarnedBadge: (badge) => {
      badges.push(badge);
      return Promise.resolve();
    },
    listEarnedBadges: (profileId) =>
      Promise.resolve(badges.filter((b) => b.profileId === profileId)),
    saveEarnedBadge: (badge) => {
      const index = badges.findIndex((b) => b.id === badge.id);
      if (index >= 0) badges[index] = badge;
      else badges.push(badge);
      return Promise.resolve();
    },
    getStreak: (profileId) => Promise.resolve(streaks.get(profileId)),
    saveStreak: (streak) => {
      streaks.set(streak.profileId, streak);
      return Promise.resolve();
    },
    getSessionLog: (profileId, date) => Promise.resolve(logs.get(`${profileId}:${date}`)),
    saveSessionLog: (log) => {
      logs.set(`${log.profileId}:${log.date}`, log);
      return Promise.resolve();
    },
    listSessionLogs: (profileId) =>
      Promise.resolve([...logs.values()].filter((log) => log.profileId === profileId)),
    deleteProfileData: (profileId) => {
      deletedFor.push(profileId);
      return Promise.resolve();
    },
    deletedFor,
  };
}

/* -------------------------------------------------------------------- AssessmentRepository - */

export function makeAssessmentRepo(
  results: readonly AssessmentResult[] = [],
  unlocks: readonly Unlock[] = [],
): AssessmentRepository & { readonly deletedFor: readonly string[] } {
  const resultStore: AssessmentResult[] = [...results];
  const unlockStore: Unlock[] = [...unlocks];
  const deletedFor: string[] = [];
  return {
    addAssessmentResult: (result) => {
      resultStore.push(result);
      return Promise.resolve();
    },
    listAssessmentResults: (profileId) =>
      Promise.resolve(resultStore.filter((r) => r.profileId === profileId)),
    addUnlock: (unlock) => {
      unlockStore.push(unlock);
      return Promise.resolve();
    },
    listUnlocks: (profileId) =>
      Promise.resolve(unlockStore.filter((u) => u.profileId === profileId)),
    deleteProfileData: (profileId) => {
      deletedFor.push(profileId);
      return Promise.resolve();
    },
    deletedFor,
  };
}

/* -------------------------------------------------------------------- ParentLockRepository - */

export function makeParentLockRepo(initial?: ParentLock): ParentLockRepository {
  let lock = initial;
  return {
    get: () => Promise.resolve(lock),
    save: (next) => {
      lock = next;
      return Promise.resolve();
    },
  };
}

/* -------------------------------------------------------------------- PasswordFileWriter ---- */

export function makePasswordFileWriter(): PasswordFileWriter & {
  readonly writes: readonly string[];
} {
  const writes: string[] = [];
  return {
    writes,
    write: (password) => {
      writes.push(password);
      return Promise.resolve({ location: `fake/${password}.txt` });
    },
  };
}

/* -------------------------------------------------------------------- SettingsRepository --- */

export function makeSettingsRepo(
  initial: AppSettings = { lastProfileId: null, suggestedLevels: {}, profileSettings: {} },
): SettingsRepository {
  let settings = initial;
  return {
    get: () => Promise.resolve(settings),
    save: (next) => {
      settings = next;
      return Promise.resolve();
    },
  };
}

/* -------------------------------------------------------------------- BackupFileWriter ------ */

export function makeBackupFileWriter(): BackupFileWriter & {
  readonly writes: readonly { readonly filename: string; readonly contents: string }[];
} {
  const writes: { readonly filename: string; readonly contents: string }[] = [];
  return {
    writes,
    write: (filename, contents) => {
      writes.push({ filename, contents });
      return Promise.resolve();
    },
  };
}

/* -------------------------------------------------------------------- BackupImporter -------- */

/** Records every `replaceAll`/`writeMerged` call in one `calls` list — a test suite drives
 * whichever one its own use case actually calls (never both) and asserts on that. */
export function makeBackupImporter(): BackupImporter & { readonly calls: readonly BackupFile[] } {
  const calls: BackupFile[] = [];
  return {
    calls,
    replaceAll: (file) => {
      calls.push(file);
      return Promise.resolve();
    },
    writeMerged: (file) => {
      calls.push(file);
      return Promise.resolve();
    },
  };
}

/* -------------------------------------------------------------------- AppDeps -------------- */

/** Every required `AppDeps` port, wired to the in-memory fakes above. */
export function makeDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  return {
    profiles: makeProfileRepo(),
    progress: makeProgressRepo(),
    gameRecords: makeGameRecordRepo(),
    clock: makeClock(),
    ids: makeIds(),
    content: stubContent,
    parentLock: makeParentLockRepo(),
    passwordFile: makePasswordFileWriter(),
    settings: makeSettingsRepo(),
    random: seededRandom(1),
    ...overrides,
  };
}

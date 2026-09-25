import { describe, expect, it } from 'vitest';

import type { AssessmentResult, Unlock } from '../domain/assessment.ts';
import type { EarnedBadge } from '../domain/badges.ts';
import { DEFAULT_PROFILE_SETTINGS } from '../domain/profile-settings.ts';
import { newProfile } from '../domain/profile.ts';
import type { Profile } from '../domain/profile.ts';
import { newLessonProgress, recordExerciseStars } from '../domain/progress.ts';
import type { Attempt, GameRecord, LessonProgress, MiniGameProgress } from '../domain/progress.ts';
import { seededRandom } from '../domain/random.ts';
import type { ConceptStats } from '../domain/review.ts';
import type { SessionLog } from '../domain/session-log.ts';
import type { Streak } from '../domain/streak.ts';
import type { ExerciseDef } from '../domain/exercise/types.ts';
import type { Lesson } from '../domain/lesson.ts';
import {
  BackupValidationError,
  backupFileName,
  backupSummary,
  buildBackupFile,
  exportBackup,
  importBackup,
  parseBackupFile,
} from './backup.ts';
import type { BackupFile } from './backup.ts';
import type {
  AppSettings,
  AssessmentRepository,
  BackupFileWriter,
  BackupImporter,
  ContentSource,
  GameRecordRepository,
  IdGenerator,
  ParentLockRepository,
  PasswordFileWriter,
  ProfileRepository,
  ProgressRepository,
  RewardsRepository,
} from './ports.ts';
import type { AppDeps } from './use-cases.ts';

const NOW = new Date('2026-01-10T12:00:00.000Z');

const EMPTY_POSITION = {
  pieces: {},
  markers: { stars: [], blocked: [] },
  toMove: 'w',
  castling: '-',
  enPassant: null,
} as const;

function makeExercise(id: string): ExerciseDef {
  return {
    id,
    concept: `${id}-concept`,
    textKey: `lessons:${id}`,
    position: EMPTY_POSITION,
    type: 'collect-stars',
    stars3: 1,
    stars2: 2,
  };
}

const L1: Lesson = {
  id: 'l1',
  world: 'w1',
  order: 1,
  concept: 'l1-concept',
  character: 'rhino',
  titleKey: 'lessons:l1.title',
  storyKey: 'lessons:l1.story',
  demo: {
    position: EMPTY_POSITION,
    textKey: 'lessons:l1.demo',
    highlight: { legalMovesFrom: 'd4' },
  },
  guided: [],
  exercises: [makeExercise('l1-01'), makeExercise('l1-02')],
};

function makeContent(): ContentSource {
  return {
    lessons: () => [L1],
    lesson: (id) => (id === L1.id ? L1 : undefined),
    minigames: () => [],
    minigame: () => undefined,
  };
}

function makeProfileRepo(initial: readonly Profile[] = []): ProfileRepository {
  const store = new Map(initial.map((profile) => [profile.id, profile]));
  return {
    list: () => Promise.resolve([...store.values()]),
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

function makeProgressRepo(
  lessons: readonly LessonProgress[] = [],
  attempts: readonly Attempt[] = [],
  miniGames: readonly MiniGameProgress[] = [],
  conceptStats: readonly ConceptStats[] = [],
): ProgressRepository {
  return {
    listLessons: (profileId) => Promise.resolve(lessons.filter((p) => p.profileId === profileId)),
    getLesson: () => Promise.resolve(undefined),
    saveLesson: () => Promise.resolve(),
    addAttempt: () => Promise.resolve(),
    listAttempts: (profileId) => Promise.resolve(attempts.filter((a) => a.profileId === profileId)),
    getMiniGame: () => Promise.resolve(undefined),
    listMiniGames: (profileId) =>
      Promise.resolve(miniGames.filter((m) => m.profileId === profileId)),
    saveMiniGame: () => Promise.resolve(),
    getConceptStats: () => Promise.resolve(undefined),
    listConceptStats: (profileId) =>
      Promise.resolve(conceptStats.filter((s) => s.profileId === profileId)),
    saveConceptStats: () => Promise.resolve(),
    deleteProfileData: () => Promise.resolve(),
  };
}

function makeGameRecordRepo(records: readonly GameRecord[] = []): GameRecordRepository {
  return {
    add: () => Promise.resolve(),
    listByProfile: (profileId) => Promise.resolve(records.filter((r) => r.profileId === profileId)),
    deleteProfileData: () => Promise.resolve(),
  };
}

function makeRewardsRepo(
  options: {
    readonly badges?: readonly EarnedBadge[];
    readonly streaks?: readonly Streak[];
    readonly sessionLogs?: readonly SessionLog[];
  } = {},
): RewardsRepository {
  const badges = options.badges ?? [];
  const streaks = options.streaks ?? [];
  const logs = options.sessionLogs ?? [];
  return {
    addEarnedBadge: () => Promise.resolve(),
    listEarnedBadges: (profileId) =>
      Promise.resolve(badges.filter((b) => b.profileId === profileId)),
    saveEarnedBadge: () => Promise.resolve(),
    getStreak: (profileId) => Promise.resolve(streaks.find((s) => s.profileId === profileId)),
    saveStreak: () => Promise.resolve(),
    getSessionLog: () => Promise.resolve(undefined),
    saveSessionLog: () => Promise.resolve(),
    listSessionLogs: (profileId) => Promise.resolve(logs.filter((l) => l.profileId === profileId)),
    deleteProfileData: () => Promise.resolve(),
  };
}

function makeAssessmentRepo(
  results: readonly AssessmentResult[] = [],
  unlocks: readonly Unlock[] = [],
): AssessmentRepository {
  return {
    addAssessmentResult: () => Promise.resolve(),
    listAssessmentResults: (profileId) =>
      Promise.resolve(results.filter((r) => r.profileId === profileId)),
    addUnlock: () => Promise.resolve(),
    listUnlocks: (profileId) => Promise.resolve(unlocks.filter((u) => u.profileId === profileId)),
    deleteProfileData: () => Promise.resolve(),
  };
}

function makeBackupFileWriter(): BackupFileWriter & {
  readonly writes: { readonly filename: string; readonly contents: string }[];
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

function makeBackupImporter(): BackupImporter & { readonly calls: BackupFile[] } {
  const calls: BackupFile[] = [];
  return {
    calls,
    replaceAll: (file) => {
      calls.push(file);
      return Promise.resolve();
    },
  };
}

function makeIds(prefix = 'id'): IdGenerator {
  let count = 0;
  return {
    next: () => {
      count += 1;
      return `${prefix}-${String(count)}`;
    },
  };
}

function makeDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  return {
    profiles: makeProfileRepo(),
    progress: makeProgressRepo(),
    gameRecords: makeGameRecordRepo(),
    rewards: makeRewardsRepo(),
    assessment: makeAssessmentRepo(),
    clock: { now: () => NOW },
    ids: makeIds(),
    content: makeContent(),
    parentLock: {} as unknown as ParentLockRepository,
    passwordFile: {} as unknown as PasswordFileWriter,
    settings: {
      get: () =>
        Promise.resolve<AppSettings>({
          lastProfileId: null,
          suggestedLevels: {},
          profileSettings: {},
        }),
      save: () => Promise.resolve(),
    },
    random: seededRandom(1),
    backupFileWriter: makeBackupFileWriter(),
    backupImporter: makeBackupImporter(),
    storageSchemaVersion: 5,
    ...overrides,
  };
}

function makeGameRecord(overrides: Partial<GameRecord> = {}): GameRecord {
  return {
    id: 'g1',
    profileId: 'p1',
    game: 'full',
    opponent: 'computer:1',
    result: 'win',
    reason: 'checkmate',
    moves: ['e4', 'e5'],
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe('buildBackupFile', () => {
  it('includes every profile and its data by default', async () => {
    const mia = newProfile('p1', 'Mia', 'fox', NOW);
    const leo = newProfile('p2', 'Leo', 'panda', NOW);
    let progress = newLessonProgress('lp1', 'p1', 'l1', NOW);
    progress = recordExerciseStars(progress, 'l1-01', 3, L1, NOW);
    const deps = makeDeps({
      profiles: makeProfileRepo([mia, leo]),
      progress: makeProgressRepo([progress]),
      gameRecords: makeGameRecordRepo([makeGameRecord()]),
    });

    const file = await buildBackupFile(deps);

    expect(file.app).toBe('chess-kids');
    expect(file.schemaVersion).toBe(5);
    expect(file.exportedAt).toBe(NOW.toISOString());
    expect(file.profiles.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(file.data.p1?.lessonProgress).toEqual([progress]);
    expect(file.data.p1?.gameRecords).toEqual([makeGameRecord()]);
    expect(file.data.p2?.lessonProgress).toEqual([]);
  });

  it('filters to the given profile ids ("Export per child")', async () => {
    const mia = newProfile('p1', 'Mia', 'fox', NOW);
    const leo = newProfile('p2', 'Leo', 'panda', NOW);
    const deps = makeDeps({ profiles: makeProfileRepo([mia, leo]) });

    const file = await buildBackupFile(deps, ['p2']);

    expect(file.profiles.map((p) => p.id)).toEqual(['p2']);
    expect(Object.keys(file.data)).toEqual(['p2']);
  });

  it('defaults a profile’s settings when none stored yet', async () => {
    const mia = newProfile('p1', 'Mia', 'fox', NOW);
    const deps = makeDeps({ profiles: makeProfileRepo([mia]) });

    const file = await buildBackupFile(deps);

    expect(file.data.p1?.settings).toEqual(DEFAULT_PROFILE_SETTINGS);
  });
});

describe('backupFileName', () => {
  it('is chess-kids-backup-<date>.json with no nickname', () => {
    expect(backupFileName(NOW)).toBe('chess-kids-backup-2026-01-10.json');
  });

  it('slugs the nickname in for a per-child export', () => {
    expect(backupFileName(NOW, 'Mia')).toBe('chess-kids-backup-mia-2026-01-10.json');
  });

  it('collapses punctuation/spaces in the nickname', () => {
    expect(backupFileName(NOW, 'Léo Jr.')).toMatch(/^chess-kids-backup-l.*o-jr-2026-01-10\.json$/);
  });
});

describe('exportBackup', () => {
  it('writes the built file via backupFileWriter, filename with no nickname for "everyone"', async () => {
    const mia = newProfile('p1', 'Mia', 'fox', NOW);
    const leo = newProfile('p2', 'Leo', 'panda', NOW);
    const writer = makeBackupFileWriter();
    const deps = makeDeps({ profiles: makeProfileRepo([mia, leo]), backupFileWriter: writer });

    await exportBackup(deps);

    expect(writer.writes).toHaveLength(1);
    expect(writer.writes[0]?.filename).toBe('chess-kids-backup-2026-01-10.json');
    const parsed = JSON.parse(writer.writes[0]?.contents ?? '{}') as BackupFile;
    expect(parsed.profiles).toHaveLength(2);
  });

  it('names the file after the one profile for a per-child export', async () => {
    const mia = newProfile('p1', 'Mia', 'fox', NOW);
    const writer = makeBackupFileWriter();
    const deps = makeDeps({ profiles: makeProfileRepo([mia]), backupFileWriter: writer });

    await exportBackup(deps, ['p1']);

    expect(writer.writes[0]?.filename).toBe('chess-kids-backup-mia-2026-01-10.json');
  });

  it('throws without deps.backupFileWriter wired up', async () => {
    const deps = makeDeps({ backupFileWriter: undefined });
    await expect(exportBackup(deps)).rejects.toThrow();
  });
});

describe('parseBackupFile / backupSummary round trip', () => {
  it('round-trips a built backup file through JSON', async () => {
    const mia = newProfile('p1', 'Mia', 'fox', NOW);
    let progress = newLessonProgress('lp1', 'p1', 'l1', NOW);
    progress = recordExerciseStars(progress, 'l1-01', 3, L1, NOW);
    progress = recordExerciseStars(progress, 'l1-02', 2, L1, NOW);
    const deps = makeDeps({
      profiles: makeProfileRepo([mia]),
      progress: makeProgressRepo([progress]),
    });

    const file = await buildBackupFile(deps);
    const raw = JSON.stringify(file);
    const parsed = parseBackupFile(deps, raw);

    expect(parsed).toEqual(file);
    expect(backupSummary(parsed)).toEqual({ profileCount: 1, totalStars: 5 });
  });

  it('rejects invalid JSON', () => {
    const deps = makeDeps();
    expect(() => parseBackupFile(deps, '{not json')).toThrow(BackupValidationError);
  });

  it('rejects a valid-JSON file with the wrong app id', () => {
    const deps = makeDeps();
    const raw = JSON.stringify({
      app: 'someone-else',
      schemaVersion: 1,
      exportedAt: NOW.toISOString(),
      profiles: [],
      data: {},
    });
    expect(() => parseBackupFile(deps, raw)).toThrow(BackupValidationError);
  });

  it('rejects a file missing required fields', () => {
    const deps = makeDeps();
    const raw = JSON.stringify({ app: 'chess-kids' });
    expect(() => parseBackupFile(deps, raw)).toThrow(BackupValidationError);
  });

  it('rejects a schemaVersion newer than deps.storageSchemaVersion', async () => {
    const deps = makeDeps({ storageSchemaVersion: 5 });
    const file = await buildBackupFile(deps);
    const raw = JSON.stringify({ ...file, schemaVersion: 6 });
    expect(() => parseBackupFile(deps, raw)).toThrow(BackupValidationError);
  });

  it('accepts a schemaVersion at or below the current one', async () => {
    const deps = makeDeps({ storageSchemaVersion: 5 });
    const file = await buildBackupFile(deps);
    const olderRaw = JSON.stringify({ ...file, schemaVersion: 3 });
    expect(() => parseBackupFile(deps, olderRaw)).not.toThrow();
  });
});

describe('importBackup', () => {
  it('parses, then replaces via backupImporter, and returns the summary', async () => {
    const mia = newProfile('p1', 'Mia', 'fox', NOW);
    let progress = newLessonProgress('lp1', 'p1', 'l1', NOW);
    progress = recordExerciseStars(progress, 'l1-01', 3, L1, NOW);
    const sourceDeps = makeDeps({
      profiles: makeProfileRepo([mia]),
      progress: makeProgressRepo([progress]),
    });
    const file = await buildBackupFile(sourceDeps);
    const raw = JSON.stringify(file);

    const importer = makeBackupImporter();
    const deps = makeDeps({ backupImporter: importer });

    const summary = await importBackup(deps, raw);

    expect(importer.calls).toHaveLength(1);
    expect(importer.calls[0]?.profiles.map((p) => p.id)).toEqual(['p1']);
    expect(summary).toEqual({ profileCount: 1, totalStars: 3 });
  });

  it('never calls backupImporter.replaceAll on an invalid file ("nothing changed")', async () => {
    const importer = makeBackupImporter();
    const deps = makeDeps({ backupImporter: importer });

    await expect(importBackup(deps, 'not json')).rejects.toThrow(BackupValidationError);

    expect(importer.calls).toHaveLength(0);
  });
});

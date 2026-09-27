import { describe, expect, it } from 'vitest';

import { DEFAULT_PROFILE_SETTINGS } from '../domain/profile-settings.ts';
import { newProfile } from '../domain/profile.ts';
import { newLessonProgress, recordExerciseStars } from '../domain/progress.ts';
import type { GameRecord, LessonProgress } from '../domain/progress.ts';
import type { Lesson } from '../domain/lesson.ts';
import type { AppConfig } from '../domain/subject.ts';
import {
  makeExercise as buildExercise,
  makeLesson as buildLesson,
  makeContentSource,
  makeDeps as buildDeps,
  makeGameRecordRepo,
  makeProfileRepo,
  makeProgressRepo as buildProgressRepo,
  makeRewardsRepo as buildRewardsRepo,
  makeAssessmentRepo as buildAssessmentRepo,
  makeClock as buildClock,
  makeBackupFileWriter,
  makeBackupImporter,
} from '../testing/index.ts';
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
import type { AppDeps } from './use-cases.ts';

const NOW = new Date('2026-01-10T12:00:00.000Z');

const APP: AppConfig = {
  storagePrefix: 'chess-kids:',
  backupAppId: 'chess-kids',
  backupFilePrefix: 'chess-for-kids',
  parentCodeFilePrefix: 'chess-for-kids-parent-code',
  version: '0.0.0-test',
};

function makeExercise(id: string) {
  return buildExercise({ id, concept: `${id}-concept` });
}

const L1: Lesson = buildLesson({
  id: 'l1',
  world: 'w1',
  concept: 'l1-concept',
  exercises: [makeExercise('l1-01'), makeExercise('l1-02')],
});

function makeContent(): ReturnType<typeof makeContentSource> {
  return makeContentSource({ lessons: [L1] });
}

function makeProgressRepo(lessons: readonly LessonProgress[] = []): AppDeps['progress'] {
  return buildProgressRepo({ lessons });
}

function makeDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  return buildDeps({
    rewards: buildRewardsRepo(),
    assessment: buildAssessmentRepo(),
    clock: buildClock(NOW),
    content: makeContent(),
    backupFileWriter: makeBackupFileWriter(),
    backupImporter: makeBackupImporter(),
    storageSchemaVersion: 5,
    ...overrides,
  });
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
    expect(backupFileName(APP, NOW)).toBe('chess-kids-backup-2026-01-10.json');
  });

  it('slugs the nickname in for a per-child export', () => {
    expect(backupFileName(APP, NOW, 'Mia')).toBe('chess-kids-backup-mia-2026-01-10.json');
  });

  it('collapses punctuation/spaces in the nickname', () => {
    expect(backupFileName(APP, NOW, 'Léo Jr.')).toMatch(
      /^chess-kids-backup-l.*o-jr-2026-01-10\.json$/,
    );
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

import { beforeEach, describe, expect, it } from 'vitest';
import type { AppDeps, ContentSource } from '@chess-kids/core';
import { createProfile } from '@chess-kids/core';
import { buildBackupFile } from '@chess-kids/core/backup';
import { LocalStorageBackupImporter } from './local-backup-importer.ts';
import { LocalStorageAssessmentRepository } from './local-assessment-repository.ts';
import { LocalStorageGameRecordRepository } from './local-game-record-repository.ts';
import { LocalStorageParentLockRepository } from './local-parent-lock-repository.ts';
import { LocalStorageProfileRepository } from './local-profile-repository.ts';
import { LocalStorageProgressRepository } from './local-progress-repository.ts';
import { LocalStorageRewardsRepository } from './local-rewards-repository.ts';
import { LocalStorageSettingsRepository } from './local-settings-repository.ts';
import { openLocalStore, SCHEMA_VERSION } from './local-store.ts';
import { MIGRATIONS } from './migrations.ts';

beforeEach(() => {
  localStorage.clear();
});

const stubContent: ContentSource = {
  lessons: () => [],
  lesson: () => undefined,
  minigames: () => [],
  minigame: () => undefined,
};

/** Fresh `AppDeps` wired directly to `localStorage` (this file's own repos, no `test-services.ts`
 * indirection — keeps this test close to the real `chess-kids:*` storage shape). */
function makeDeps(): AppDeps {
  const store = openLocalStore(localStorage, { migrations: MIGRATIONS });
  return {
    profiles: new LocalStorageProfileRepository(store),
    progress: new LocalStorageProgressRepository(store),
    gameRecords: new LocalStorageGameRecordRepository(store),
    rewards: new LocalStorageRewardsRepository(store),
    assessment: new LocalStorageAssessmentRepository(store),
    clock: { now: () => new Date('2026-01-10T12:00:00.000Z') },
    ids: {
      next: (() => {
        let n = 0;
        return () => `id-${String((n += 1))}`;
      })(),
    },
    content: stubContent,
    parentLock: new LocalStorageParentLockRepository(store),
    passwordFile: { write: () => Promise.resolve({ location: 'x' }) },
    settings: new LocalStorageSettingsRepository(store),
    random: { next: () => 0.5 },
    backupImporter: new LocalStorageBackupImporter(store),
    storageSchemaVersion: SCHEMA_VERSION,
  };
}

describe('LocalStorageBackupImporter', () => {
  it('replaces every profile/progress/reward/assessment record, never touching the parent password', async () => {
    const deps = makeDeps();

    const keep = await createProfile(deps, 'Mia', 'fox');
    await deps.progress.saveLesson({
      id: 'lp1',
      profileId: keep.id,
      lessonId: 'l1',
      bestStars: { 'l1-01': 3 },
      bossStars: 0,
      resumeStep: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const file = await buildBackupFile(deps, [keep.id]);

    // Junk to be wiped: a second profile with its own data, plus the parent password (kept).
    const junk = await createProfile(deps, 'Ghost', 'panda');
    await deps.gameRecords.add({
      id: 'g1',
      profileId: junk.id,
      game: 'full',
      opponent: 'computer:1',
      result: 'win',
      reason: 'checkmate',
      moves: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    await deps.parentLock.save({
      id: 'lock1',
      password: 'secret1',
      fileLocation: 'Downloads/x.txt',
      failedAttempts: 0,
      lockedUntil: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await deps.backupImporter?.replaceAll(file);

    // Fresh repos over the same (now-swapped) storage.
    const after = makeDeps();
    expect((await after.profiles.list()).map((p) => p.id)).toEqual([keep.id]);
    expect(await after.progress.listLessons(keep.id)).toHaveLength(1);
    expect(await after.gameRecords.listByProfile(junk.id)).toEqual([]);
    expect(await after.profiles.get(junk.id)).toBeUndefined();
    expect((await after.parentLock.get())?.password).toBe('secret1');
  });

  it('leaves no backup-staging:* keys behind after a successful import', async () => {
    const deps = makeDeps();
    const profile = await createProfile(deps, 'Mia', 'fox');
    const file = await buildBackupFile(deps, [profile.id]);

    await deps.backupImporter?.replaceAll(file);

    const staging: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.includes('backup-staging:')) staging.push(key);
    }
    expect(staging).toEqual([]);
  });

  it('rejects a schemaVersion newer than SCHEMA_VERSION, changing nothing', async () => {
    const deps = makeDeps();
    const profile = await createProfile(deps, 'Mia', 'fox');
    const file = await buildBackupFile(deps, [profile.id]);
    const newerFile = { ...file, schemaVersion: SCHEMA_VERSION + 1 };

    await expect(deps.backupImporter?.replaceAll(newerFile)).rejects.toThrow();

    const after = makeDeps();
    expect((await after.profiles.list()).map((p) => p.id)).toEqual([profile.id]);
  });

  it('restores per-profile settings, streak, badges, and session logs', async () => {
    const deps = makeDeps();
    const profile = await createProfile(deps, 'Mia', 'fox');
    await deps.settings.save({
      lastProfileId: null,
      suggestedLevels: {},
      profileSettings: {
        [profile.id]: {
          dailyLimitMinutes: 30,
          voice: false,
          sound: true,
          hints: false,
          computerLevel: 2,
          pieceStyle: 'classic',
        },
      },
    });
    await deps.rewards?.saveStreak({
      id: 's1',
      profileId: profile.id,
      current: 4,
      best: 4,
      skipsUsedThisWeek: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    await deps.rewards?.addEarnedBadge({
      id: 'b1',
      profileId: profile.id,
      badgeId: 'first-win',
      at: '2026-01-01T00:00:00.000Z',
      seen: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    await deps.rewards?.saveSessionLog({
      id: 'l1',
      profileId: profile.id,
      date: '2026-01-09',
      minutes: 12,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const file = await buildBackupFile(deps, [profile.id]);
    await deps.backupImporter?.replaceAll(file);

    const after = makeDeps();
    const settings = await after.settings.get();
    expect(settings.profileSettings[profile.id]?.dailyLimitMinutes).toBe(30);
    expect((await after.rewards?.getStreak(profile.id))?.current).toBe(4);
    expect(await after.rewards?.listEarnedBadges(profile.id)).toHaveLength(1);
    expect(await after.rewards?.listSessionLogs(profile.id)).toEqual([
      expect.objectContaining({ date: '2026-01-09', minutes: 12 }),
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import type { ParentLock } from '../domain/parent-lock.ts';
import type { Profile } from '../domain/profile.ts';
import type { Attempt, GameRecord, LessonProgress, MiniGameProgress } from '../domain/progress.ts';
import { seededRandom } from '../domain/random.ts';
import {
  changeAvatar,
  changeParentPassword,
  createProfile,
  deleteProfile,
  isFirstRun,
  listProfiles,
  renameProfile,
  resetProfileData,
  selectProfile,
  setupParentPassword,
  verifyParentPassword,
} from './profiles.ts';
import type { AppDeps } from './use-cases.ts';
import type {
  AppSettings,
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
} from './ports.ts';

function makeClock(iso: string): Clock {
  return { now: () => new Date(iso) };
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

function makeProfileRepo(initial: readonly Profile[] = []): ProfileRepository {
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

function makeProgressRepo(): ProgressRepository & { readonly deletedFor: string[] } {
  const lessons = new Map<string, LessonProgress>();
  const deletedFor: string[] = [];
  return {
    listLessons: (profileId) =>
      Promise.resolve([...lessons.values()].filter((p) => p.profileId === profileId)),
    getLesson: () => Promise.resolve(undefined),
    saveLesson: (progress) => {
      lessons.set(`${progress.profileId}:${progress.lessonId}`, progress);
      return Promise.resolve();
    },
    addAttempt: () => Promise.resolve(),
    listAttempts: () => Promise.resolve<Attempt[]>([]),
    getMiniGame: () => Promise.resolve(undefined),
    listMiniGames: () => Promise.resolve<MiniGameProgress[]>([]),
    saveMiniGame: () => Promise.resolve(),
    getConceptStats: () => Promise.resolve(undefined),
    listConceptStats: () => Promise.resolve([]),
    saveConceptStats: () => Promise.resolve(),
    deleteProfileData: (profileId) => {
      deletedFor.push(profileId);
      for (const [key, progress] of lessons) {
        if (progress.profileId === profileId) lessons.delete(key);
      }
      return Promise.resolve();
    },
    deletedFor,
  };
}

function makeGameRecordRepo(): GameRecordRepository & { readonly deletedFor: string[] } {
  const records: GameRecord[] = [];
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
      return Promise.resolve();
    },
    deletedFor,
  };
}

function makeRewardsRepo(): RewardsRepository & { readonly deletedFor: string[] } {
  const deletedFor: string[] = [];
  return {
    addEarnedBadge: () => Promise.resolve(),
    listEarnedBadges: () => Promise.resolve([]),
    saveEarnedBadge: () => Promise.resolve(),
    getStreak: () => Promise.resolve(undefined),
    saveStreak: () => Promise.resolve(),
    getSessionLog: () => Promise.resolve(undefined),
    saveSessionLog: () => Promise.resolve(),
    listSessionLogs: () => Promise.resolve([]),
    deleteProfileData: (profileId) => {
      deletedFor.push(profileId);
      return Promise.resolve();
    },
    deletedFor,
  };
}

function makeParentLockRepo(initial?: ParentLock): ParentLockRepository {
  let lock = initial;
  return {
    get: () => Promise.resolve(lock),
    save: (next) => {
      lock = next;
      return Promise.resolve();
    },
  };
}

function makePasswordFileWriter(): PasswordFileWriter & { readonly writes: string[] } {
  const writes: string[] = [];
  return {
    write: (password) => {
      writes.push(password);
      return Promise.resolve({ location: `Downloads/${password}.txt` });
    },
    writes,
  };
}

function makeSettingsRepo(
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

const stubContent: ContentSource = {
  lessons: () => [],
  lesson: () => undefined,
  minigames: () => [],
  minigame: () => undefined,
};

function makeDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  return {
    profiles: makeProfileRepo(),
    progress: makeProgressRepo(),
    gameRecords: makeGameRecordRepo(),
    clock: makeClock('2026-01-01T00:00:00.000Z'),
    ids: makeIds(),
    content: stubContent,
    parentLock: makeParentLockRepo(),
    passwordFile: makePasswordFileWriter(),
    settings: makeSettingsRepo(),
    random: seededRandom(1),
    ...overrides,
  };
}

describe('isFirstRun', () => {
  it('true when no parent lock exists yet, even with existing profiles (M1 upgrade path)', async () => {
    const deps = makeDeps({
      profiles: makeProfileRepo([
        {
          id: 'p1',
          accountId: 'local',
          nickname: 'Player',
          avatar: 'fox',
          locale: 'en',
          createdAt: 't',
          updatedAt: 't',
        },
      ]),
    });
    expect(await isFirstRun(deps)).toBe(true);
  });

  it('false once a parent lock has been set up', async () => {
    const deps = makeDeps();
    await setupParentPassword(deps, '1234');
    expect(await isFirstRun(deps)).toBe(false);
  });
});

describe('setupParentPassword', () => {
  it('rejects a too-short password without writing the file or saving a lock', async () => {
    const writer = makePasswordFileWriter();
    const deps = makeDeps({ passwordFile: writer });
    await expect(setupParentPassword(deps, '123')).rejects.toThrow();
    expect(writer.writes).toEqual([]);
    expect(await deps.parentLock.get()).toBeUndefined();
  });

  it('writes the password file and saves a fresh lock', async () => {
    const deps = makeDeps();
    const result = await setupParentPassword(deps, '1234');
    expect(result.location).toBe('Downloads/1234.txt');
    const lock = await deps.parentLock.get();
    expect(lock?.password).toBe('1234');
    expect(lock?.fileLocation).toBe('Downloads/1234.txt');
    expect(lock?.failedAttempts).toBe(0);
  });
});

describe('verifyParentPassword', () => {
  it('persists the updated lock state on every attempt', async () => {
    const deps = makeDeps();
    await setupParentPassword(deps, '1234');

    const wrong = await verifyParentPassword(deps, 'nope');
    expect(wrong).toEqual({ ok: false, waitMs: 0 });
    expect((await deps.parentLock.get())?.failedAttempts).toBe(1);

    const right = await verifyParentPassword(deps, '1234');
    expect(right).toEqual({ ok: true, waitMs: 0 });
    expect((await deps.parentLock.get())?.failedAttempts).toBe(0);
  });

  it('locks out after 5 wrong attempts', async () => {
    const deps = makeDeps();
    await setupParentPassword(deps, '1234');

    let last: { ok: boolean; waitMs: number } = { ok: true, waitMs: 0 };
    for (let i = 0; i < 5; i += 1) {
      last = await verifyParentPassword(deps, 'nope');
    }
    expect(last.ok).toBe(false);
    expect(last.waitMs).toBe(60_000);

    const stillLocked = await verifyParentPassword(deps, '1234');
    expect(stillLocked.ok).toBe(false);
    expect(stillLocked.waitMs).toBeGreaterThan(0);
  });

  it('with no lock set up yet: rejected, never throws', async () => {
    const deps = makeDeps();
    expect(await verifyParentPassword(deps, 'anything')).toEqual({ ok: false, waitMs: 0 });
  });
});

describe('changeParentPassword', () => {
  it('rewrites the file and updates the lock', async () => {
    const writer = makePasswordFileWriter();
    const deps = makeDeps({ passwordFile: writer });
    await setupParentPassword(deps, '1234');

    const result = await changeParentPassword(deps, '5678');
    expect(result.location).toBe('Downloads/5678.txt');
    expect(writer.writes).toEqual(['1234', '5678']);
    expect((await deps.parentLock.get())?.password).toBe('5678');
  });

  it('rejects when no lock exists yet', async () => {
    const deps = makeDeps();
    await expect(changeParentPassword(deps, '5678')).rejects.toThrow();
  });
});

describe('profile CRUD', () => {
  it('createProfile rejects an invalid nickname', async () => {
    const deps = makeDeps();
    await expect(createProfile(deps, '', 'fox')).rejects.toThrow();
  });

  it('createProfile / renameProfile / changeAvatar / listProfiles round-trip', async () => {
    const deps = makeDeps();
    const created = await createProfile(deps, 'Mia', 'panda');
    expect(await listProfiles(deps)).toEqual([created]);

    const renamed = await renameProfile(deps, created.id, 'Leo');
    expect(renamed.nickname).toBe('Leo');

    const recolored = await changeAvatar(deps, created.id, 'fox');
    expect(recolored.avatar).toBe('fox');

    const [only] = await listProfiles(deps);
    expect(only).toMatchObject({ nickname: 'Leo', avatar: 'fox' });
  });
});

describe('selectProfile / deleteProfile', () => {
  it('selectProfile saves lastProfileId', async () => {
    const deps = makeDeps();
    const profile = await createProfile(deps, 'Mia', 'panda');
    await selectProfile(deps, profile.id);
    expect(await deps.settings.get()).toEqual({
      lastProfileId: profile.id,
      suggestedLevels: {},
      profileSettings: {},
    });
  });

  it('deleteProfile cascades progress and game-record data and clears lastProfileId when it was selected', async () => {
    const progress = makeProgressRepo();
    const gameRecords = makeGameRecordRepo();
    const deps = makeDeps({ progress, gameRecords });
    const profile = await createProfile(deps, 'Mia', 'panda');
    await selectProfile(deps, profile.id);

    await deleteProfile(deps, profile.id);

    expect(await deps.profiles.get(profile.id)).toBeUndefined();
    expect(progress.deletedFor).toEqual([profile.id]);
    expect(gameRecords.deletedFor).toEqual([profile.id]);
    expect(await deps.settings.get()).toEqual({
      lastProfileId: null,
      suggestedLevels: {},
      profileSettings: {},
    });
  });

  it('deleteProfile leaves lastProfileId alone when a different profile is selected', async () => {
    const deps = makeDeps();
    const mia = await createProfile(deps, 'Mia', 'panda');
    const leo = await createProfile(deps, 'Leo', 'fox');
    await selectProfile(deps, leo.id);

    await deleteProfile(deps, mia.id);

    expect(await deps.settings.get()).toEqual({
      lastProfileId: leo.id,
      suggestedLevels: {},
      profileSettings: {},
    });
  });
});

describe('resetProfileData', () => {
  it('cascades progress, game-record and rewards data, but keeps the profile itself', async () => {
    const progress = makeProgressRepo();
    const gameRecords = makeGameRecordRepo();
    const rewards = makeRewardsRepo();
    const deps = makeDeps({ progress, gameRecords, rewards });
    const profile = await createProfile(deps, 'Mia', 'panda');
    await selectProfile(deps, profile.id);

    await resetProfileData(deps, profile.id);

    expect(progress.deletedFor).toEqual([profile.id]);
    expect(gameRecords.deletedFor).toEqual([profile.id]);
    expect(rewards.deletedFor).toEqual([profile.id]);
    expect(await deps.profiles.get(profile.id)).toEqual(profile);
    // Unlike deleteProfile, lastProfileId (identity/selection) is left alone.
    expect((await deps.settings.get()).lastProfileId).toBe(profile.id);
  });

  it('throws for an unknown profile id', async () => {
    const deps = makeDeps();
    await expect(resetProfileData(deps, 'ghost')).rejects.toThrow();
  });

  it('no-ops the rewards cascade without deps.rewards wired up', async () => {
    const progress = makeProgressRepo();
    const deps = makeDeps({ progress, rewards: undefined });
    const profile = await createProfile(deps, 'Mia', 'panda');

    await expect(resetProfileData(deps, profile.id)).resolves.toBeUndefined();
    expect(progress.deletedFor).toEqual([profile.id]);
  });
});

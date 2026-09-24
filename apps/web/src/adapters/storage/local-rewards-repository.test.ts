import { beforeEach, describe, expect, it } from 'vitest';
import type { EarnedBadge, SessionLog, Streak } from '@chess-kids/core';
import { openLocalStore, StorageError } from './local-store.ts';
import { LocalStorageRewardsRepository } from './local-rewards-repository.ts';

function makeBadge(overrides: Partial<EarnedBadge> = {}): EarnedBadge {
  return {
    id: 'eb1',
    profileId: 'profile-1',
    badgeId: 'first-win',
    at: '2026-01-01T00:00:00.000Z',
    seen: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeStreak(overrides: Partial<Streak> = {}): Streak {
  return {
    id: 's1',
    profileId: 'profile-1',
    current: 3,
    best: 5,
    lastDay: '2026-01-05',
    skipsUsedThisWeek: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-05T00:00:00.000Z',
    ...overrides,
  };
}

function makeSessionLog(overrides: Partial<SessionLog> = {}): SessionLog {
  return {
    id: 'sl1',
    profileId: 'profile-1',
    date: '2026-01-05',
    minutes: 15,
    createdAt: '2026-01-05T00:00:00.000Z',
    updatedAt: '2026-01-05T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

function makeRepo(): LocalStorageRewardsRepository {
  const store = openLocalStore(localStorage);
  return new LocalStorageRewardsRepository(store);
}

describe('LocalStorageRewardsRepository', () => {
  it('adds and lists earned badges, filtered by profile', async () => {
    const repo = makeRepo();
    await repo.addEarnedBadge(makeBadge({ id: 'eb1', profileId: 'profile-1' }));
    await repo.addEarnedBadge(makeBadge({ id: 'eb2', profileId: 'profile-2' }));

    expect(await repo.listEarnedBadges('profile-1')).toHaveLength(1);
    expect(await repo.listEarnedBadges('profile-2')).toHaveLength(1);
  });

  it('saveEarnedBadge updates an existing row in place (e.g. marking it seen)', async () => {
    const repo = makeRepo();
    await repo.addEarnedBadge(makeBadge({ id: 'eb1', seen: false }));
    await repo.saveEarnedBadge(makeBadge({ id: 'eb1', seen: true }));

    const [badge] = await repo.listEarnedBadges('profile-1');
    expect(badge?.seen).toBe(true);
  });

  it('gets and saves one streak per profile', async () => {
    const repo = makeRepo();
    expect(await repo.getStreak('profile-1')).toBeUndefined();

    await repo.saveStreak(makeStreak());
    expect(await repo.getStreak('profile-1')).toEqual(makeStreak());

    await repo.saveStreak(makeStreak({ current: 4 }));
    expect((await repo.getStreak('profile-1'))?.current).toBe(4);
  });

  it('gets and saves a session log row per profile + date', async () => {
    const repo = makeRepo();
    expect(await repo.getSessionLog('profile-1', '2026-01-05')).toBeUndefined();

    await repo.saveSessionLog(makeSessionLog());
    expect(await repo.getSessionLog('profile-1', '2026-01-05')).toEqual(makeSessionLog());
    expect(await repo.getSessionLog('profile-1', '2026-01-06')).toBeUndefined();
  });

  it('deleteProfileData removes badges, streak and session logs for that profile only', async () => {
    const repo = makeRepo();
    await repo.addEarnedBadge(makeBadge({ id: 'eb1', profileId: 'profile-1' }));
    await repo.addEarnedBadge(makeBadge({ id: 'eb2', profileId: 'profile-2' }));
    await repo.saveStreak(makeStreak({ profileId: 'profile-1' }));
    await repo.saveStreak(makeStreak({ id: 's2', profileId: 'profile-2' }));
    await repo.saveSessionLog(makeSessionLog({ profileId: 'profile-1' }));
    await repo.saveSessionLog(makeSessionLog({ id: 'sl2', profileId: 'profile-2' }));

    await repo.deleteProfileData('profile-1');

    expect(await repo.listEarnedBadges('profile-1')).toEqual([]);
    expect(await repo.listEarnedBadges('profile-2')).toHaveLength(1);
    expect(await repo.getStreak('profile-1')).toBeUndefined();
    expect(await repo.getStreak('profile-2')).toBeDefined();
    expect(await repo.getSessionLog('profile-1', '2026-01-05')).toBeUndefined();
    expect(await repo.getSessionLog('profile-2', '2026-01-05')).toBeDefined();
  });

  it('rejects with StorageError on corrupt data at any of its three keys', async () => {
    const store = openLocalStore(localStorage);
    localStorage.setItem('chess-kids:earned-badges', JSON.stringify({ not: 'an array' }));
    const repo = new LocalStorageRewardsRepository(store);

    await expect(repo.listEarnedBadges('profile-1')).rejects.toThrow(StorageError);
  });
});

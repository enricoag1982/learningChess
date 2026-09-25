import { beforeEach, describe, expect, it } from 'vitest';
import type { AssessmentResult, Unlock } from '@chess-kids/core';
import { openLocalStore, StorageError } from './local-store.ts';
import { LocalStorageAssessmentRepository } from './local-assessment-repository.ts';

function makeResult(overrides: Partial<AssessmentResult> = {}): AssessmentResult {
  return {
    id: 'ar1',
    profileId: 'profile-1',
    kind: 'test-out',
    scope: { type: 'lesson', lessonId: 'rook', worldId: 'pieces' },
    correct: 4,
    total: 5,
    passed: true,
    at: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeUnlock(overrides: Partial<Unlock> = {}): Unlock {
  return {
    id: 'u1',
    profileId: 'profile-1',
    targetType: 'lesson',
    targetId: 'rook',
    via: 'test-out',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

function makeRepo(): LocalStorageAssessmentRepository {
  const store = openLocalStore(localStorage);
  return new LocalStorageAssessmentRepository(store);
}

describe('LocalStorageAssessmentRepository', () => {
  it('adds and lists assessment results, filtered by profile', async () => {
    const repo = makeRepo();
    await repo.addAssessmentResult(makeResult({ id: 'ar1', profileId: 'profile-1' }));
    await repo.addAssessmentResult(makeResult({ id: 'ar2', profileId: 'profile-2' }));

    expect(await repo.listAssessmentResults('profile-1')).toHaveLength(1);
    expect(await repo.listAssessmentResults('profile-2')).toHaveLength(1);
  });

  it('adds and lists unlocks, filtered by profile', async () => {
    const repo = makeRepo();
    await repo.addUnlock(makeUnlock({ id: 'u1', profileId: 'profile-1', targetId: 'rook' }));
    await repo.addUnlock(
      makeUnlock({ id: 'u2', profileId: 'profile-1', targetType: 'world', targetId: 'pieces' }),
    );
    await repo.addUnlock(makeUnlock({ id: 'u3', profileId: 'profile-2' }));

    const unlocks = await repo.listUnlocks('profile-1');
    expect(unlocks).toHaveLength(2);
    expect(unlocks.map((u) => u.targetId).sort()).toEqual(['pieces', 'rook']);
  });

  it('deleteProfileData removes results and unlocks for that profile only', async () => {
    const repo = makeRepo();
    await repo.addAssessmentResult(makeResult({ id: 'ar1', profileId: 'profile-1' }));
    await repo.addAssessmentResult(makeResult({ id: 'ar2', profileId: 'profile-2' }));
    await repo.addUnlock(makeUnlock({ id: 'u1', profileId: 'profile-1' }));
    await repo.addUnlock(makeUnlock({ id: 'u2', profileId: 'profile-2' }));

    await repo.deleteProfileData('profile-1');

    expect(await repo.listAssessmentResults('profile-1')).toEqual([]);
    expect(await repo.listAssessmentResults('profile-2')).toHaveLength(1);
    expect(await repo.listUnlocks('profile-1')).toEqual([]);
    expect(await repo.listUnlocks('profile-2')).toHaveLength(1);
  });

  it('rejects with StorageError on corrupt data at either key', async () => {
    const store = openLocalStore(localStorage);
    localStorage.setItem('chess-kids:assessment-results', JSON.stringify({ not: 'an array' }));
    const repo = new LocalStorageAssessmentRepository(store);

    await expect(repo.listAssessmentResults('profile-1')).rejects.toThrow(StorageError);
  });
});

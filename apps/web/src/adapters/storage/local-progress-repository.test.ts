import { beforeEach, describe, expect, it } from 'vitest';
import type { Attempt, LessonProgress } from '@chess-kids/core';
import { openLocalStore, StorageError } from './local-store.ts';
import { LocalStorageProgressRepository } from './local-progress-repository.ts';

function makeProgress(overrides: Partial<LessonProgress> = {}): LessonProgress {
  return {
    id: 'lp1',
    profileId: 'profile-1',
    lessonId: 'rook',
    bestStars: {},
    bossStars: 0,
    resumeStep: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeAttempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: 'a1',
    profileId: 'profile-1',
    lessonId: 'rook',
    exerciseId: 'rook-01',
    conceptId: 'rook-move',
    scored: true,
    correct: true,
    stars: 3,
    hints: 0,
    errors: 0,
    moves: 1,
    durationMs: 1000,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('LocalStorageProgressRepository — lesson progress', () => {
  it('saves, gets and lists lessons keyed by profile + lesson, and updates in place', async () => {
    const repo = new LocalStorageProgressRepository(openLocalStore(localStorage));
    const rook = makeProgress({ id: 'a', lessonId: 'rook' });
    const bishop = makeProgress({ id: 'b', lessonId: 'bishop' });
    const otherProfile = makeProgress({ id: 'c', profileId: 'profile-2', lessonId: 'rook' });

    await repo.saveLesson(rook);
    await repo.saveLesson(bishop);
    await repo.saveLesson(otherProfile);

    expect(await repo.getLesson('profile-1', 'rook')).toEqual(rook);
    expect(await repo.getLesson('profile-1', 'unknown-lesson')).toBeUndefined();
    expect(await repo.listLessons('profile-1')).toEqual(expect.arrayContaining([rook, bishop]));
    expect(await repo.listLessons('profile-1')).toHaveLength(2);

    const updated: LessonProgress = { ...rook, resumeStep: 5 };
    await repo.saveLesson(updated);
    expect(await repo.getLesson('profile-1', 'rook')).toEqual(updated);
  });

  it('persists data for a new repository instance over the same storage', async () => {
    const progress = makeProgress();
    await new LocalStorageProgressRepository(openLocalStore(localStorage)).saveLesson(progress);

    const second = new LocalStorageProgressRepository(openLocalStore(localStorage));
    expect(await second.getLesson('profile-1', 'rook')).toEqual(progress);
  });

  it('rejects with StorageError on a corrupt stored shape', async () => {
    const store = openLocalStore(localStorage);
    store.write('lesson-progress', { 'profile-1:rook': { nope: true } });
    const repo = new LocalStorageProgressRepository(store);

    await expect(repo.listLessons('profile-1')).rejects.toThrow(StorageError);
  });
});

describe('LocalStorageProgressRepository — attempts', () => {
  it('appends attempts newest last and filters by profile', async () => {
    const repo = new LocalStorageProgressRepository(openLocalStore(localStorage));
    const first = makeAttempt({ id: 'a1' });
    const second = makeAttempt({ id: 'a2' });
    const otherProfile = makeAttempt({ id: 'a3', profileId: 'profile-2' });

    await repo.addAttempt(first);
    await repo.addAttempt(second);
    await repo.addAttempt(otherProfile);

    expect(await repo.listAttempts('profile-1')).toEqual([first, second]);
    expect(await repo.listAttempts('profile-2')).toEqual([otherProfile]);
  });

  it('caps stored attempts at 2000, dropping the oldest first', async () => {
    const repo = new LocalStorageProgressRepository(openLocalStore(localStorage));
    for (let i = 0; i < 2005; i += 1) {
      await repo.addAttempt(makeAttempt({ id: `a${String(i)}` }));
    }

    const attempts = await repo.listAttempts('profile-1');
    expect(attempts).toHaveLength(2000);
    expect(attempts[0]?.id).toBe('a5');
    expect(attempts.at(-1)?.id).toBe('a2004');
  });

  it('rejects with StorageError on a corrupt stored shape', async () => {
    const store = openLocalStore(localStorage);
    store.write('attempts', [{ nope: true }]);
    const repo = new LocalStorageProgressRepository(store);

    await expect(repo.listAttempts('profile-1')).rejects.toThrow(StorageError);
  });
});

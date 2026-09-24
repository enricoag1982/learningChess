import { beforeEach, describe, expect, it } from 'vitest';
import type { Attempt, ConceptStats, LessonProgress, MiniGameProgress } from '@chess-kids/core';
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

function makeMiniGameProgress(overrides: Partial<MiniGameProgress> = {}): MiniGameProgress {
  return {
    id: 'mg1',
    profileId: 'profile-1',
    miniGameId: 'hungry-rook',
    bestStars: 3,
    plays: 1,
    wins: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeConceptStats(overrides: Partial<ConceptStats> = {}): ConceptStats {
  return {
    id: 'cs1',
    profileId: 'profile-1',
    conceptId: 'rook-move',
    recent: [true, false],
    box: 1,
    dueAt: '2026-01-02T00:00:00.000Z',
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

describe('LocalStorageProgressRepository — deleteProfileData', () => {
  it('removes lesson progress and attempts for the profile, leaving other profiles untouched', async () => {
    const repo = new LocalStorageProgressRepository(openLocalStore(localStorage));
    await repo.saveLesson(makeProgress({ id: 'a', lessonId: 'rook' }));
    await repo.saveLesson(makeProgress({ id: 'b', profileId: 'profile-2', lessonId: 'rook' }));
    await repo.addAttempt(makeAttempt({ id: 'a1' }));
    await repo.addAttempt(makeAttempt({ id: 'a2', profileId: 'profile-2' }));

    await repo.deleteProfileData('profile-1');

    expect(await repo.listLessons('profile-1')).toEqual([]);
    expect(await repo.listAttempts('profile-1')).toEqual([]);
    expect(await repo.listLessons('profile-2')).toHaveLength(1);
    expect(await repo.listAttempts('profile-2')).toHaveLength(1);
  });

  it('also removes mini-game progress for the profile, leaving other profiles untouched', async () => {
    const repo = new LocalStorageProgressRepository(openLocalStore(localStorage));
    await repo.saveMiniGame(makeMiniGameProgress({ id: 'a' }));
    await repo.saveMiniGame(makeMiniGameProgress({ id: 'b', profileId: 'profile-2' }));

    await repo.deleteProfileData('profile-1');

    expect(await repo.listMiniGames('profile-1')).toEqual([]);
    expect(await repo.listMiniGames('profile-2')).toHaveLength(1);
  });
});

describe('LocalStorageProgressRepository — mini-game progress', () => {
  it('saves, gets and lists mini-games keyed by profile + mini-game, and updates in place', async () => {
    const repo = new LocalStorageProgressRepository(openLocalStore(localStorage));
    const rook = makeMiniGameProgress({ id: 'a', miniGameId: 'hungry-rook' });
    const bishop = makeMiniGameProgress({ id: 'b', miniGameId: 'hungry-bishop' });
    const otherProfile = makeMiniGameProgress({
      id: 'c',
      profileId: 'profile-2',
      miniGameId: 'hungry-rook',
    });

    await repo.saveMiniGame(rook);
    await repo.saveMiniGame(bishop);
    await repo.saveMiniGame(otherProfile);

    expect(await repo.getMiniGame('profile-1', 'hungry-rook')).toEqual(rook);
    expect(await repo.getMiniGame('profile-1', 'unknown-game')).toBeUndefined();
    expect(await repo.listMiniGames('profile-1')).toEqual(expect.arrayContaining([rook, bishop]));
    expect(await repo.listMiniGames('profile-1')).toHaveLength(2);

    const updated: MiniGameProgress = { ...rook, bestStars: 1, plays: 5 };
    await repo.saveMiniGame(updated);
    expect(await repo.getMiniGame('profile-1', 'hungry-rook')).toEqual(updated);
  });

  it('rejects with StorageError on a corrupt stored shape', async () => {
    const store = openLocalStore(localStorage);
    store.write('minigame-progress', { 'profile-1:hungry-rook': { nope: true } });
    const repo = new LocalStorageProgressRepository(store);

    await expect(repo.listMiniGames('profile-1')).rejects.toThrow(StorageError);
  });
});

describe('LocalStorageProgressRepository — concept stats', () => {
  it('saves, gets and lists concept stats keyed by profile + concept, and updates in place', async () => {
    const repo = new LocalStorageProgressRepository(openLocalStore(localStorage));
    const rookMove = makeConceptStats({ id: 'a', conceptId: 'rook-move' });
    const bishopMove = makeConceptStats({ id: 'b', conceptId: 'bishop-move' });
    const otherProfile = makeConceptStats({
      id: 'c',
      profileId: 'profile-2',
      conceptId: 'rook-move',
    });

    await repo.saveConceptStats(rookMove);
    await repo.saveConceptStats(bishopMove);
    await repo.saveConceptStats(otherProfile);

    expect(await repo.getConceptStats('profile-1', 'rook-move')).toEqual(rookMove);
    expect(await repo.getConceptStats('profile-1', 'unknown-concept')).toBeUndefined();
    expect(await repo.listConceptStats('profile-1')).toEqual(
      expect.arrayContaining([rookMove, bishopMove]),
    );
    expect(await repo.listConceptStats('profile-1')).toHaveLength(2);

    const updated: ConceptStats = { ...rookMove, box: 2 };
    await repo.saveConceptStats(updated);
    expect(await repo.getConceptStats('profile-1', 'rook-move')).toEqual(updated);
  });

  it('rejects with StorageError on a corrupt stored shape', async () => {
    const store = openLocalStore(localStorage);
    store.write('concept-stats', { 'profile-1:rook-move': { nope: true } });
    const repo = new LocalStorageProgressRepository(store);

    await expect(repo.listConceptStats('profile-1')).rejects.toThrow(StorageError);
  });
});

describe('LocalStorageProgressRepository — deleteProfileData also clears concept stats', () => {
  it('removes concept stats for the profile, leaving other profiles untouched', async () => {
    const repo = new LocalStorageProgressRepository(openLocalStore(localStorage));
    await repo.saveConceptStats(makeConceptStats({ id: 'a' }));
    await repo.saveConceptStats(makeConceptStats({ id: 'b', profileId: 'profile-2' }));

    await repo.deleteProfileData('profile-1');

    expect(await repo.listConceptStats('profile-1')).toEqual([]);
    expect(await repo.listConceptStats('profile-2')).toHaveLength(1);
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
    // Seed 1998 directly (adding them one by one re-serialises the list each time), then cross
    // the cap through the repository.
    const store = openLocalStore(localStorage);
    store.write(
      'attempts',
      Array.from({ length: 1998 }, (_, i) => makeAttempt({ id: `a${String(i)}` })),
    );
    const repo = new LocalStorageProgressRepository(store);
    for (let i = 1998; i < 2005; i += 1) {
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

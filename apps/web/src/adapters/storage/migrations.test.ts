import { beforeEach, describe, expect, it } from 'vitest';
import { openLocalStore, SCHEMA_VERSION } from './local-store.ts';
import { MIGRATIONS } from './migrations.ts';
import { LocalStorageProgressRepository } from './local-progress-repository.ts';
import { LocalStorageGameRecordRepository } from './local-game-record-repository.ts';

beforeEach(() => {
  localStorage.clear();
});

describe('MIGRATIONS (v1 -> v2, M3.4 concept stats)', () => {
  it('brings v1 storage up to the current version without touching existing data', () => {
    localStorage.setItem('chess-kids:schema-version', '1');
    localStorage.setItem(
      'chess-kids:lesson-progress',
      JSON.stringify({ 'profile-1:rook': { id: 'lp1', profileId: 'profile-1', lessonId: 'rook' } }),
    );

    const store = openLocalStore(localStorage, { migrations: MIGRATIONS });

    expect(localStorage.getItem('chess-kids:schema-version')).toBe(String(SCHEMA_VERSION));
    expect(store.read('lesson-progress')).toEqual({
      'profile-1:rook': { id: 'lp1', profileId: 'profile-1', lessonId: 'rook' },
    });
  });

  it('a profile upgraded from v1 (no concept-stats key yet) reads as no stats for any concept', async () => {
    localStorage.setItem('chess-kids:schema-version', '1');

    const store = openLocalStore(localStorage, { migrations: MIGRATIONS });
    const repo = new LocalStorageProgressRepository(store);

    expect(await repo.listConceptStats('profile-1')).toEqual([]);
    expect(await repo.getConceptStats('profile-1', 'rook-move')).toBeUndefined();
  });
});

describe('MIGRATIONS (v2 -> v3, M3.5 game records)', () => {
  it('brings v2 storage up to the current version without touching existing data', () => {
    localStorage.setItem('chess-kids:schema-version', '2');
    localStorage.setItem(
      'chess-kids:lesson-progress',
      JSON.stringify({ 'profile-1:rook': { id: 'lp1', profileId: 'profile-1', lessonId: 'rook' } }),
    );

    const store = openLocalStore(localStorage, { migrations: MIGRATIONS });

    expect(localStorage.getItem('chess-kids:schema-version')).toBe(String(SCHEMA_VERSION));
    expect(store.read('lesson-progress')).toEqual({
      'profile-1:rook': { id: 'lp1', profileId: 'profile-1', lessonId: 'rook' },
    });
  });

  it('a profile upgraded from v1 or v2 (no game-records key yet) reads as no games played', async () => {
    localStorage.setItem('chess-kids:schema-version', '1');

    const store = openLocalStore(localStorage, { migrations: MIGRATIONS });
    const repo = new LocalStorageGameRecordRepository(store);

    expect(await repo.listByProfile('profile-1')).toEqual([]);
  });
});

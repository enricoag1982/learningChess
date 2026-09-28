import { beforeEach, describe, expect, it } from 'vitest';
import type { Migration } from './local-store.ts';
import { openLocalStore, SCHEMA_VERSION, StorageError } from './local-store.ts';

beforeEach(() => {
  localStorage.clear();
});

describe('openLocalStore', () => {
  it('writes the current version on fresh storage', () => {
    openLocalStore(localStorage);
    expect(localStorage.getItem('chess-kids:schema-version')).toBe(String(SCHEMA_VERSION));
  });

  it('round-trips read, write and remove', () => {
    const store = openLocalStore(localStorage);
    expect(store.read('settings')).toBeUndefined();

    store.write('settings', { sound: true });
    expect(store.read('settings')).toEqual({ sound: true });
    expect(localStorage.getItem('chess-kids:settings')).toBe('{"sound":true}');

    store.remove('settings');
    expect(store.read('settings')).toBeUndefined();
  });

  it('throws StorageError on corrupt JSON', () => {
    const store = openLocalStore(localStorage);
    localStorage.setItem('chess-kids:settings', '{not json');
    expect(() => store.read('settings')).toThrow(StorageError);
  });

  it('applies migrations in order, bumping the version after each', () => {
    localStorage.setItem('chess-kids:schema-version', '1');
    const applied: number[] = [];
    const migrations: Migration[] = [
      { to: 2, migrate: () => applied.push(2) },
      { to: 3, migrate: () => applied.push(3) },
    ];

    openLocalStore(localStorage, { version: 3, migrations });

    expect(applied).toEqual([2, 3]);
    expect(localStorage.getItem('chess-kids:schema-version')).toBe('3');
  });

  it('throws StorageError when a migration step is missing', () => {
    localStorage.setItem('chess-kids:schema-version', '1');
    const migrations: Migration[] = [{ to: 3, migrate: () => undefined }];

    expect(() => openLocalStore(localStorage, { version: 3, migrations })).toThrow(StorageError);
  });

  it('throws StorageError and leaves data untouched when the stored version is newer', () => {
    localStorage.setItem('chess-kids:schema-version', '99');
    localStorage.setItem('chess-kids:settings', '{"sound":true}');

    expect(() => openLocalStore(localStorage, { version: 1 })).toThrow(StorageError);

    expect(localStorage.getItem('chess-kids:schema-version')).toBe('99');
    expect(localStorage.getItem('chess-kids:settings')).toBe('{"sound":true}');
  });

  it('throws StorageError for unversioned existing data', () => {
    localStorage.setItem('chess-kids:settings', '{"sound":true}');
    expect(() => openLocalStore(localStorage)).toThrow(StorageError);
  });
});

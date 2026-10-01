import { beforeEach, describe, expect, it } from 'vitest';
import { cappedList, keyedCollection, singleton } from './collections.ts';
import { StorageError } from './local-store.ts';
import { openTestStore } from '../../testing/open-test-store.ts';

interface Row {
  readonly id: string;
  readonly group: string;
}

function isRow(value: unknown): value is Row {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === 'string' && typeof record.group === 'string';
}

function row(id: string, group = 'a'): Row {
  return { id, group };
}

beforeEach(() => {
  localStorage.clear();
});

describe('keyedCollection', () => {
  it('gets, lists (with and without a filter), puts and removes, keyed by keyOf', async () => {
    const store = openTestStore();
    const rows = keyedCollection(store, 'rows', (r: Row) => r.id, isRow);

    await rows.put(row('a', 'x'));
    await rows.put(row('b', 'y'));

    expect(await rows.get('a')).toEqual(row('a', 'x'));
    expect(await rows.get('missing')).toBeUndefined();
    expect(await rows.list()).toEqual(expect.arrayContaining([row('a', 'x'), row('b', 'y')]));
    expect(await rows.list((r) => r.group === 'y')).toEqual([row('b', 'y')]);

    await rows.put(row('a', 'z'));
    expect(await rows.get('a')).toEqual(row('a', 'z'));

    await rows.remove('a');
    expect(await rows.get('a')).toBeUndefined();
    expect(await rows.list()).toEqual([row('b', 'y')]);

    await expect(rows.remove('does-not-exist')).resolves.toBeUndefined();
  });

  it('removeWhere deletes every matching record, keeping the rest', async () => {
    const store = openTestStore();
    const rows = keyedCollection(store, 'rows', (r: Row) => r.id, isRow);
    await rows.put(row('a', 'x'));
    await rows.put(row('b', 'x'));
    await rows.put(row('c', 'y'));

    await rows.removeWhere((r) => r.group === 'x');

    expect(await rows.list()).toEqual([row('c', 'y')]);
  });

  it('a new collection instance over the same store sees data an earlier instance wrote', async () => {
    const store = openTestStore();
    await keyedCollection(store, 'rows', (r: Row) => r.id, isRow).put(row('a'));

    const second = keyedCollection(openTestStore(), 'rows', (r: Row) => r.id, isRow);
    expect(await second.get('a')).toEqual(row('a'));
    expect(await second.list()).toEqual([row('a')]);
  });

  it('rejects with StorageError when the stored value is not a valid record map', async () => {
    const store = openTestStore();
    store.write('rows', { a: { nope: true } });
    const rows = keyedCollection(store, 'rows', (r: Row) => r.id, isRow);

    await expect(rows.list()).rejects.toThrow(StorageError);
  });

  it('rejects with StorageError when the stored value is an array, not a record map', async () => {
    const store = openTestStore();
    store.write('rows', [row('a')]);
    const rows = keyedCollection(store, 'rows', (r: Row) => r.id, isRow);

    await expect(rows.list()).rejects.toThrow(StorageError);
  });
});

describe('cappedList', () => {
  it('add appends (newest last) and list filters', async () => {
    const store = openTestStore();
    const rows = cappedList(store, 'rows', undefined, isRow);

    await rows.add(row('a', 'x'));
    await rows.add(row('b', 'y'));

    expect(await rows.list()).toEqual([row('a', 'x'), row('b', 'y')]);
    expect(await rows.list((r) => r.group === 'y')).toEqual([row('b', 'y')]);
  });

  it('drops the oldest entries once the list grows past cap', async () => {
    const store = openTestStore();
    const rows = cappedList(store, 'rows', 3, isRow);

    for (let i = 0; i < 5; i += 1) {
      await rows.add(row(`r${String(i)}`));
    }

    const all = await rows.list();
    expect(all.map((r) => r.id)).toEqual(['r2', 'r3', 'r4']);
  });

  it('never trims when cap is undefined', async () => {
    const store = openTestStore();
    const rows = cappedList(store, 'rows', undefined, isRow);

    for (let i = 0; i < 10; i += 1) {
      await rows.add(row(`r${String(i)}`));
    }

    expect(await rows.list()).toHaveLength(10);
  });

  it('removeWhere deletes every matching record, keeping the rest and their order', async () => {
    const store = openTestStore();
    const rows = cappedList(store, 'rows', undefined, isRow);
    await rows.add(row('a', 'x'));
    await rows.add(row('b', 'y'));
    await rows.add(row('c', 'x'));

    await rows.removeWhere((r) => r.group === 'x');

    expect(await rows.list()).toEqual([row('b', 'y')]);
  });

  it('a new collection instance over the same store sees data an earlier instance wrote', async () => {
    const store = openTestStore();
    await cappedList(store, 'rows', undefined, isRow).add(row('a'));

    const second = cappedList(openTestStore(), 'rows', undefined, isRow);
    expect(await second.list()).toEqual([row('a')]);
  });

  it('rejects with StorageError when the stored value is not an array of valid records', async () => {
    const store = openTestStore();
    store.write('rows', [{ nope: true }]);
    const rows = cappedList(store, 'rows', undefined, isRow);

    await expect(rows.list()).rejects.toThrow(StorageError);
  });
});

describe('singleton', () => {
  it('is undefined before anything is set, then round-trips and updates in place', async () => {
    const store = openTestStore();
    const value = singleton<Row>(store, 'row');

    expect(await value.get()).toBeUndefined();

    await value.set(row('a'));
    expect(await value.get()).toEqual(row('a'));

    await value.set(row('a', 'z'));
    expect(await value.get()).toEqual(row('a', 'z'));
  });

  it('returns defaults when nothing has been stored yet', async () => {
    const store = openTestStore();
    const value = singleton<Row>(store, 'row', row('fallback'));

    expect(await value.get()).toEqual(row('fallback'));
  });

  it('a new collection instance over the same store sees data an earlier instance wrote', async () => {
    const store = openTestStore();
    await singleton<Row>(store, 'row').set(row('a'));

    const second = singleton<Row>(openTestStore(), 'row');
    expect(await second.get()).toEqual(row('a'));
  });

  it('rejects with StorageError on corrupt JSON at the underlying key', async () => {
    const store = openTestStore();
    localStorage.setItem('chess-kids:row', '{not json');
    const value = singleton<Row>(store, 'row');

    await expect(value.get()).rejects.toThrow(StorageError);
  });
});

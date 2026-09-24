import type { GameRecord, GameRecordRepository } from '@chess-kids/core';
import type { LocalStore } from './local-store.ts';
import { StorageError } from './local-store.ts';

const GAME_RECORDS_RECORD = 'game-records';
/** Oldest records are dropped once storage holds more than this many (mirrors `MAX_ATTEMPTS`). */
const MAX_GAME_RECORDS = 500;

function isGameRecordShape(value: unknown): value is GameRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.profileId === 'string' &&
    typeof record.game === 'string' &&
    typeof record.opponent === 'string' &&
    typeof record.result === 'string' &&
    Array.isArray(record.moves)
  );
}

function isGameRecordArray(value: unknown): value is GameRecord[] {
  return Array.isArray(value) && value.every(isGameRecordShape);
}

/**
 * Runs a synchronous computation and reports it as a settled promise, so a thrown `StorageError`
 * surfaces as a rejection instead of a synchronous throw (methods here have no `await` of their
 * own, so they are not declared `async`: `@typescript-eslint/require-await` would flag that).
 */
function toPromise<T>(compute: () => T): Promise<T> {
  try {
    return Promise.resolve(compute());
  } catch (error: unknown) {
    return Promise.reject<T>(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * `GameRecordRepository` over one `LocalStore`: a single capped, append-only list (newest last),
 * the same shape `LocalStorageProgressRepository` uses for `Attempt`.
 */
export class LocalStorageGameRecordRepository implements GameRecordRepository {
  private readonly store: LocalStore;

  constructor(store: LocalStore) {
    this.store = store;
  }

  private read(): GameRecord[] {
    const raw = this.store.read(GAME_RECORDS_RECORD);
    if (raw === undefined) return [];
    if (!isGameRecordArray(raw)) {
      throw new StorageError(`Corrupt game record data stored at "${GAME_RECORDS_RECORD}"`);
    }
    return raw;
  }

  add(record: GameRecord): Promise<void> {
    return toPromise(() => {
      const all = this.read();
      all.push(record);
      const capped = all.length > MAX_GAME_RECORDS ? all.slice(all.length - MAX_GAME_RECORDS) : all;
      this.store.write(GAME_RECORDS_RECORD, capped);
    });
  }

  listByProfile(profileId: string): Promise<GameRecord[]> {
    return toPromise(() => this.read().filter((record) => record.profileId === profileId));
  }

  deleteProfileData(profileId: string): Promise<void> {
    return toPromise(() => {
      const remaining = this.read().filter((record) => record.profileId !== profileId);
      this.store.write(GAME_RECORDS_RECORD, remaining);
    });
  }
}

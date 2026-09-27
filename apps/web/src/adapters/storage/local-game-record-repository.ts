import type { GameRecord, GameRecordRepository } from '@chess-kids/core';
import type { CappedList } from './collections.ts';
import { cappedList } from './collections.ts';
import type { LocalStore } from './local-store.ts';
import { STORAGE_KEYS } from './storage-keys.ts';

/** Oldest records are dropped once storage holds more than this many (mirrors `MAX_ATTEMPTS`). */
export const MAX_GAME_RECORDS = 500;

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

/** `GameRecordRepository` over one `LocalStore`: a single capped, append-only list (newest last),
 * the same shape `LocalStorageProgressRepository` uses for `Attempt`. */
export class LocalStorageGameRecordRepository implements GameRecordRepository {
  private readonly records: CappedList<GameRecord>;

  constructor(store: LocalStore) {
    this.records = cappedList(store, STORAGE_KEYS.gameRecords, MAX_GAME_RECORDS, isGameRecordShape);
  }

  add(record: GameRecord): Promise<void> {
    return this.records.add(record);
  }

  listByProfile(profileId: string): Promise<GameRecord[]> {
    return this.records.list((record) => record.profileId === profileId);
  }

  deleteProfileData(profileId: string): Promise<void> {
    return this.records.removeWhere((record) => record.profileId === profileId);
  }
}

import type { GameRecord, GameRecordRepository } from '@learn/platform-core';
import type { CappedList } from './collections.ts';
import { cappedList, shapeGuard } from './collections.ts';
import type { LocalStore } from './local-store.ts';
import { STORAGE_KEYS } from './storage-keys.ts';

export const MAX_GAME_RECORDS = 500;

const isGameRecordShape = shapeGuard<GameRecord>({
  string: ['id', 'profileId', 'game', 'opponent', 'result'],
  array: ['moves'],
});

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

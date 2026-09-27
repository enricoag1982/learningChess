import type { AssessmentRepository, AssessmentResult, Unlock } from '@chess-kids/core';
import type { CappedList } from './collections.ts';
import { cappedList } from './collections.ts';
import type { LocalStore } from './local-store.ts';
import { STORAGE_KEYS } from './storage-keys.ts';

/** Oldest results are dropped once storage holds more than this many (parent report only needs recent ones). */
export const MAX_ASSESSMENT_RESULTS = 500;

function isAssessmentResultShape(value: unknown): value is AssessmentResult {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.profileId === 'string' &&
    typeof record.kind === 'string' &&
    typeof record.correct === 'number' &&
    typeof record.total === 'number' &&
    typeof record.passed === 'boolean'
  );
}

function isUnlockShape(value: unknown): value is Unlock {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.profileId === 'string' &&
    typeof record.targetType === 'string' &&
    typeof record.targetId === 'string' &&
    typeof record.via === 'string'
  );
}

/**
 * `AssessmentRepository` over one `LocalStore`: assessment results as a single capped,
 * append-only list (newest last); unlocked lesson/world ids as a single append-only list, no cap
 * (no natural single-key-per-profile shape, unlike `Streak` — a profile can unlock more than one id).
 */
export class LocalStorageAssessmentRepository implements AssessmentRepository {
  private readonly results: CappedList<AssessmentResult>;
  private readonly unlocks: CappedList<Unlock>;

  constructor(store: LocalStore) {
    this.results = cappedList(
      store,
      STORAGE_KEYS.assessmentResults,
      MAX_ASSESSMENT_RESULTS,
      isAssessmentResultShape,
    );
    this.unlocks = cappedList(store, STORAGE_KEYS.unlocks, undefined, isUnlockShape);
  }

  addAssessmentResult(result: AssessmentResult): Promise<void> {
    return this.results.add(result);
  }

  listAssessmentResults(profileId: string): Promise<AssessmentResult[]> {
    return this.results.list((result) => result.profileId === profileId);
  }

  addUnlock(unlock: Unlock): Promise<void> {
    return this.unlocks.add(unlock);
  }

  listUnlocks(profileId: string): Promise<Unlock[]> {
    return this.unlocks.list((unlock) => unlock.profileId === profileId);
  }

  deleteProfileData(profileId: string): Promise<void> {
    return Promise.all([
      this.results.removeWhere((result) => result.profileId === profileId),
      this.unlocks.removeWhere((unlock) => unlock.profileId === profileId),
    ]).then(() => undefined);
  }
}

import type { AssessmentRepository, AssessmentResult, Unlock } from '@chess-kids/core';
import type { LocalStore } from './local-store.ts';
import { StorageError } from './local-store.ts';

/** Assessment results (M4.5): a single capped, append-only list, same shape `Attempt`/`GameRecord` use. */
const ASSESSMENT_RESULTS_RECORD = 'assessment-results';
/** Unlocked lesson/world ids (M4.5): a single append-only list, keyed by their own `id`. */
const UNLOCKS_RECORD = 'unlocks';
/** Oldest results are dropped once storage holds more than this many (parent report only needs recent ones). */
const MAX_ASSESSMENT_RESULTS = 500;

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

function isAssessmentResultArray(value: unknown): value is AssessmentResult[] {
  return Array.isArray(value) && value.every(isAssessmentResultShape);
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

function isUnlockArray(value: unknown): value is Unlock[] {
  return Array.isArray(value) && value.every(isUnlockShape);
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
 * `AssessmentRepository` over one `LocalStore` (M4.5): assessment results as a single capped,
 * append-only list (newest last); unlocked lesson/world ids as a single append-only list (no
 * natural single-key-per-profile shape, unlike `Streak` — a profile can unlock more than one id).
 */
export class LocalStorageAssessmentRepository implements AssessmentRepository {
  private readonly store: LocalStore;

  constructor(store: LocalStore) {
    this.store = store;
  }

  private readResults(): AssessmentResult[] {
    const raw = this.store.read(ASSESSMENT_RESULTS_RECORD);
    if (raw === undefined) return [];
    if (!isAssessmentResultArray(raw)) {
      throw new StorageError(
        `Corrupt assessment result data stored at "${ASSESSMENT_RESULTS_RECORD}"`,
      );
    }
    return raw;
  }

  private readUnlocks(): Unlock[] {
    const raw = this.store.read(UNLOCKS_RECORD);
    if (raw === undefined) return [];
    if (!isUnlockArray(raw)) {
      throw new StorageError(`Corrupt unlock data stored at "${UNLOCKS_RECORD}"`);
    }
    return raw;
  }

  addAssessmentResult(result: AssessmentResult): Promise<void> {
    return toPromise(() => {
      const all = this.readResults();
      all.push(result);
      const capped =
        all.length > MAX_ASSESSMENT_RESULTS ? all.slice(all.length - MAX_ASSESSMENT_RESULTS) : all;
      this.store.write(ASSESSMENT_RESULTS_RECORD, capped);
    });
  }

  listAssessmentResults(profileId: string): Promise<AssessmentResult[]> {
    return toPromise(() => this.readResults().filter((result) => result.profileId === profileId));
  }

  addUnlock(unlock: Unlock): Promise<void> {
    return toPromise(() => {
      const all = this.readUnlocks();
      all.push(unlock);
      this.store.write(UNLOCKS_RECORD, all);
    });
  }

  listUnlocks(profileId: string): Promise<Unlock[]> {
    return toPromise(() => this.readUnlocks().filter((unlock) => unlock.profileId === profileId));
  }

  deleteProfileData(profileId: string): Promise<void> {
    return toPromise(() => {
      const results = this.readResults().filter((result) => result.profileId !== profileId);
      this.store.write(ASSESSMENT_RESULTS_RECORD, results);

      const unlocks = this.readUnlocks().filter((unlock) => unlock.profileId !== profileId);
      this.store.write(UNLOCKS_RECORD, unlocks);
    });
  }
}

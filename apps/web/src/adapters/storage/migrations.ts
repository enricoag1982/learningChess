import type { Migration } from './local-store.ts';

/**
 * Every schema migration this build knows, applied in order by `openLocalStore` (`local-store.ts`).
 * v2 (M3.4): adds the `concept-stats` record. v3 (M3.5): adds the `game-records` record. Neither
 * needs existing data transformed — a profile with none yet simply reads back an empty list, same
 * as the empty-array/Map defaults `LocalStorageGameRecordRepository`/`readConceptStats()` already
 * return for a missing key — so both steps only bump the stored version.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    to: 2,
    migrate: () => {
      // No-op: see the module doc above.
    },
  },
  {
    to: 3,
    migrate: () => {
      // No-op: see the module doc above.
    },
  },
];

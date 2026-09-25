import type { Migration } from './local-store.ts';

/**
 * Every schema migration this build knows, applied in order by `openLocalStore` (`local-store.ts`).
 * v2 (M3.4): adds the `concept-stats` record. v3 (M3.5): adds the `game-records` record. v4 (M4.4):
 * adds the `earned-badges`/`streaks`/`session-logs` records. v5 (M4.5): adds the
 * `assessment-results`/`unlocks` records. None need existing data transformed — a profile with none
 * yet simply reads back an empty list/undefined, same as the empty-array/Map defaults each
 * repository already returns for a missing key — so every step only bumps the stored version.
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
  {
    to: 4,
    migrate: () => {
      // No-op: see the module doc above.
    },
  },
  {
    to: 5,
    migrate: () => {
      // No-op: see the module doc above.
    },
  },
];

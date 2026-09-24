import type { Migration } from './local-store.ts';

/**
 * Every schema migration this build knows, applied in order by `openLocalStore` (`local-store.ts`).
 * v2 (M3.4): adds the `concept-stats` record. No existing data needs transforming — a profile with
 * no attempts yet simply has no concept stats, same as the empty-Map default `readConceptStats()`
 * already returns for a missing key — so this step only bumps the stored version.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    to: 2,
    migrate: () => {
      // No-op: see the module doc above.
    },
  },
];

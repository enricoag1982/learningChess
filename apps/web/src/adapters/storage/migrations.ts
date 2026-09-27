import type { Migration } from './local-store.ts';

/** Every schema migration this build knows, applied in order by `openLocalStore`. None need
 * existing data transformed — a profile with none yet reads back an empty list/undefined. */
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

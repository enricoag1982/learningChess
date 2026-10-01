import { openLocalStore } from '../adapters/storage/local-store.ts';
import type { LocalStore, OpenLocalStoreOptions } from '../adapters/storage/local-store.ts';

/** The shipped chess key space, so the storage tests also check the keys real users already have. */
export const TEST_KEY_PREFIX = 'chess-kids:';

/** `openLocalStore` over `localStorage` under `TEST_KEY_PREFIX`. */
export function openTestStore(options: Omit<OpenLocalStoreOptions, 'keyPrefix'> = {}): LocalStore {
  return openLocalStore(localStorage, { ...options, keyPrefix: TEST_KEY_PREFIX });
}

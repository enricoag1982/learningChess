import type { IdGenerator } from '@chess-kids/core';

/** `IdGenerator` over the Web Crypto API. */
export function createCryptoIds(): IdGenerator {
  return { next: () => crypto.randomUUID() };
}

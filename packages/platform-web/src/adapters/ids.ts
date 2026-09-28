import type { IdGenerator } from '@learn/platform-core';

/** `IdGenerator` over the Web Crypto API. */
export function createCryptoIds(): IdGenerator {
  return { next: () => crypto.randomUUID() };
}

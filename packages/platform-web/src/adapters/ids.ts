import type { IdGenerator } from '@learn/platform-core';

export function createCryptoIds(): IdGenerator {
  return { next: () => crypto.randomUUID() };
}

import type { Random } from '@learn/platform-core';

export function createMathRandom(): Random {
  return { next: () => Math.random() };
}

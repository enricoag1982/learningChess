import type { Random } from '@chess-kids/core';

/** `Random` over `Math.random()` — the app's real randomness (warm-up/practice task picking). */
export function createMathRandom(): Random {
  return { next: () => Math.random() };
}

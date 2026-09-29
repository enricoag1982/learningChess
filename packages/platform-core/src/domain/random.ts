/** Randomness in [0, 1); seeded in tests. */
export interface Random {
  next(): number;
}

/**
 * Deterministic PRNG (mulberry32): same seed produces the same sequence, every time, on any
 * platform. Used for reproducible bot play and tests; not for anything security-sensitive.
 */
export function seededRandom(seed: number): Random {
  let state = seed >>> 0;
  return {
    next(): number {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** Deterministic Fisher–Yates shuffle driven by `random` (mutates nothing; returns a new array). */
export function shuffle<T>(items: readonly T[], random: Random): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random.next() * (i + 1));
    const a = shuffled[i];
    const b = shuffled[j];
    if (a !== undefined && b !== undefined) {
      shuffled[i] = b;
      shuffled[j] = a;
    }
  }
  return shuffled;
}

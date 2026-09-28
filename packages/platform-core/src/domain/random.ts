/** Randomness in [0, 1). Same shape as the app `Random` port, so either can be passed here. */
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

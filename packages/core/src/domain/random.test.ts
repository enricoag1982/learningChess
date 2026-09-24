import { describe, expect, it } from 'vitest';

import { seededRandom } from './random.ts';

describe('seededRandom', () => {
  it('is deterministic for a fixed seed', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('differs across seeds', () => {
    const a = Array.from({ length: 5 }, () => seededRandom(1).next());
    const b = Array.from({ length: 5 }, () => seededRandom(2).next());
    expect(a).not.toEqual(b);
  });

  it('stays within [0, 1)', () => {
    const random = seededRandom(7);
    for (let i = 0; i < 2000; i += 1) {
      const value = random.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

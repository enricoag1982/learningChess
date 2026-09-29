import { describe, expect, it } from 'vitest';
import { AVATARS } from './avatars.ts';

describe('avatars', () => {
  it('has exactly 8 fixed animal ids', () => {
    expect(AVATARS).toHaveLength(8);
    expect(new Set(AVATARS).size).toBe(8);
  });
});

import { describe, expect, it } from 'vitest';
import { AVATARS, isAvatar } from './avatars.ts';

describe('avatars', () => {
  it('has exactly 8 fixed animal ids', () => {
    expect(AVATARS).toHaveLength(8);
    expect(new Set(AVATARS).size).toBe(8);
  });

  it('isAvatar accepts only known ids', () => {
    for (const id of AVATARS) {
      expect(isAvatar(id)).toBe(true);
    }
    expect(isAvatar('dragon')).toBe(false);
    expect(isAvatar('')).toBe(false);
  });
});

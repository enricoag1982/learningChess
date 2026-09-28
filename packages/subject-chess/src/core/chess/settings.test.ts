import { describe, expect, it } from 'vitest';

import { isValidComputerLevel, isValidPieceStyle } from './settings.ts';

describe('isValidComputerLevel', () => {
  it('accepts "auto" and every level 1-5', () => {
    expect(isValidComputerLevel('auto')).toBe(true);
    for (let level = 1; level <= 5; level += 1) {
      expect(isValidComputerLevel(level)).toBe(true);
    }
  });

  it('rejects out-of-range numbers and other values', () => {
    expect(isValidComputerLevel(0)).toBe(false);
    expect(isValidComputerLevel(6)).toBe(false);
    expect(isValidComputerLevel('manual')).toBe(false);
    expect(isValidComputerLevel(null)).toBe(false);
  });
});

describe('isValidPieceStyle', () => {
  it('accepts "animal" and "classic"', () => {
    expect(isValidPieceStyle('animal')).toBe(true);
    expect(isValidPieceStyle('classic')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isValidPieceStyle('wood')).toBe(false);
    expect(isValidPieceStyle(undefined)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { newProfile, validateNickname } from './profile.ts';

describe('validateNickname', () => {
  it('rejects empty or whitespace-only input', () => {
    expect(validateNickname('')).toBe(false);
    expect(validateNickname('   ')).toBe(false);
  });

  it('rejects more than 12 visible characters after trim', () => {
    expect(validateNickname('ThirteenLetters')).toBe(false);
    expect(validateNickname('TwelveLetters')).toBe(false); // 13 chars
    expect(validateNickname('  TwelveChars  ')).toBe(true); // 11 visible chars, padded with spaces
  });

  it('accepts letters, digits, spaces, hyphen and apostrophe', () => {
    expect(validateNickname('Mia')).toBe(true);
    expect(validateNickname("D'Angelo")).toBe(true);
    expect(validateNickname('Anne-Marie')).toBe(true);
    expect(validateNickname('Player 1')).toBe(true);
  });

  it('rejects other punctuation', () => {
    expect(validateNickname('Mia!')).toBe(false);
    expect(validateNickname('<script>')).toBe(false);
  });
});

describe('newProfile', () => {
  it('builds a fresh profile, trimming the nickname', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const profile = newProfile('id-1', '  Mia  ', 'panda', now);
    expect(profile).toEqual({
      id: 'id-1',
      accountId: 'local',
      nickname: 'Mia',
      avatar: 'panda',
      locale: 'en',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
  });
});

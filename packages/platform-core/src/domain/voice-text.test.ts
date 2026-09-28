import { describe, expect, it } from 'vitest';
import { normalizeVoiceText, stripNickname, voiceKey } from './voice-text.ts';

describe('normalizeVoiceText', () => {
  it('trims and collapses internal whitespace runs', () => {
    expect(normalizeVoiceText('  Hello   there,  friend!  ')).toBe('Hello there, friend!');
    expect(normalizeVoiceText('Line one\n\nLine  two')).toBe('Line one Line two');
  });

  it('folds curly quotes and apostrophes to the plain form', () => {
    expect(normalizeVoiceText('It’s Rhino’s turn')).toBe("It's Rhino's turn");
    expect(normalizeVoiceText('“Great job”')).toBe('"Great job"');
    expect(normalizeVoiceText('‘quoted’')).toBe("'quoted'");
  });

  it('folds every dash variant to a plain hyphen', () => {
    expect(normalizeVoiceText('en–dash')).toBe('en-dash');
    expect(normalizeVoiceText('em—dash')).toBe('em-dash');
  });

  it('is idempotent and already-plain text is unchanged', () => {
    const text = "Rhino's biggest challenge yet - collect every star!";
    expect(normalizeVoiceText(text)).toBe(text);
    expect(normalizeVoiceText(normalizeVoiceText(text))).toBe(normalizeVoiceText(text));
  });
});

describe('stripNickname', () => {
  it('removes the nickname at the end, with its leading comma', () => {
    expect(stripNickname('Great job, Mia!', 'Mia')).toBe('Great job!');
  });

  it('removes the nickname at the start, with its trailing comma', () => {
    expect(stripNickname('Mia, great job!', 'Mia')).toBe('great job!');
  });

  it('removes the nickname in the middle, with no double space left behind', () => {
    expect(stripNickname('Say hi to Mia now', 'Mia')).toBe('Say hi to now');
  });

  it('removes a bare nickname with no adjacent punctuation', () => {
    expect(stripNickname('Nice work Mia today', 'Mia')).toBe('Nice work today');
  });

  it('never cuts the nickname out of a longer word (word-boundary only)', () => {
    expect(stripNickname('Also great work!', 'Al')).toBe('Also great work!');
    expect(stripNickname('Look at the valley!', 'Val')).toBe('Look at the valley!');
  });

  it('is a no-op when the nickname is absent, empty, or not present in the text', () => {
    expect(stripNickname('Great job!', undefined)).toBe('Great job!');
    expect(stripNickname('Great job!', null)).toBe('Great job!');
    expect(stripNickname('Great job!', '')).toBe('Great job!');
    expect(stripNickname('Great job!', '   ')).toBe('Great job!');
    expect(stripNickname('Great job!', 'Zoe')).toBe('Great job!');
  });

  it('leaves subtitle-only surrounding punctuation intact otherwise', () => {
    expect(stripNickname('Mia is ready to play.', 'Mia')).toBe('is ready to play.');
  });
});

describe('voiceKey', () => {
  it('is a stable 16-character lowercase hex string', () => {
    const key = voiceKey('Watch Rhino run to every green dot.');
    expect(key).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is deterministic for the same text', () => {
    expect(voiceKey('Great job!')).toBe(voiceKey('Great job!'));
  });

  it('is the same key for text differing only by whitespace or curly punctuation', () => {
    expect(voiceKey('  Great   job! ')).toBe(voiceKey('Great job!'));
    expect(voiceKey('It’s time')).toBe(voiceKey("It's time"));
  });

  it('differs for different text', () => {
    expect(voiceKey('Great job!')).not.toBe(voiceKey('Great try!'));
  });
});

import { describe, expect, it } from 'vitest';
import { createMathContentSource } from './bundled-content-source.ts';

describe('createMathContentSource', () => {
  it('exposes the lessons and the number parade from the compiled bundle', () => {
    const content = createMathContentSource();

    const ids = content.lessons().map((lesson) => lesson.id);
    expect(ids).toHaveLength(3);
    expect(ids).toEqual(expect.arrayContaining(['add-within-5', 'add-within-10', 'take-away']));
    expect(content.lesson('take-away')?.id).toBe('take-away');
    expect(content.lesson('does-not-exist')).toBeUndefined();
    expect(content.minigame('number-parade')?.id).toBe('number-parade');
    expect(content.minigame('does-not-exist')).toBeUndefined();
  });

  it('exposes the numbers track and the two badges', () => {
    const content = createMathContentSource();

    expect(content.catalog().tracks.map((track) => track.id)).toEqual(['numbers']);
    expect(content.badges().map((badge) => badge.id)).toEqual(['first-sums', 'star-counter']);
  });
});

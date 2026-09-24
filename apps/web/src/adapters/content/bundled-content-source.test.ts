import { describe, expect, it } from 'vitest';
import { createBundledContentSource } from './bundled-content-source.ts';

describe('createBundledContentSource', () => {
  it('exposes the rook lesson from the compiled content bundle', () => {
    const content = createBundledContentSource();

    const ids = content.lessons().map((lesson) => lesson.id);
    expect(ids).toContain('rook');
    expect(content.lesson('rook')?.id).toBe('rook');
    expect(content.lesson('does-not-exist')).toBeUndefined();
  });

  it('exposes the hungry-rook mini-game from the compiled content bundle', () => {
    const content = createBundledContentSource();

    const ids = content.minigames().map((minigame) => minigame.id);
    expect(ids).toContain('hungry-rook');
    expect(content.minigame('hungry-rook')?.id).toBe('hungry-rook');
    expect(content.minigame('does-not-exist')).toBeUndefined();
  });
});

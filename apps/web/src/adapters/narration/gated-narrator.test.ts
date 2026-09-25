import { describe, expect, it } from 'vitest';
import type { Narrator } from '@chess-kids/core';
import { createGatedNarrator } from './gated-narrator.ts';

function makeInner(): Narrator & { readonly spoken: string[]; cancelCount: number } {
  const spoken: string[] = [];
  return {
    available: true,
    spoken,
    cancelCount: 0,
    speak(text: string): Promise<void> {
      spoken.push(text);
      return Promise.resolve();
    },
    cancel(): void {
      this.cancelCount += 1;
    },
  };
}

describe('createGatedNarrator', () => {
  it('speaks through to inner while enabled (the default)', async () => {
    const inner = makeInner();
    const gated = createGatedNarrator(inner);

    await gated.speak('hello');

    expect(inner.spoken).toEqual(['hello']);
    expect(gated.available).toBe(true);
  });

  it('never calls inner.speak once disabled', async () => {
    const inner = makeInner();
    const gated = createGatedNarrator(inner);

    gated.setEnabled(false);
    await gated.speak('hello');

    expect(inner.spoken).toEqual([]);
    expect(gated.available).toBe(false);
  });

  it('cancels inner immediately when disabled (mid-speech mute)', () => {
    const inner = makeInner();
    const gated = createGatedNarrator(inner);

    gated.setEnabled(false);

    expect(inner.cancelCount).toBe(1);
  });

  it('resumes speaking once re-enabled', async () => {
    const inner = makeInner();
    const gated = createGatedNarrator(inner);

    gated.setEnabled(false);
    gated.setEnabled(true);
    await gated.speak('hello again');

    expect(inner.spoken).toEqual(['hello again']);
  });

  it('cancel() always passes through, regardless of enabled state', () => {
    const inner = makeInner();
    const gated = createGatedNarrator(inner);

    gated.cancel();

    expect(inner.cancelCount).toBe(1);
  });
});

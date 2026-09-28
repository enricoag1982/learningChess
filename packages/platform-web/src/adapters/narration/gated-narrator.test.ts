import { describe, expect, it } from 'vitest';
import { createFakeNarrator } from '../../testing/fake-narrator.ts';
import { createGatedNarrator } from './gated-narrator.ts';

describe('createGatedNarrator', () => {
  it('speaks through to inner while enabled (the default)', async () => {
    const inner = createFakeNarrator();
    const gated = createGatedNarrator(inner);

    await gated.speak('hello');

    expect(inner.spoken).toEqual(['hello']);
    expect(gated.available).toBe(true);
  });

  it('never calls inner.speak once disabled', async () => {
    const inner = createFakeNarrator();
    const gated = createGatedNarrator(inner);

    gated.setEnabled(false);
    await gated.speak('hello');

    expect(inner.spoken).toEqual([]);
    expect(gated.available).toBe(false);
  });

  it('cancels inner immediately when disabled (mid-speech mute)', () => {
    const inner = createFakeNarrator();
    const gated = createGatedNarrator(inner);

    gated.setEnabled(false);

    expect(inner.cancelCount).toBe(1);
  });

  it('resumes speaking once re-enabled', async () => {
    const inner = createFakeNarrator();
    const gated = createGatedNarrator(inner);

    gated.setEnabled(false);
    gated.setEnabled(true);
    await gated.speak('hello again');

    expect(inner.spoken).toEqual(['hello again']);
  });

  it('cancel() always passes through, regardless of enabled state', () => {
    const inner = createFakeNarrator();
    const gated = createGatedNarrator(inner);

    gated.cancel();

    expect(inner.cancelCount).toBe(1);
  });
});

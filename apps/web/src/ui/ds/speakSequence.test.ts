import { describe, expect, it } from 'vitest';
import { createFakeNarrator } from '../../testing/fake-narrator.ts';
import { speakSequence } from './speakSequence.ts';

/** Lets every already-queued microtask (the loop's own `await`s) run before continuing. */
function flush(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe('speakSequence', () => {
  it('speaks every text in order, each only after the previous one finished', async () => {
    const narrator = createFakeNarrator({ manual: true });
    const done = speakSequence(narrator, ['one', 'two', 'three']);

    expect(narrator.spoken).toEqual(['one']); // only the first: the second waits for it
    narrator.finish();
    await flush();
    expect(narrator.spoken).toEqual(['one', 'two']);
    narrator.finish();
    await flush();
    expect(narrator.spoken).toEqual(['one', 'two', 'three']);
    narrator.finish();

    await expect(done).resolves.toBeUndefined();
  });

  it('an empty texts array cancels the narrator without speaking anything', async () => {
    const narrator = createFakeNarrator({ manual: true });
    void speakSequence(narrator, ['one']);
    expect(narrator.spoken).toEqual(['one']);

    await speakSequence(narrator, []);
    expect(narrator.cancelCount).toBeGreaterThan(0);
    expect(narrator.spoken).toEqual(['one']); // still only the first call's text
  });

  it('a newer speakSequence() call stops the previous run before its next text starts', async () => {
    const narrator = createFakeNarrator({ manual: true });
    const first = speakSequence(narrator, ['a1', 'a2', 'a3']);
    expect(narrator.spoken).toEqual(['a1']);

    // A newer call supersedes the first mid-run — this itself resolves `a1`'s pending `speak()`
    // (the narrator's own cancellation), same as a real `narrator.speak()`/`cancel()` would.
    const second = speakSequence(narrator, ['b1', 'b2']);
    expect(narrator.spoken).toEqual(['a1', 'b1']); // 'a2'/'a3' never spoken: the run stopped early

    narrator.finish(); // finishes 'b1'
    await flush();
    expect(narrator.spoken).toEqual(['a1', 'b1', 'b2']);
    narrator.finish(); // finishes 'b2'

    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBeUndefined();
  });

  it('cancelling mid-run (an empty texts array) stops it before its next text starts', async () => {
    const narrator = createFakeNarrator({ manual: true });
    const run = speakSequence(narrator, ['x1', 'x2']);
    expect(narrator.spoken).toEqual(['x1']);

    const cancelling = speakSequence(narrator, []); // stop, without starting a new run
    expect(narrator.spoken).toEqual(['x1']); // 'x2' never spoken

    await expect(run).resolves.toBeUndefined();
    await expect(cancelling).resolves.toBeUndefined();
  });
});

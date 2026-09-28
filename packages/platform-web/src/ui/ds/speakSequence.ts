import type { Narrator } from '@learn/platform-core';

/** Tracks, per `Narrator` instance, which `speakSequence` run is current; a fresh call (even an
 * empty one, to stop without starting a new run) always supersedes the last. A `WeakMap` keeps
 * this out of the `Narrator` port, so any narrator works, including test fakes. */
const tokens = new WeakMap<Narrator, number>();

function nextToken(narrator: Narrator): number {
  const next = (tokens.get(narrator) ?? 0) + 1;
  tokens.set(narrator, next);
  return next;
}

/** Speaks each of `texts` through `narrator`, one after another, so each gets its own
 * generated-audio lookup instead of one concatenated string. A newer call for the same `narrator`
 * stops this run before its next text starts (checked via the token, past each `await`). */
export function speakSequence(narrator: Narrator, texts: readonly string[]): Promise<void> {
  const myToken = nextToken(narrator);
  narrator.cancel();
  return (async () => {
    for (const text of texts) {
      if (tokens.get(narrator) !== myToken) return;
      await narrator.speak(text);
      if (tokens.get(narrator) !== myToken) return;
    }
  })();
}
